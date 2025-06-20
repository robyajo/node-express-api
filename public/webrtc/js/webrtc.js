// DOM Elements
// App Elements
const appElement = document.getElementById('app');
const joinScreen = document.getElementById('joinScreen');
const joinBtn = document.getElementById('joinBtn');
const createMeetingBtn = document.getElementById('createMeeting');
const displayNameInput = document.getElementById('displayName');
const meetingIdInput = document.getElementById('meetingId');
const meetingTitle = document.getElementById('meetingTitle');

// Video Elements
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const localVideoOverlay = document.getElementById('localVideoOverlay');
const remoteVideoOverlay = document.getElementById('remoteVideoOverlay');
const userIdInput = document.getElementById('userId');
const remoteIdInput = document.getElementById('remoteId');
const startBtn = document.getElementById('startBtn');
const callBtn = document.getElementById('callBtn');
const hangupBtn = document.getElementById('hangupBtn');
const screenShareBtn = document.getElementById('screenShareBtn');
const toggleAudioBtn = document.getElementById('toggleAudioBtn');
const toggleVideoBtn = document.getElementById('toggleVideoBtn');
const copyIdBtn = document.getElementById('copyIdBtn');
const statusDiv = document.getElementById('status');
const logsDiv = document.getElementById('logs');

// App State
let currentUser = {
    name: '',
    id: '',
    meetingId: ''
};
let isHost = false;

// Generate a random meeting ID
function generateMeetingId() {
  // Generate a random 9-digit number
  return Math.floor(100000000 + Math.random() * 900000000).toString();
}

// Helper function to update video overlay
function updateVideoOverlay(videoElement, overlayElement, isVisible, text = '') {
    if (overlayElement) {
        overlayElement.style.display = isVisible ? 'flex' : 'none';
        if (text) {
            const p = overlayElement.querySelector('p');
            if (p) p.textContent = text;
        }
    }
}

// WebRTC variables
let localStream;
let remoteStream;
let peerConnection;
let socket;
let currentUserId;
let isCaller = false;
let isScreenSharing = false;
let isAudioMuted = false;
let isVideoOff = false;

// Configuration for WebRTC
const configuration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { 
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    { 
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    }
  ],
  iceCandidatePoolSize: 10,
  bundlePolicy: 'max-bundle',
  rtcpMuxPolicy: 'require',
  iceTransportPolicy: 'all'
};

// Socket events
const SocketEvents = {
  CONNECTION: 'connection',
  DISCONNECT: 'disconnect',
  CALL_USER: 'call-user',
  CALL_MADE: 'call-made',
  MAKE_ANSWER: 'make-answer',
  ANSWER_MADE: 'answer-made',
  ICE_CANDIDATE: 'ice-candidate',
  USER_CONNECTED: 'user-connected',
  USER_DISCONNECTED: 'user-disconnected',
  SCREEN_SHARING_STARTED: 'screen-sharing-started',
  SCREEN_SHARING_SIGNAL: 'screen-sharing-signal'
};

// Initialize the application
async function init() {
  // Generate a random user ID if not already set
  currentUserId = `user-${Math.floor(Math.random() * 10000)}`;
  userIdInput.value = currentUserId;
  
  // Initialize UI
  updateUI('disconnected');
  
  // Connect to WebSocket server
  connectToSignalingServer();
  
  // Set up event listeners
  setupEventListeners();
  
  // Start local video
  await startLocalVideo();
}

// Set up socket event handlers
function setupSocketEventHandlers() {
  if (!socket) return;
  
  // Handle incoming calls
  socket.on('call-made', (data) => {
    log(`Incoming call from ${data.callerId}`, 'info');
    updateStatus(`Incoming call from ${data.callerId}`);
    
    // Store the caller's ID
    currentCallerId = data.callerId;
    
    // Update UI to show incoming call
    showIncomingCallUI(data.callerId);
  });
  
  // Handle call answer
  socket.on('answer-made', (data) => {
    log(`Call answered by ${data.answererId}`, 'info');
    updateStatus(`Call connected to ${data.answererId}`);
    
    // Handle the answer
    handleAnswer(data.signal);
  });
  
  // Handle ICE candidates
  socket.on('ice-candidate', (data) => {
    log('Received ICE candidate', 'info');
    if (data.candidate) {
      addIceCandidate(new RTCIceCandidate(data.candidate));
    }
  });
  
  // Handle call end
  socket.on('call-ended', () => {
    log('Call ended by remote peer', 'info');
    endCall();
  });
}

