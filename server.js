const express = require('express');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
const os = require('os');

const app = express();

const server = http.createServer(app);

// Store active meetings and users
const activeMeetings = new Map();
const users = new Map();

// Configure Socket.IO with CORS and other options
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true
  },
  allowEIO3: true,
  transports: ['websocket', 'polling'],
  pingTimeout: 30000,
  pingInterval: 60000
});

// Helper function to get meeting by ID
function getOrCreateMeeting(meetingId) {
  if (!activeMeetings.has(meetingId)) {
    activeMeetings.set(meetingId, {
      id: meetingId,
      participants: new Map(),
      createdAt: new Date(),
      isActive: true
    });
    console.log(`Created new meeting: ${meetingId}`);
  }
  return activeMeetings.get(meetingId);
}

// Helper function to remove empty meetings
function cleanupEmptyMeetings() {
  for (const [meetingId, meeting] of activeMeetings.entries()) {
    if (meeting.participants.size === 0) {
      console.log(`Removing empty meeting: ${meetingId}`);
      activeMeetings.delete(meetingId);
    }
  }
}

// Log Socket.IO connections
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);
  
  // Handle joining a meeting
  socket.on('join-meeting', ({ meetingId, userName }) => {
    try {
      const meeting = getOrCreateMeeting(meetingId);
      const user = {
        id: socket.id,
        name: userName,
        meetingId,
        joinedAt: new Date(),
        socket: socket
      };
      
      // Add user to the meeting
      meeting.participants.set(socket.id, user);
      users.set(socket.id, user);
      
      // Join the meeting room
      socket.join(meetingId);
      
      // Notify the user they've joined successfully
      socket.emit('meeting-joined', {
        meetingId,
        userId: socket.id,
        userName,
        participants: Array.from(meeting.participants.values())
          .filter(p => p.id !== socket.id)
          .map(p => ({ id: p.id, name: p.name }))
      });
      
      // Notify other participants about the new user
      socket.to(meetingId).emit('user-joined', {
        userId: socket.id,
        userName,
        meetingId
      });
      
      console.log(`${userName} (${socket.id}) joined meeting ${meetingId}`);
    } catch (error) {
      console.error('Error joining meeting:', error);
      socket.emit('meeting-error', {
        message: 'Failed to join meeting',
        error: error.message
      });
    }
  });
  
  // Handle leaving a meeting
  socket.on('leave-meeting', () => {
    const user = users.get(socket.id);
    if (!user) return;
    
    const { meetingId } = user;
    const meeting = activeMeetings.get(meetingId);
    
    if (meeting) {
      // Remove user from the meeting
      meeting.participants.delete(socket.id);
      
      // Notify other participants
      socket.to(meetingId).emit('user-left', {
        userId: socket.id,
        userName: user.name,
        meetingId
      });
      
      console.log(`${user.name} (${socket.id}) left meeting ${meetingId}`);
      
      // Clean up empty meetings
      if (meeting.participants.size === 0) {
        activeMeetings.delete(meetingId);
        console.log(`Meeting ${meetingId} ended (no participants)`);
      }
    }
    
    // Remove user from users map
    users.delete(socket.id);
    socket.leave(meetingId);
  });
  
  // Handle WebRTC signaling
  socket.on('signal', (data) => {
    if (data.to) {
      console.log(`Forwarding signal from ${socket.id} to ${data.to}`, data.type || 'signal');
      socket.to(data.to).emit('signal', {
        ...data,
        from: socket.id
      });
    }
  });
  
  // Handle call initiation
  socket.on('call-user', (data) => {
    console.log(`Call from ${socket.id} to ${data.to}`);
    socket.to(data.to).emit('call-made', {
      signal: data.signal,
      callerId: socket.id,
      userName: users.get(socket.id)?.name || 'Unknown'
    });
  });
  
  // Handle call answer
  socket.on('make-answer', (data) => {
    console.log(`Answer from ${socket.id} to ${data.to}`);
    socket.to(data.to).emit('answer-made', {
      signal: data.answer,
      answererId: socket.id,
      userName: users.get(socket.id)?.name || 'Unknown'
    });
  });
  
  // Handle ICE candidates
  socket.on('ice-candidate', (data) => {
    if (data.to) {
      console.log(`ICE candidate from ${socket.id} to ${data.to}`);
      socket.to(data.to).emit('ice-candidate', {
        candidate: data.candidate,
        from: socket.id
      });
    }
  });
  
  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    const user = users.get(socket.id);
    if (!user) return;
    
    const { meetingId } = user;
    const meeting = activeMeetings.get(meetingId);
    
    if (meeting) {
      // Remove user from the meeting
      meeting.participants.delete(socket.id);
      
      // Notify other participants
      socket.to(meetingId).emit('user-left', {
        userId: socket.id,
        userName: user.name,
        meetingId
      });
      
      console.log(`${user.name} (${socket.id}) disconnected from meeting ${meetingId}`);
      
      // Clean up empty meetings
      if (meeting.participants.size === 0) {
        activeMeetings.delete(meetingId);
        console.log(`Meeting ${meetingId} ended (no participants)`);
      }
    }
    
    // Remove user from users map
    users.delete(socket.id);
  });
  
  // Periodically clean up empty meetings
  setInterval(cleanupEmptyMeetings, 5 * 60 * 1000); // Every 5 minutes
});

// Get local IP addresses
function getLocalIpAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  
  Object.keys(interfaces).forEach(ifaceName => {
    interfaces[ifaceName].forEach(iface => {
      // Skip internal (non-IPv4) and non-internal (public) addresses
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push({
          name: ifaceName,
          address: iface.address
        });
      }
    });
  });
  
  return addresses;
}

