import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import { ClientToServerEvents, ServerToClientEvents } from '@fssphone/shared';
import { ControllerRegistry } from './services/ControllerRegistry';
import { CallManager } from './services/CallManager';
import { SignalingService } from './services/SignalingService';
import authRouter from './routes/auth';
import { socketAuth } from './middleware/socketAuth';

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

const app = express();
const httpServer = createServer(app);
const io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: CLIENT_URL,
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(cors({ origin: CLIENT_URL }));
app.use(express.json());

// Auth routes
app.use('/auth', authRouter);

// Services
const controllerRegistry = new ControllerRegistry();
const callManager = new CallManager();
const signalingService = new SignalingService(io);

// Basic health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    controllers: controllerRegistry.getAll().length,
    activeCalls: callManager.getActive().length
  });
});

// Socket.IO auth middleware
io.use(socketAuth);

// Socket.IO connection handling
io.on('connection', (socket) => {
  const user = socket.data.user;
  console.log(`Client connected: ${socket.id} (CID: ${user.cid})`);

  // Send current controller list to new client
  socket.emit('controllers:list', controllerRegistry.getAll());

  // Controller Registration
  socket.on('controller:register', (data) => {
    try {
      const controller = controllerRegistry.register(socket.id, data, user.cid, user.name);
      socket.emit('controller:updated', controller);
      // Broadcast updated controller list to all clients
      io.emit('controllers:list', controllerRegistry.getAll());
    } catch (error) {
      console.error('Error registering controller:', error);
      socket.emit('error', 'Failed to register as controller');
    }
  });

  // Controller Unregistration
  socket.on('controller:unregister', () => {
    const controller = controllerRegistry.findBySocketId(socket.id);
    if (controller) {
      controllerRegistry.unregister(controller.id);
      io.emit('controller:removed', controller.id);
      io.emit('controllers:list', controllerRegistry.getAll());
    }
  });

  // Call Initiation (from Pilot)
  socket.on('call:initiate', (data) => {
    try {
      const controller = controllerRegistry.findById(data.controllerId);

      if (!controller) {
        socket.emit('error', 'Controller not found');
        return;
      }

      if (controller.status === 'busy') {
        socket.emit('error', 'Controller is busy');
        return;
      }

      // Check if pilot already has an active call
      const existingCall = callManager.findByPilot(socket.id);
      if (existingCall) {
        socket.emit('error', 'You already have an active call');
        return;
      }

      // Create call
      const call = callManager.create(socket.id, user.cid, data);

      // Update controller status
      controllerRegistry.updateStatus(controller.id, 'busy');
      io.emit('controller:updated', controller);

      // Notify pilot that call is ringing
      socket.emit('call:ringing', call);

      // Notify controller of incoming call
      io.to(controller.socketId).emit('call:incoming', call);

    } catch (error) {
      console.error('Error initiating call:', error);
      socket.emit('error', 'Failed to initiate call');
    }
  });

  // Call Answer (from Controller)
  socket.on('call:answer', (callId) => {
    try {
      const call = callManager.findById(callId);

      if (!call) {
        socket.emit('error', 'Call not found');
        return;
      }

      // Update call status
      callManager.updateStatus(callId, 'active');

      // Notify both parties
      io.to(call.pilotId).emit('call:established', call);
      socket.emit('call:established', call);

    } catch (error) {
      console.error('Error answering call:', error);
      socket.emit('error', 'Failed to answer call');
    }
  });

  // Call Reject (from Controller)
  socket.on('call:reject', (callId) => {
    try {
      const call = callManager.findById(callId);

      if (!call) {
        socket.emit('error', 'Call not found');
        return;
      }

      // End the call
      callManager.end(callId);

      // Update controller status
      const controller = controllerRegistry.findById(call.controllerId);
      if (controller) {
        controllerRegistry.updateStatus(controller.id, 'online');
        io.emit('controller:updated', controller);
      }

      // Notify pilot
      io.to(call.pilotId).emit('call:ended', callId, 'Call rejected');

    } catch (error) {
      console.error('Error rejecting call:', error);
      socket.emit('error', 'Failed to reject call');
    }
  });

  // Call Hangup (from either party)
  socket.on('call:hangup', (callId) => {
    try {
      const call = callManager.findById(callId);

      if (!call) {
        return; // Call already ended
      }

      // End the call
      callManager.end(callId);

      // Update controller status
      const controller = controllerRegistry.findById(call.controllerId);
      if (controller) {
        controllerRegistry.updateStatus(controller.id, 'online');
        io.emit('controller:updated', controller);
      }

      // Notify both parties
      io.to(call.pilotId).emit('call:ended', callId);
      io.to(controller?.socketId || '').emit('call:ended', callId);

    } catch (error) {
      console.error('Error hanging up call:', error);
    }
  });

  // WebRTC Signaling - Offer
  socket.on('webrtc:offer', (data) => {
    signalingService.relayOffer(data);
  });

  // WebRTC Signaling - Answer
  socket.on('webrtc:answer', (data) => {
    signalingService.relayAnswer(data);
  });

  // WebRTC Signaling - ICE Candidate
  socket.on('webrtc:ice-candidate', (data) => {
    signalingService.relayICECandidate(data);
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);

    // Check if disconnected client was a controller
    const controller = controllerRegistry.findBySocketId(socket.id);
    if (controller) {
      // End any active call with this controller
      const call = callManager.findByController(controller.id);
      if (call) {
        callManager.end(call.id);
        io.to(call.pilotId).emit('call:ended', call.id, 'Controller disconnected');
      }

      controllerRegistry.unregister(controller.id);
      io.emit('controller:removed', controller.id);
      io.emit('controllers:list', controllerRegistry.getAll());
    }

    // Check if disconnected client was a pilot with an active call
    const call = callManager.findByPilot(socket.id);
    if (call) {
      const controller = controllerRegistry.findById(call.controllerId);
      if (controller) {
        controllerRegistry.updateStatus(controller.id, 'online');
        io.emit('controller:updated', controller);
        io.to(controller.socketId).emit('call:ended', call.id, 'Pilot disconnected');
      }
      callManager.end(call.id);
    }
  });
});

const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () => {
  console.log(`FSS Phone Server running on port ${PORT}`);
  console.log(`Accepting connections from: ${CLIENT_URL}`);
});
