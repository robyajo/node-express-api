// STUN and TURN server configuration
export const iceServers = {
  iceServers: [
    // Free public STUN servers
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    
    // Add your TURN server credentials here if you have one
    // {
    //   urls: 'turn:your-turn-server.com:3478',
    //   username: 'username',
    //   credential: 'password'
    // }
  ],
  iceCandidatePoolSize: 10,
};

// WebRTC Configuration
export const rtcConfig: RTCConfiguration = {
  iceServers: iceServers.iceServers,
  iceTransportPolicy: 'all',
  bundlePolicy: 'max-bundle',
  rtcpMuxPolicy: 'require',
  iceCandidatePoolSize: 10,
};

// Socket.IO event names
export const SocketEvents = {
  // Connection events
  CONNECTION: 'connection',
  DISCONNECT: 'disconnect',
  
  // WebRTC signaling events
  CALL_USER: 'call-user',
  CALL_MADE: 'call-made',
  MAKE_ANSWER: 'make-answer',
  ANSWER_MADE: 'answer-made',
  ICE_CANDIDATE: 'ice-candidate',
  
  // Screen sharing
  SCREEN_SHARING_STARTED: 'screen-sharing-started',
  SCREEN_SHARING_SIGNAL: 'screen-sharing-signal',
  
  // User events
  USER_DISCONNECTED: 'user-disconnected',
  USER_CONNECTED: 'user-connected',
  
  // Error events
  ERROR: 'error',
};
