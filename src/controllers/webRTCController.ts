import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { logInfo, logError } from '../utils/logger';

interface PeerConnectionData {
  target: string;
  callerId: string;
  signal: any;
  streamId?: string;
}

export class WebRTCController {
  private io: SocketIOServer;
  private activeSockets: Map<string, string> = new Map(); // socketId -> userId
  private userRooms: Map<string, string> = new Map(); // userId -> roomId

  constructor(server: HttpServer) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: process.env.CLIENT_URL || '*',
        methods: ['GET', 'POST']
      }
    });

    this.initializeSocketEvents();
    logInfo('WebRTC Controller initialized', { context: 'webrtc.controller' });
  }

  private initializeSocketEvents(): void {
    this.io.on('connection', (socket: Socket) => {
      const userId = socket.handshake.query.userId as string;
      
      if (!userId) {
        logError('Connection attempt without userId', { socketId: socket.id });
        socket.disconnect(true);
        return;
      }

      // Store socket ID with user ID
      this.activeSockets.set(socket.id, userId);
      logInfo('New WebRTC connection', { 
        socketId: socket.id, 
        userId,
        activeConnections: this.activeSockets.size 
      });

      // Join user to their personal room
      socket.join(userId);
      this.userRooms.set(userId, userId);

      // Handle WebRTC signaling
      this.handleSignaling(socket, userId);

      // Handle disconnection
      socket.on('disconnect', () => {
        this.handleDisconnect(socket, userId);
      });

      // Handle errors
      socket.on('error', (error) => {
        logError('Socket error', { 
          socketId: socket.id, 
          userId,
          error: error.message,
          stack: error.stack 
        });
      });
    });
  }

  private handleSignaling(socket: Socket, userId: string): void {
    // When user wants to start a call
    socket.on('call-user', (data: PeerConnectionData) => {
      const { target, callerId, signal, streamId } = data;
      logInfo('Initiating call', { 
        from: callerId, 
        to: target,
        streamId
      });

      // Send call signal to target user
      this.io.to(target).emit('call-made', {
        signal,
        callerId,
        streamId
      });
    });

    // When user accepts the call
    socket.on('make-answer', (data: { signal: any; to: string }) => {
      logInfo('Call answered', { 
        from: userId, 
        to: data.to 
      });
      this.io.to(data.to).emit('answer-made', {
        signal: data.signal,
        answererId: userId
      });
    });

    // ICE Candidate exchange
    socket.on('ice-candidate', (data: { candidate: any; to: string }) => {
      this.io.to(data.to).emit('ice-candidate', {
        candidate: data.candidate,
        from: userId
      });
    });

    // Handle screen sharing
    socket.on('screen-sharing-started', (data: { to: string; signal: any }) => {
      logInfo('Screen sharing started', { 
        from: userId, 
        to: data.to 
      });
      this.io.to(data.to).emit('screen-sharing-signal', {
        signal: data.signal,
        from: userId
      });
    });
  }

  private handleDisconnect(socket: Socket, userId: string): void {
    logInfo('User disconnected', { 
      socketId: socket.id, 
      userId,
      activeConnections: this.activeSockets.size - 1 
    });

    // Notify other users about disconnection
    socket.broadcast.emit('user-disconnected', { userId });
    
    // Clean up
    this.activeSockets.delete(socket.id);
    this.userRooms.delete(userId);
  }

  // Get all active connections (for debugging)
  public getActiveConnections(): Map<string, string> {
    return new Map(this.activeSockets);
  }
}