// Connect to the signaling server
function connectToSignalingServer() {
  try {
    log('Connecting to signaling server...', 'info');
    
    // Disconnect existing socket if any
    if (socket) {
      log('Disconnecting existing socket...', 'info');
      socket.disconnect();
    }
    
    // Connect to the signaling server with explicit URL and debug logging
    const socketUrl = window.location.protocol + '//' + window.location.hostname + ':3000';
    log(`Connecting to Socket.IO server at: ${socketUrl}`, 'info');
    
    socket = io(socketUrl, {
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      query: {
        userName: currentUser.name,
        meetingId: currentUser.meetingId
      }
    });
    
    // Connection established
    socket.on('connect', () => {
      log('✅ Connected to signaling server', 'success');
      updateStatus('Connected to server');
      
      // Generate a random user ID if not already set
      if (!currentUser.id) {
        const currentUserId = 'user-' + Math.random().toString(36).substr(2, 9);
        currentUser.id = currentUserId;
        log(`Generated user ID: ${currentUserId}`, 'info');
      }
      
      // Join the meeting room
      socket.emit('join-meeting', {
        meetingId: currentUser.meetingId,
        userName: currentUser.name
      });
    });
    
    // Handle successful meeting join
    socket.on('meeting-joined', (data) => {
      console.log('Joined meeting:', data.meetingId);
      updateStatus(`Joined meeting: ${data.meetingId}`, 'success');
      
      // Update current user ID
      currentUser.id = data.userId;
      userIdInput.value = data.userId;
      
      // Connect to existing participants
      if (data.participants && data.participants.length > 0) {
        updateStatus(`Found ${data.participants.length} participants`, 'info');
        
        // In a real app, you would initiate connections to existing participants
        data.participants.forEach(participant => {
          console.log(`Found participant: ${participant.name} (${participant.id})`);
          // Here you would typically initiate a connection to this participant
        });
      }
    });
    
    // Handle new participant joined
    socket.on('user-joined', (data) => {
      console.log('User joined:', data.userName, data.userId);
      updateStatus(`${data.userName} joined the meeting`, 'info');
      
      // In a real app, you would initiate a connection to this new participant
      // For now, we'll just log it
    });
    
    // Handle participant left
    socket.on('user-left', (data) => {
      console.log('User left:', data.userName, data.userId);
      updateStatus(`${data.userName} left the meeting`, 'info');
      
      // In a real app, you would clean up the connection to this participant
    });
    
    // Handle meeting errors
    socket.on('meeting-error', (error) => {
      console.error('Meeting error:', error);
      updateStatus(`Error: ${error.message}`, 'error');
    });
    
    // Handle connection errors
    socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
      updateStatus('Connection error: ' + error.message, 'error');
      updateVideoOverlay(localVideo, localVideoOverlay, true, 'Connection failed. Please refresh the page.');
    });
    
    // Handle reconnection attempts
    socket.on('reconnect_attempt', (attemptNumber) => {
      console.log(`Reconnection attempt ${attemptNumber}`);
      updateStatus(`Reconnecting... (attempt ${attemptNumber})`, 'warning');
    });
    
    // Handle successful reconnection
    socket.on('reconnect', (attemptNumber) => {
      console.log('Reconnected to signaling server');
      updateStatus('Reconnected to server', 'success');
      
      // Rejoin the meeting after reconnection
      if (currentUser.meetingId) {
        socket.emit('join-meeting', {
          meetingId: currentUser.meetingId,
          userName: currentUser.name
        });
      }
    });
    
    // Handle reconnection failure
    socket.on('reconnect_failed', () => {
      console.error('Failed to reconnect to signaling server');
      updateStatus('Failed to reconnect. Please refresh the page.', 'error');
    });
    
    // Handle incoming call
    socket.on('call-made', async (data) => {
      console.log('Incoming call from:', data.callerId);
      updateStatus(`Incoming call from ${data.userName || 'user'}...`, 'info');
      
      try {
        // Create a new peer connection if one doesn't exist
        if (!peerConnection) {
          await createPeerConnection();
        }
        
        // Set the remote description
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.signal));
        
        // Create and send an answer
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        
        socket.emit('make-answer', {
          to: data.callerId,
          answer: peerConnection.localDescription
        });
        
        // Update UI
        updateStatus(`In call with ${data.userName || 'user'}`, 'success');
        hangupBtn.disabled = false;
        
      } catch (error) {
        console.error('Error handling incoming call:', error);
        updateStatus('Error handling call: ' + error.message, 'error');
      }
    });
    
    // Handle answer received
    socket.on('answer-made', async (data) => {
      console.log('Answer received from:', data.answererId);
      
      try {
        if (peerConnection) {
          await peerConnection.setRemoteDescription(new RTCSessionDescription(data.signal));
          updateStatus(`Connected to ${data.userName || 'user'}`, 'success');
        }
      } catch (error) {
        console.error('Error setting remote description:', error);
        updateStatus('Error connecting call: ' + error.message, 'error');
      }
    });
    
    // Handle ICE candidates
    socket.on('ice-candidate', async (data) => {
      console.log('ICE candidate received');
      
      try {
        if (data.candidate && peerConnection) {
          await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
        }
      } catch (error) {
        console.error('Error adding ICE candidate:', error);
      }
    });
    
    // Handle call ended
    socket.on('call-ended', () => {
      console.log('Call ended by remote peer');
      updateStatus('Call ended', 'info');
      hangupCall();
    });
    
  } catch (error) {
    console.error('Error initializing socket connection:', error);
    updateStatus('Error initializing connection: ' + error.message, 'error');
    updateVideoOverlay(localVideo, localVideoOverlay, true, 'Connection error. Please check console for details.');
  }
}

// Set up UI event listeners
function setupEventListeners() {
  // Start call button
  startBtn.addEventListener('click', startCall);
  
  // Call button
  callBtn.addEventListener('click', callUser);
  
  // Hang up button
  hangupBtn.addEventListener('click', hangUp);
  
  // Screen share button
  screenShareBtn.addEventListener('click', toggleScreenShare);
  
  // Toggle audio button
  toggleAudioBtn.addEventListener('click', toggleAudio);
  
  // Toggle video button
  toggleVideoBtn.addEventListener('click', toggleVideo);
  
  // Copy ID button
  copyIdBtn.addEventListener('click', copyUserId);
  
  // Handle remote ID input
  remoteIdInput.addEventListener('keyup', (e) => {
    callBtn.disabled = !remoteIdInput.value.trim();
  });
}

