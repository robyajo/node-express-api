import express, { Express, Request, Response, NextFunction } from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';
import authRoutes from './routes/authRoutes';
import adminRoutes from './routes/adminRoutes';
import exampleRoutes from './routes/exampleRoutes';
import postRoutes from './routes/postRoutes';
import categoryRoutes from './routes/categoryRoutes';
import webrtcRoutes, { initializeWebRTC } from './routes/webrtcRoutes';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';
import { logInfo, logError } from './utils/logger';

dotenv.config();

// Create Express app and HTTP server
const app: Express = express();
const server = http.createServer(app);

// Initialize WebRTC controller
initializeWebRTC(server);

// Middleware
app.use(cors());
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());
const swaggerOptions = {
  swaggerDefinition: {
    openapi: '3.0.0',
    info: {
      title: 'Node.js API',
      version: '1.0.0',
      description: 'Documentation for Node.js API with TypeScript',
      contact: {
        name: 'API Support',
        url: 'https://yourwebsite.com/support',
        email: 'support@yourwebsite.com',
      },
    },
    servers: [
      {
        url: process.env.API_URL || 'http://localhost:3000',
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ['./src/routes/*.ts', './src/controllers/*.ts'],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Add API key authentication
app.use(
  '/api-docs',
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    explorer: true,
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Node.js API Documentation',
    swaggerOptions: {
      docExpansion: 'none',
      filter: true,
      showRequestDuration: true,
    },
  })
);

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, '../public')));
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));

// Serve WebRTC demo files
app.use('/webrtc', (req, res, next) => {
  const filePath = path.join(__dirname, '../public/webrtc', req.path);
  res.sendFile(filePath, (err) => {
    if (err) {
      console.error('Error serving file:', err);
      next();
    }
  });
});

// Serve WebRTC demo page
app.get('/webrtc-demo', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/webrtc/index.html'));
});

// Serve webrtc files from the correct path
app.use('/webrtc', express.static(path.join(__dirname, '../public/webrtc')));

// Public routes
app.use('/api/', authRoutes);

// Blog routes
app.use('/api/posts', postRoutes);

// Category routes
app.use('/api/categories', categoryRoutes);

// Admin routes (protected)
app.use('/api/admin', adminRoutes);

// Example routes
app.use('/api', exampleRoutes);

// WebRTC routes
app.use('/api/webrtc', webrtcRoutes);

// Error Handling
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = '192.168.1.5'; // Dengarkan semua interface jaringan

server.listen(PORT, HOST, () => {
  logInfo(`Server is running on port ${PORT}`, { 
    environment: process.env.NODE_ENV || 'development',
    pid: process.pid
  });
  console.log(`Server berjalan di http://${HOST}:${PORT}`);
  console.log(`API Documentation available at http://${HOST}:${PORT}/api-docs`);
});