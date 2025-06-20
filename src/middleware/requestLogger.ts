import { Request, Response, NextFunction } from 'express';
import { logInfo } from '../utils/logger';

/**
 * Logs all incoming HTTP requests
 */
const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  // Skip health check requests to reduce log noise
  if (req.path === '/health') {
    return next();
  }

  const start = Date.now();
  const { method, originalUrl, ip, body } = req;

  // Log the request
  logInfo('Request received', {
    method,
    url: originalUrl,
    ip,
    body: ['POST', 'PUT', 'PATCH'].includes(method) 
      ? { ...body, password: body?.password ? '[HIDDEN]' : undefined } 
      : undefined,
    query: req.query,
    headers: {
      'user-agent': req.get('user-agent'),
      referer: req.get('referer'),
    },
  });

  // Capture response finish event to log the response
  res.on('finish', () => {
    const duration = Date.now() - start;
    const { statusCode } = res;
    
    const logData = {
      method,
      url: originalUrl,
      status: statusCode,
      duration: `${duration}ms`,
      contentLength: res.get('content-length'),
    };

    if (statusCode >= 500) {
      logInfo('Server error', logData);
    } else if (statusCode >= 400) {
      logInfo('Client error', logData);
    } else {
      logInfo('Request completed', logData);
    }
  });

  next();
};

export default requestLogger;