// Polyfill for navigator.mediaDevices in Firefox
function ensureMediaDevices() {
  // Check if we're in Firefox
  const isFirefox = navigator.userAgent.includes('Firefox');
  const isLocalhost = ['localhost', '127.0.0.1', '192.168.1.5'].includes(window.location.hostname);
  
  // Log environment info for debugging
  console.log('ensureMediaDevices - Environment:', {
    isFirefox,
    isLocalhost,
    isSecureContext: window.isSecureContext,
    location: window.location.href,
    hasMediaDevices: !!navigator.mediaDevices,
    hasGetUserMedia: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
    hasMozGetUserMedia: !!(navigator.mozGetUserMedia)
  });

  // If mediaDevices exists and has getUserMedia, return it
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    return Promise.resolve(navigator.mediaDevices);
  }
  
  // Firefox-specific handling
  if (isFirefox) {
    // Try to use the prefixed version if available
    if (navigator.mozGetUserMedia) {
      console.log('Using Firefox legacy getUserMedia API');
      navigator.mediaDevices = navigator.mediaDevices || {};
      if (!navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia = function(constraints) {
          return new Promise((resolve, reject) => {
            navigator.mozGetUserMedia(
              constraints,
              stream => resolve(stream),
              err => reject(new Error(`getUserMedia error: ${err.name}`))
            );
          });
        };
      }
      return Promise.resolve(navigator.mediaDevices);
    }
    
    // If we're here, we're in Firefox without access to media APIs
    let errorMsg = 'Firefox requires HTTPS for camera access on non-localhost domains. ';
    errorMsg += 'Please try one of these solutions:\n';
    errorMsg += '1. Use Chrome/Edge for testing\n';
    errorMsg += '2. Access via http://localhost:3000\n';
    errorMsg += '3. Enable media.devices.insecure.enabled in about:config (not recommended for production)';
    
    console.error(errorMsg);
    return Promise.reject(new Error(errorMsg));
  }
  
  // For other browsers
  if (!navigator.mediaDevices) {
    return Promise.reject(new Error('navigator.mediaDevices is not available. This browser may not support WebRTC.'));
  }
  
  if (!navigator.mediaDevices.getUserMedia) {
    return Promise.reject(new Error('navigator.mediaDevices.getUserMedia is not available.'));
  }
  
  return Promise.resolve(navigator.mediaDevices);
}

// Check if WebRTC is supported
function isWebRTCSupported() {
  // Check if we're on a secure context (HTTPS or localhost)
  const isLocalhost = ['localhost', '127.0.0.1', '192.168.1.5'].includes(window.location.hostname);
  const isFirefox = navigator.userAgent.includes('Firefox');
  
  // Firefox requires secure context for mediaDevices
  if (isFirefox && !window.isSecureContext && !isLocalhost) {
    console.error('Firefox requires HTTPS for camera access on non-localhost domains');
    return false;
  }
  
  // Check for required WebRTC APIs
  const hasMediaDevices = !!(navigator.mediaDevices || 
                           (navigator.mozGetUserMedia && navigator.userAgent.includes('Firefox')));
  const hasRTCPeerConnection = !!window.RTCPeerConnection || !!window.mozRTCPeerConnection;
  
  // Log detailed debug information
  console.log('WebRTC Support Check:', {
    isSecureOrigin,
    hasMediaDevices,
    hasRTCPeerConnection,
    location: window.location.href,
    protocol: window.location.protocol,
    hostname: window.location.hostname
  });
  
  if (!isSecureOrigin) {
    console.error('WebRTC requires a secure origin (HTTPS, localhost, or 127.0.0.1)');
    return false;
  }
  
  if (!hasMediaDevices) {
    console.error('navigator.mediaDevices is not available');
    return false;
  }
  
  if (!hasRTCPeerConnection) {
    console.error('RTCPeerConnection is not supported');
    return false;
  }
  
  return true;
}

// Start local video stream
async function startLocalVideo() {
  try {
    log('Initializing local video...', 'info');
    updateVideoOverlay(localVideo, localVideoOverlay, true, 'Initializing...');
    
    // Coba dapatkan daftar perangkat terlebih dahulu
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(device => device.kind === 'videoinput');
    
    if (videoDevices.length === 0) {
      throw new Error('No video devices found');
    }

    log(`Found ${videoDevices.length} video device(s)`, 'info');
    
    // Coba akses kamera dengan kualitas rendah dulu
    const constraints = {
      video: {
        width: { ideal: 640 },
        height: { ideal: 480 },
        frameRate: { ideal: 30 }
      },
      audio: true
    };

    // Coba akses kamera
    localStream = await navigator.mediaDevices.getUserMedia(constraints);
    
    // Tampilkan stream ke video element
    localVideo.srcObject = localStream;
    await localVideo.play();
    
    // Sembunyikan overlay
    updateVideoOverlay(localVideo, localVideoOverlay, false);
    log('Local video started successfully', 'success');
    
    return localStream;
  } catch (error) {
    console.error('Error accessing media devices:', error);
    updateVideoOverlay(localVideo, localVideoOverlay, true, 'Camera Error');
    
    let errorMessage = 'Tidak dapat mengakses kamera. ';
    if (error.name === 'NotAllowedError') {
      errorMessage += 'Izin kamera ditolak. Mohon izinkan akses kamera.';
    } else if (error.name === 'NotFoundError') {
      errorMessage += 'Tidak ditemukan perangkat kamera.';
    } else if (error.name === 'NotReadableError') {
      errorMessage += 'Kamera sedang digunakan oleh aplikasi lain. Tutup aplikasi lain yang mungkin menggunakan kamera.';
    } else {
      errorMessage += `Error: ${error.message}`;
    }
    
    updateStatus(errorMessage, 'error');
    throw error;
  }
}