// Log available network interfaces on startup
const availableIps = getLocalIpAddresses();
console.log('\n=== Available Network Interfaces ===');
availableIps.forEach(ip => {
  console.log(`${ip.name}: http://${ip.address}:3000/webrtc-demo`);
});
console.log('\nNote: For best results, use the application on devices connected to the same network.');
console.log('===================================\n');

// CORS for Socket.IO is already configured above

// Enable CORS for all routes
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

// Set Content Security Policy headers
app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy', 
    "default-src 'self' * 'unsafe-inline' 'unsafe-eval' data: blob:; " +
    "script-src 'self' * 'unsafe-inline' 'unsafe-eval' data: blob:; " +
    "connect-src 'self' * ws: wss: http: https:; " +
    "style-src 'self' * 'unsafe-inline'; " +
    "img-src 'self' * data: blob:; " +
    "media-src 'self' * data: blob:; " +
    "frame-src 'self' *; " +
    "worker-src 'self' * blob:;"
  );
  next();
});

// Serve static files from public directory
app.use('/webrtc', express.static(path.join(__dirname, 'public/webrtc'), {
  setHeaders: (res, path) => {
    // Set proper MIME type for .mjs files
    if (path.endsWith('.mjs')) {
      res.setHeader('Content-Type', 'application/javascript');
    }
    // Add CORS headers for all static files
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
  }
}));

// Serve the Socket.IO client
app.get('/socket.io/socket.io.js', (req, res) => {
  try {
    const socketPath = require.resolve('socket.io/client-dist/socket.io.js');
    console.log('Serving Socket.IO client from:', socketPath);
    res.sendFile(socketPath);
  } catch (error) {
    console.error('Error serving Socket.IO client:', error);
    res.status(500).send('Error loading Socket.IO client');
  }
});

// WebRTC demo route - serves the main application
app.get('/webrtc-demo', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/webrtc/index.html'));
});

// Redirect /webrtc to /webrtc-demo for backward compatibility
app.get(['/webrtc', '/webrtc/'], (req, res) => {
  res.redirect('/webrtc-demo');
});

// Serve the index page for the root URL
app.get('/', (req, res) => {
  // Show a simple page with a link to the WebRTC demo
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>WebRTC Video Call</title>
      <style>
        body { 
          font-family: Arial, sans-serif; 
          margin: 20px;
          line-height: 1.6;
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
        }
        .local-ips { 
          background: #f8f9fa; 
          padding: 20px; 
          border-radius: 8px; 
          margin: 20px 0;
          border: 1px solid #dee2e6;
        }
        .ip-address { 
          font-family: 'Courier New', monospace;
          color: #0d6efd;
          margin: 8px 0;
          padding: 8px;
          background: white;
          border-radius: 4px;
          border-left: 4px solid #0d6efd;
        }
        a { 
          color: #0d6efd; 
          text-decoration: none; 
          font-weight: 500;
        }
        a:hover { 
          text-decoration: underline; 
        }
        h1 {
          color: #212529;
          margin-bottom: 20px;
        }
        h3 {
          margin-top: 0;
          color: #495057;
        }
        .container {
          max-width: 100%;
          padding: 0 15px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>WebRTC Video Call Demo</h1>
        
        <div class="local-ips">
          <h3>Available Network Interfaces:</h3>
          ${localIps.map(ip => 
            `<div class="ip-address">${ip.name}: <a href="http://${ip.address}:3000/webrtc-demo" target="_blank">http://${ip.address}:3000/webrtc-demo</a></div>`
          ).join('')}
        </div>
        
        <div style="margin: 20px 0;">
          <h3>How to use:</h3>
          <ol>
            <li>Open the demo URL on your current device to test locally</li>
            <li>Or share one of the above links with someone on the same network</li>
            <li>Enter a name and meeting ID to join a call</li>
          </ol>
        </div>
        
        <div style="background: #e9ecef; padding: 15px; border-radius: 8px; margin-top: 20px;">
          <h3>Note:</h3>
          <p>For best results, use the application on devices connected to the same network. Some browsers may require HTTPS for camera/microphone access.</p>
        </div>
      </div>
    </body>
    </html>
  `;
  
  res.send(html);
});

// Handle 404
app.use((req, res) => {
  res.status(404).send('Not Found');
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).send('Internal Server Error');
});

// Socket.io connection
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  // Forward the call to the target user
  socket.on('call-user', (data) => {
    console.log(`Call from ${socket.id} to ${data.to}`);
    io.to(data.to).emit('call-made', {
      signal: data.offer,
      callerId: socket.id
    });
  });

  // Forward the answer to the caller
  socket.on('make-answer', (data) => {
    console.log(`Answer from ${socket.id} to ${data.to}`);
    io.to(data.to).emit('answer-made', {
      signal: data.signal,
      answererId: socket.id
    });
  });

  // Forward ICE candidates
  socket.on('ice-candidate', (data) => {
    console.log(`ICE candidate from ${socket.id} to ${data.to}`);
    io.to(data.to).emit('ice-candidate', {
      candidate: data.candidate
    });
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0'; // Listen on all network interfaces

// Start server
server.listen(PORT, HOST, () => {
  console.log('\n=== Server is running ===');
  console.log(`Local:            http://localhost:${PORT}`);
  console.log(`On Your Network:  http://${availableIps[0]?.address || '0.0.0.0'}:${PORT}`);
  console.log(`WebRTC Demo:     http://localhost:${PORT}/webrtc-demo`);
  console.log('========================\n');
});
