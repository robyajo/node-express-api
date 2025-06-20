import winston from 'winston';
import path from 'path';
import DailyRotateFile from 'winston-daily-rotate-file';
import { Request } from 'express';

// Define log directory
const logDir = path.join(process.cwd(), 'storage', 'logs');

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Create logger instance
const logger = winston.createLogger({
  level: 'info', // Default log level
  format: logFormat,
  defaultMeta: { service: 'node-api' },
  transports: [
    // Write all logs with level `error` and below to `error.log`
    new DailyRotateFile({
      level: 'error',
      filename: path.join(logDir, 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '30d',
    }),
    // Write all logs with level `info` and below to `application.log`
    new DailyRotateFile({
      filename: path.join(logDir, 'application-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '14d',
    }),
  ],
});

// If we're not in production, log to the `console` with the format:
// `${info.level}: ${info.message} JSON.stringify({ ...rest })`
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    ),
    level: 'debug', // Log everything in development
  }));
}

// Helper function to format request data for logging
export const formatRequest = (req: Request) => ({
  method: req.method,
  url: req.originalUrl,
  path: req.path,
  headers: req.headers,
  query: req.query,
  body: req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH' 
    ? { ...req.body, password: req.body?.password ? '[HIDDEN]' : undefined } 
    : undefined,
  ip: req.ip,
  user: req.user ? { id: req.user.id } : undefined
});

// Custom logging functions
export const logError = (message: string, error: any, meta: Record<string, any> = {}) => {
  const errorInfo = error instanceof Error 
    ? { 
        name: error.name, 
        message: error.message, 
        stack: error.stack,
        ...(error as any).errors // Include validation errors if they exist
      } 
    : error;
  
  logger.error(message, { 
    error: errorInfo,
    ...meta,
    timestamp: new Date().toISOString()
  });
};

export const logInfo = (message: string, meta: Record<string, any> = {}) => {
  logger.info(message, { 
    ...meta,
    timestamp: new Date().toISOString() 
  });
};

export const logWarning = (message: string, meta: Record<string, any> = {}) => {
  logger.warn(message, { 
    ...meta,
    timestamp: new Date().toISOString() 
  });
};

export const logDebug = (message: string, meta: Record<string, any> = {}) => {
  logger.debug(message, { 
    ...meta,
    timestamp: new Date().toISOString() 
  });
};

export default logger;