// Create a new RTCPeerConnection
async function createPeerConnection(isCaller) {
  try {
    console.log('Creating new peer connection...');
    
    // Initialize peer connection with configuration
    peerConnection = new RTCPeerConnection(configuration);
    console.log('PeerConnection created with config:', configuration);

    // Set up event handlers
    peerConnection.onicecandidate = (event) => {
      console.log('onicecandidate:', event.candidate ? 'New ICE candidate' : 'All ICE candidates sent');
      handleICECandidateEvent(event);
    };
    
    peerConnection.oniceconnectionstatechange = () => {
      console.log('ICE connection state changed to:', peerConnection.iceConnectionState);
      handleICEConnectionStateChangeEvent();
    };
    
    peerConnection.onicegatheringstatechange = () => {
      console.log('ICE gathering state changed to:', peerConnection.iceGatheringState);
      handleICEGatheringStateChangeEvent();
    };
    
    peerConnection.onsignalingstatechange = () => {
      console.log('Signaling state changed to:', peerConnection.signalingState);
      handleSignalingStateChangeEvent();
    };
    
    peerConnection.onnegotiationneeded = async () => {
      console.log('Negotiation needed');
      await handleNegotiationNeededEvent();
    };
    
    peerConnection.ontrack = (event) => {
      console.log('Received remote track:', event.track.kind);
      if (event.streams && event.streams[0]) {
        remoteVideo.srcObject = event.streams[0];
      }
      handleTrackEvent(event);
    };

    // Add local stream to connection if available
    if (localStream) {
      console.log('Adding local stream to peer connection');
      localStream.getTracks().forEach(track => {
        console.log(`Adding local ${track.kind} track`);
        peerConnection.addTrack(track, localStream);
      });
    }

    // If we're the caller, create an offer
    if (isCaller) {
      console.log('Creating initial offer...');
      try {
        await createAndSendOffer();
      } catch (error) {
        console.error('Error creating initial offer:', error);
        log(`Error creating offer: ${error.message}`, 'error');
      }
    }
    
    // Add connection state change handler
    peerConnection.onconnectionstatechange = () => {
      console.log('Connection state changed to:', peerConnection.connectionState);
      log(`Connection state: ${peerConnection.connectionState}`, 'info');
      
      if (peerConnection.connectionState === 'disconnected' || 
          peerConnection.connectionState === 'failed') {
        console.log('Connection lost, cleaning up...');
        hangUp();
      }
    };
    
    return peerConnection;
  } catch (error) {
    console.error('Error in createPeerConnection:', error);
    log(`Error creating connection: ${error.message}`, 'error');
    updateStatus('Connection error');
    throw error; // Re-throw to allow caller to handle
  }
}

// Create and send an offer
async function createAndSendOffer() {
  try {
    console.log('Creating offer...');
    const offer = await peerConnection.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true,
      voiceActivityDetection: false
    });

    // Enable better audio quality
    const audioTransceiver = peerConnection.getTransceivers().find(t => 
      t.sender.track && t.sender.track.kind === 'audio'
    );
    
    if (audioTransceiver) {
      const senders = peerConnection.getSenders();
      senders.forEach(sender => {
        if (sender.track && sender.track.kind === 'audio') {
          const params = sender.getParameters();
          if (!params.encodings) {
            params.encodings = [{}];
          }
          if (params.encodings.length > 0) {
            params.encodings[0].dtx = 1; // Enable discontinuous transmission
          }
          sender.setParameters(params).catch(console.error);
        }
      });
    }
    
    console.log('Setting local description...');
    await peerConnection.setLocalDescription(offer);
    
    // Send the offer to the remote peer
    const remoteId = remoteIdInput.value.trim();
    if (remoteId) {
      console.log('Sending offer to:', remoteId);
      socket.emit(SocketEvents.CALL_USER, {
        offer: peerConnection.localDescription,
        to: remoteId
      });
      updateStatus('Calling...');
    } else {
      throw new Error('No remote ID specified');
    }
  } catch (error) {
    console.error('Error in createAndSendOffer:', error);
    log(`Error creating offer: ${error.message}`, 'error');
    throw error;
  }
}

// Start a call
async function startCall() {
  try {
    updateStatus('Starting call...');
    await createPeerConnection(true);
    updateStatus('Call started');
  } catch (error) {
    log(`Error starting call: ${error.message}`, 'error');
    updateStatus('Call failed');
  }
}

// Call a user
async function callUser() {
  const remoteId = remoteIdInput.value.trim();
  
  if (!remoteId) {
    log('Please enter a remote user ID', 'error');
    return;
  }
  
  try {
    // Create a new peer connection if one doesn't exist
    if (!peerConnection || peerConnection.connectionState === 'disconnected') {
      await createPeerConnection(true);
    }
    
    // Create and send offer
    await createAndSendOffer();
    
    log(`Calling ${remoteId}...`, 'info');
    updateStatus(`Calling ${remoteId}...`);
    isCaller = true;
  } catch (error) {
    log(`Error calling user: ${error.message}`, 'error');
    updateStatus('Error making call');
  }
}

// Hang up the call
function hangUp() {
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
  
  // Stop all tracks in the local stream
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
  }
  
  // Reset video elements
  localVideo.srcObject = null;
  remoteVideo.srcObject = null;
  
  // Restart local video
  startLocalVideo();
  
  updateUI('ready');
  updateStatus('Call ended');
  log('Call ended', 'info');
}

