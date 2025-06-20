import { Router } from 'express';
import { WebRTCController } from '../controllers/webRTCController';
import { logInfo, logError } from '../utils/logger';

const router = Router();

// This will be initialized in the main app file
export let webRTCController: WebRTCController;

/**
 * Initialize WebRTC controller with HTTP server
 * This should be called from the main app file after creating the HTTP server
 */
export const initializeWebRTC = (httpServer: any) => {
  webRTCController = new WebRTCController(httpServer);
  logInfo('WebRTC routes initialized', { context: 'webrtc.routes' });
  return webRTCController;
};

// Get WebRTC configuration
router.get('/config', (req, res) => {
  try {
    const { rtcConfig } = require('../config/webrtc');
    res.json({
      success: true,
      data: rtcConfig,
    });
  } catch (error) {
    logError('Failed to get WebRTC config', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get WebRTC configuration',
    });
  }
});

// Get active connections (for debugging)
router.get('/connections', (req, res) => {
  try {
    if (!webRTCController) {
      throw new Error('WebRTC controller not initialized');
    }
    
    const connections = webRTCController.getActiveConnections();
    res.json({
      success: true,
      data: {
        connections: Array.from(connections.entries()).map(([socketId, userId]) => ({
          socketId,
          userId,
        })),
        total: connections.size,
      },
    });
  } catch (error) {
    logError('Failed to get active connections', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get active connections',
    });
  }
});

export default router;