// Toggle screen sharing
async function toggleScreenShare() {
  try {
    if (isScreenSharing) {
      // Stop screen sharing
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.stop();
      }
      
      // Get back the camera
      const newStream = await navigator.mediaDevices.getUserMedia({ video: true });
      const newVideoTrack = newStream.getVideoTracks()[0];
      
      // Replace the video track
      const sender = peerConnection.getSenders().find(s => s.track.kind === 'video');
      if (sender) {
        sender.replaceTrack(newVideoTrack);
      }
      
      // Update the local stream
      localStream.removeTrack(localStream.getVideoTracks()[0]);
      localStream.addTrack(newVideoTrack);
      localVideo.srcObject = localStream;
      
      isScreenSharing = false;
      screenShareBtn.textContent = 'Share Screen';
      log('Screen sharing stopped', 'info');
    } else {
      // Start screen sharing
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false
      });
      
      // Get the screen track
      const screenTrack = screenStream.getVideoTracks()[0];
      
      // Replace the video track in the peer connection
      const sender = peerConnection.getSenders().find(s => s.track.kind === 'video');
      if (sender) {
        await sender.replaceTrack(screenTrack);
      }
      
      // Update the local stream
      localStream.getVideoTracks().forEach(track => track.stop());
      localStream.addTrack(screenTrack);
      
      // Handle when the user stops sharing the screen
      screenTrack.onended = () => {
        toggleScreenShare();
      };
      
      isScreenSharing = true;
      screenShareBtn.textContent = 'Stop Sharing';
      log('Screen sharing started', 'success');
    }
  } catch (error) {
    log(`Error toggling screen share: ${error.message}`, 'error');
  }
}

// Toggle audio
function toggleAudio() {
  if (localStream) {
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      isAudioMuted = !audioTrack.enabled;
      toggleAudioBtn.textContent = isAudioMuted ? 'Unmute Audio' : 'Mute Audio';
      log(`Audio ${isAudioMuted ? 'muted' : 'unmuted'}`, 'info');
    }
  }
}

// Toggle video
function toggleVideo() {
  if (localStream) {
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      isVideoOff = !videoTrack.enabled;
      toggleVideoBtn.textContent = isVideoOff ? 'Start Video' : 'Stop Video';
      log(`Video ${isVideoOff ? 'stopped' : 'started'}`, 'info');
    }
  }
}

// Copy user ID to clipboard
function copyUserId() {
  userIdInput.select();
  document.execCommand('copy');
  
  const originalText = copyIdBtn.textContent;
  copyIdBtn.textContent = 'Copied!';
  
  setTimeout(() => {
    copyIdBtn.textContent = originalText;
  }, 2000);
  
  log('User ID copied to clipboard', 'success');
}

// Update UI based on connection state
function updateUI(state) {
  switch (state) {
    case 'disconnected':
      startBtn.disabled = true;
      callBtn.disabled = true;
      hangupBtn.disabled = true;
      screenShareBtn.disabled = true;
      toggleAudioBtn.disabled = true;
      toggleVideoBtn.disabled = true;
      break;
      
    case 'ready':
      startBtn.disabled = false;
      callBtn.disabled = true;
      hangupBtn.disabled = true;
      screenShareBtn.disabled = false;
      toggleAudioBtn.disabled = false;
      toggleVideoBtn.disabled = false;
      break;
      
    case 'calling':
      startBtn.disabled = true;
      callBtn.disabled = false;
      hangupBtn.disabled = false;
      screenShareBtn.disabled = true;
      toggleAudioBtn.disabled = true;
      toggleVideoBtn.disabled = true;
      break;
      
    case 'in-call':
      startBtn.disabled = true;
      callBtn.disabled = true;
      hangupBtn.disabled = false;
      screenShareBtn.disabled = false;
      toggleAudioBtn.disabled = false;
      toggleVideoBtn.disabled = false;
      break;
  }
}

// Update status message
function updateStatus(message) {
  statusDiv.textContent = message;
}

// Log messages to the UI
function log(message, type = 'info') {
  const logEntry = document.createElement('p');
  logEntry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
  logEntry.className = type;
  
  logsDiv.insertBefore(logEntry, logsDiv.firstChild);
  
  // Keep only the last 50 log entries
  while (logsDiv.children.length > 50) {
    logsDiv.removeChild(logsDiv.lastChild);
  }
  
  // Auto-scroll to the top
  logsDiv.scrollTop = 0;
}

// WebRTC Event Handlers

// Handle ICE candidate event
function handleICECandidateEvent(event) {
  if (event.candidate) {
    console.log('Sending ICE candidate:', event.candidate);
    const targetId = remoteIdInput.value.trim();
    if (targetId) {
      socket.emit(SocketEvents.ICE_CANDIDATE, {
        to: targetId,
        candidate: event.candidate
      });
    }
  }
}

// Handle ICE connection state change
function handleICEConnectionStateChangeEvent() {
  console.log('ICE Connection State:', peerConnection.iceConnectionState);
  updateStatus(`Connection: ${peerConnection.iceConnectionState}`);
  
  if (peerConnection.iceConnectionState === 'disconnected' || 
      peerConnection.iceConnectionState === 'failed') {
    hangUp();
  }
}

// Handle ICE gathering state change
function handleICEGatheringStateChangeEvent() {
  console.log('ICE Gathering State:', peerConnection.iceGatheringState);
}

// Handle signaling state change
function handleSignalingStateChangeEvent() {
  console.log('Signaling State:', peerConnection.signalingState);
}

// Handle track event (when remote stream is received)
function handleTrackEvent(event) {
  console.log('Track event received:', event.track.kind);
  if (event.streams && event.streams[0]) {
    const stream = event.streams[0];
    remoteVideo.srcObject = stream;
    updateUI('in-call');
    
    // Hide overlay when remote video starts playing
    remoteVideo.onplaying = () => {
      log('Remote video started playing', 'success');
      updateVideoOverlay(remoteVideo, remoteVideoOverlay, false);
    };
    
    // Show overlay if remote video is paused or has issues
    remoteVideo.onpause = remoteVideo.onerror = () => {
      updateVideoOverlay(remoteVideo, remoteVideoOverlay, true, 'Remote video paused or connection lost');
    };
    
    // Handle stream ending
    event.track.onended = () => {
      updateVideoOverlay(remoteVideo, remoteVideoOverlay, true, 'Remote stream ended');
    };
  }
}

// Handle negotiation needed event
async function handleNegotiationNeededEvent() {
  console.log('Negotiation needed, creating offer...');
  try {
    if (isCaller) {
      await createAndSendOffer();
    }
  } catch (error) {
    console.error('Error during negotiation:', error);
    log(`Negotiation error: ${error.message}`, 'error');
  }
}

// Generate a random meeting ID
function generateMeetingId() {
    return 'meet-' + Math.random().toString(36).substr(2, 9);
}

// Show error message in the join screen
function showJoinError(message) {
    const errorElement = document.createElement('div');
    errorElement.className = 'error-message';
    errorElement.textContent = message;
    errorElement.style.color = '#e74c3c';
    errorElement.style.marginTop = '10px';
    
    // Remove any existing error messages
    const existingError = document.querySelector('.error-message');
    if (existingError) {
        existingError.remove();
    }
    
    joinBtn.insertAdjacentElement('afterend', errorElement);
}

// Join a meeting
async function joinMeeting(meetingId, userName, isNewMeeting = false) {
  if (!meetingId || !userName) {
    showJoinError('Please enter both your name and meeting ID');
    return false;
  }
  
  try {
    // Update current user info
    currentUser = {
      name: userName,
      id: 'user-' + Math.random().toString(36).substr(2, 9),
      meetingId: meetingId
    };
    
    // Update UI
    document.title = `${meetingId} - WebRTC Meeting`;
    meetingTitle.textContent = meetingId;
    userIdInput.value = currentUser.id;
    
    // Show the main app and hide join screen
    joinScreen.style.display = 'none';
    appElement.style.display = 'block';
    
    // Show loading state
    updateStatus('Connecting to meeting...', 'info');
    
    // Initialize the connection
    await init();
    
    // If this is a new meeting, we're the host
    if (isNewMeeting) {
      isHost = true;
      updateStatus('Meeting created. Share the meeting ID with others to join.', 'success');
      
      // Copy the meeting ID to clipboard
      navigator.clipboard.writeText(meetingId).then(() => {
        log('Meeting ID copied to clipboard', 'success');
      }).catch(err => {
        console.error('Could not copy meeting ID: ', err);
      });
    }
    
    return true;
  } catch (error) {
    console.error('Error joining meeting:', error);
    showJoinError('Failed to join meeting. Please try again.');
    return false;
  }
}

// Set up all UI event listeners
function setupUIEventListeners() {
  // Start button - get user media
  if (startBtn) {
    startBtn.addEventListener('click', startLocalVideo);
  }
  
  // Call button - initiate call
  if (callBtn) {
    callBtn.addEventListener('click', () => {
      const callToId = callToIdInput ? callToIdInput.value.trim() : '';
      if (callToId) {
        initiateCall(callToId);
      } else {
        updateStatus('Please enter a user ID to call', 'error');
      }
    });
  }
  
  // Hangup button - end call
  if (hangupBtn) {
    hangupBtn.addEventListener('click', hangupCall);
  }
  
  // Copy user ID button
  const copyUserIdBtn = document.getElementById('copyUserId');
  if (copyUserIdBtn) {
    copyUserIdBtn.addEventListener('click', () => {
      if (userIdInput) {
        userIdInput.select();
        document.execCommand('copy');
        updateStatus('User ID copied to clipboard!', 'success');
      }
    });
  }
  
  // Toggle video button
  const toggleVideoBtn = document.getElementById('toggleVideo');
  if (toggleVideoBtn) {
    toggleVideoBtn.addEventListener('click', toggleVideo);
  }
  
  // Toggle audio button
  const toggleAudioBtn = document.getElementById('toggleAudio');
  if (toggleAudioBtn) {
    toggleAudioBtn.addEventListener('click', toggleAudio);
  }
  
  // Toggle fullscreen button
  const toggleFullscreenBtn = document.getElementById('toggleFullscreen');
  if (toggleFullscreenBtn) {
    toggleFullscreenBtn.addEventListener('click', toggleFullscreen);
  }
  
  // Toggle chat button
  const toggleChatBtn = document.getElementById('toggleChat');
  if (toggleChatBtn) {
    toggleChatBtn.addEventListener('click', toggleChat);
  }
  
  // Send message button
  const sendMessageBtn = document.getElementById('sendMessage');
  if (sendMessageBtn) {
    sendMessageBtn.addEventListener('click', sendChatMessage);
  }
  
  // Handle Enter key in message input
  const messageInput = document.getElementById('messageInput');
  if (messageInput) {
    messageInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        sendChatMessage();
      }
    });
  }
  
    // Handle window resize
  window.addEventListener('resize', handleResize);
}

// Start local video stream
async function startLocalVideo() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true
    });
    
    if (localVideo) {
      localVideo.srcObject = localStream;
      updateVideoOverlay(localVideo, localVideoOverlay, false);
      updateUI('localStreamReady');
      updateStatus('Local stream ready', 'success');
    }
    
    return true;
  } catch (error) {
    console.error('Error accessing media devices:', error);
    updateStatus('Error accessing camera/microphone: ' + error.message, 'error');
    return false;
  }
}

// Initiate a call to another user
async function initiateCall(targetId) {
  if (!peerConnection) {
    await createPeerConnection();
  }
  
  try {
    // Add local stream to peer connection
    if (localStream) {
      localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
      });
    }
    
    // Create offer
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    
    // Send offer to the other peer
    socket.emit('call-user', {
      to: targetId,
      signal: peerConnection.localDescription
    });
    
    updateStatus(`Calling ${targetId}...`, 'info');
    updateUI('inCall');
    
  } catch (error) {
    console.error('Error initiating call:', error);
    updateStatus('Error initiating call: ' + error.message, 'error');
  }
}

// Hang up the current call
function hangupCall() {
  // Close peer connection if it exists
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
  
  // Notify the other peer that we're hanging up
  if (socket) {
    socket.emit('end-call');
  }
  
  // Update UI
  updateUI('callEnded');
  updateStatus('Call ended', 'info');
  
  // Clear remote video
  if (remoteVideo && remoteVideo.srcObject) {
    remoteVideo.srcObject.getTracks().forEach(track => track.stop());
    remoteVideo.srcObject = null;
    updateVideoOverlay(remoteVideo, remoteVideoOverlay, true, 'Call ended');
  }
  
  // Reset call UI
  if (callToIdInput) {
    callToIdInput.value = '';
  }
}

// Create a new RTCPeerConnection
async function createPeerConnection() {
  try {
    // Close existing connection if any
    if (peerConnection) {
      peerConnection.close();
    }
    
    // Create a new peer connection
    const configuration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    };
    
    peerConnection = new RTCPeerConnection(configuration);
    
    // Set up event handlers
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        // Send the ICE candidate to the other peer
        socket.emit('ice-candidate', {
          to: callToIdInput ? callToIdInput.value.trim() : '',
          candidate: event.candidate
        });
      }
    };
    
    peerConnection.ontrack = (event) => {
      // Add remote stream to video element
      if (remoteVideo && !remoteVideo.srcObject) {
        remoteVideo.srcObject = event.streams[0];
        updateVideoOverlay(remoteVideo, remoteVideoOverlay, false);
      }
    };
    
    peerConnection.onconnectionstatechange = () => {
      console.log('Connection state changed:', peerConnection.connectionState);
      
      if (peerConnection.connectionState === 'disconnected' ||
          peerConnection.connectionState === 'failed') {
        hangupCall();
      }
    };
    
    return true;
    
  } catch (error) {
    console.error('Error creating peer connection:', error);
    updateStatus('Error creating connection: ' + error.message, 'error');
    return false;
  }
}

// Toggle video stream
function toggleVideo() {
  if (localStream) {
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      updateStatus(`Video ${videoTrack.enabled ? 'enabled' : 'disabled'}`, 'info');
    }
  }
}

// Toggle audio stream
function toggleAudio() {
  if (localStream) {
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      updateStatus(`Audio ${audioTrack.enabled ? 'enabled' : 'muted'}`, 'info');
    }
  }
}

// Toggle fullscreen mode
function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(err => {
      console.error('Error attempting to enable fullscreen:', err);
    });
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    }
  }
}

// Toggle chat panel
function toggleChat() {
  const chatPanel = document.getElementById('chatPanel');
  if (chatPanel) {
    chatPanel.classList.toggle('hidden');
  }
}

// Send chat message
function sendChatMessage() {
  const messageInput = document.getElementById('messageInput');
  if (!messageInput || !messageInput.value.trim()) return;
  
  const message = messageInput.value.trim();
  const chatMessages = document.getElementById('chatMessages');
  
  // Add message to chat UI
  if (chatMessages) {
    const messageElement = document.createElement('div');
    messageElement.className = 'chat-message';
    messageElement.textContent = `${currentUser.name}: ${message}`;
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
  
  // In a real app, you would send this message to other participants via WebSocket
  // socket.emit('chat-message', { message });
  
  // Clear input
  messageInput.value = '';
}

// Handle window resize
function handleResize() {
  // Update UI elements on window resize
  // This can be expanded based on your UI needs
  console.log('Window resized');
}

// Initialize the application
async function init() {
  try {
    // Set up UI event listeners first
    setupUIEventListeners();
    
    // Show initializing state
    updateStatus('Initializing...', 'info');
    updateVideoOverlay(localVideo, localVideoOverlay, true, 'Initializing...');
    
    // Check if WebRTC is supported
    if (!isWebRTCSupported()) {
      const isFirefox = navigator.userAgent.includes('Firefox');
      let errorMsg = 'Your browser has limited WebRTC support. ';
      
      if (isFirefox) {
        errorMsg += 'Firefox requires HTTPS for camera access. ';
        errorMsg += 'Please try using Chrome, or access this page via localhost.';
      } else {
        errorMsg += 'Please use a modern browser like Chrome, Firefox, or Edge, ';
        errorMsg += 'and ensure you\'re using HTTPS or localhost.';
      }
      
      updateVideoOverlay(localVideo, localVideoOverlay, true, 'WebRTC Not Supported');
      updateStatus(errorMsg, 'error');
      
      // Add a button to try anyway
      const tryButton = document.createElement('button');
      tryButton.textContent = 'Try Anyway';
      tryButton.className = 'btn btn-warning mt-2';
      tryButton.onclick = async () => {
        try {
          updateStatus('Trying to initialize anyway...', 'info');
          await startLocalVideo();
          updateUI('ready');
        } catch (e) {
          console.error('Initialization failed:', e);
          updateStatus('Failed to initialize: ' + (e.message || 'Unknown error'), 'error');
        }
      };
      
      const errorContainer = document.createElement('div');
      errorContainer.className = 'text-center mt-3';
      errorContainer.appendChild(tryButton);
      statusDiv.appendChild(errorContainer);
      
      throw new Error('WebRTC not supported: ' + errorMsg);
    }
    
    // Connect to the signaling server
    connectToSignalingServer();
    
    // Start local video
    await startLocalVideo();
    
    // Update UI
    updateUI('ready');
    
  } catch (error) {
    console.error('Error initializing application:', error);
    updateStatus('Error initializing: ' + (error.message || 'Unknown error'), 'error');
    updateVideoOverlay(localVideo, localVideoOverlay, true, 'Initialization Failed');
  }
}

// Check for WebRTC support
function isWebRTCSupported() {
  return !!(
    window.RTCPeerConnection ||
    window.mozRTCPeerConnection ||
    window.webkitRTCPeerConnection
  );
}

// Initialize the application when the page loads
window.addEventListener('load', () => {
  try {
    // Show loading state
    updateStatus('Initializing...');
    updateVideoOverlay(localVideo, localVideoOverlay, true, 'Initializing...');
    
    // Log environment information
    console.log('Page loaded. Environment:', {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      isSecureContext: window.isSecureContext,
      location: window.location.href,
      protocol: window.location.protocol
    });
    
    // Check for WebRTC support first
    if (!isWebRTCSupported()) {
      const errorMsg = 'WebRTC is not supported in this browser. Please use a modern browser like Chrome, Firefox, or Edge.';
      updateVideoOverlay(localVideo, localVideoOverlay, true, 'Browser Not Supported');
      updateVideoOverlay(remoteVideo, remoteVideoOverlay, true, 'Use Chrome/Firefox/Edge');
      updateStatus(errorMsg, 'error');
      
      // Add a button to try anyway for debugging
      const tryButton = document.createElement('button');
      tryButton.textContent = 'Try Anyway';
      tryButton.className = 'btn btn-warning mt-2';
      tryButton.onclick = () => {
        updateStatus('Trying to initialize anyway...');
        init().catch(e => console.error('Initialization failed:', e));
      };
      statusDiv.appendChild(document.createElement('br'));
      statusDiv.appendChild(tryButton);
      return;
    }

    // Set up event listeners for the join form
    joinBtn.addEventListener('click', async () => {
      try {
        const displayName = displayNameInput.value.trim();
        const meetingId = meetingIdInput.value.trim();
        
        if (!displayName) {
          alert('Please enter your name');
          return;
        }
        
        if (!meetingId) {
          alert('Please enter a meeting ID');
          return;
        }
        
        updateStatus('Joining meeting...');
        await joinMeeting(meetingId, displayName);
      } catch (error) {
        console.error('Error joining meeting:', error);
        updateStatus('Error joining meeting: ' + (error.message || 'Unknown error'), 'error');
      }
    });
    
    // Create meeting button
    createMeetingBtn.addEventListener('click', (e) => {
      try {
        e.preventDefault();
        const displayName = displayNameInput.value.trim();
        
        if (!displayName) {
          alert('Please enter your name');
          return;
        }
        
        updateStatus('Creating new meeting...');
        const newMeetingId = generateMeetingId();
        meetingIdInput.value = newMeetingId;
        joinMeeting(newMeetingId, displayName, true);
      } catch (error) {
        console.error('Error creating meeting:', error);
        updateStatus('Error creating meeting: ' + (error.message || 'Unknown error'), 'error');
      }
    });
    
    // Initialize the app
    init().catch(error => {
      console.error('Initialization failed:', error);
      updateStatus('Initialization failed: ' + (error.message || 'Unknown error'), 'error');
    });
    
  } catch (error) {
    console.error('Error in page load handler:', error);
    updateStatus('Fatal error: ' + (error.message || 'Unknown error'), 'error');
    updateVideoOverlay(localVideo, localVideoOverlay, true, 'Fatal Error');
  }

  // Allow pressing Enter in the name field to join
  displayNameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      joinBtn.click();
    }
  });

  // Allow pressing Enter in the meeting ID field to join
  meetingIdInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      joinBtn.click();
    }
  });
  
  // Generate a random username by default
  const randomName = 'User-' + Math.floor(1000 + Math.random() * 9000);
  displayNameInput.value = randomName;
  
  // Generate a random meeting ID by default
  meetingIdInput.value = generateMeetingId();
  
  // Focus on the name input
  displayNameInput.focus();
  
  // Show loading overlay initially
  updateVideoOverlay(localVideo, localVideoOverlay, true, 'Loading camera...');
  updateVideoOverlay(remoteVideo, remoteVideoOverlay, true, 'Waiting for connection...');
  
  // Initialize the application
  init();
  
  // Check if we're on HTTPS or localhost
  const isLocalhost = window.location.hostname === 'localhost' || 
                     window.location.hostname === '127.0.0.1' ||
                     window.location.hostname === '192.168.1.5'; // Add your local IP
  const isHttps = window.location.protocol === 'https:';
  
  if (!isLocalhost && !isHttps) {
    const warningMsg = '⚠️ Camera access typically requires HTTPS or localhost. ' + 
                      'Some features may not work. Try using http://localhost:3000 instead.';
    log(warningMsg, 'warning');
    statusDiv.textContent = warningMsg;
    
    // Add a button to try anyway
    const tryAnyway = document.createElement('button');
    tryAnyway.textContent = 'Try Anyway';
    tryAnyway.className = 'btn';
    tryAnyway.style.marginTop = '10px';
    tryAnyway.onclick = () => {
      statusDiv.textContent = 'Attempting to access camera...';
      init();
    };
    statusDiv.appendChild(document.createElement('br'));
    statusDiv.appendChild(tryAnyway);
    return;
  }
  
  // Initialize the app
  init();
});

// Handle page unload
window.addEventListener('beforeunload', () => {
  if (peerConnection) {
    peerConnection.close();
  }
  if (socket) {
    socket.disconnect();
  }
});

// Handle page visibility change
// document.addEventListener('visibilitychange', () => {
//   if (document.hidden) {
//     // Page is hidden, pause video
//     if (localVideo.srcObject) {
//       localVideo.pause();
//     }
//   } else {
//     // Page is visible, play video
//     if (localVideo.srcObject) {
//       localVideo.play().catch(e => console.error('Error resuming video:', e));
//     }
//   }
// });
