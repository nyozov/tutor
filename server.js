const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const crypto = require('crypto');

// 1. SETUP
const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*', // frontend url 
    methods: ['GET', 'POST']
  }
});

const rooms = new Map();

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('create-room', () => {
    const roomId = crypto.randomBytes(4).toString('hex'); // e.g., "a3f2b1c4"
    
    rooms.set(roomId, {
      participants: new Set([socket.id]),
      events: []
    });
    
    socket.join(roomId);
    socket.emit('room-created', { roomId });
    console.log(`Room ${roomId} created by ${socket.id}`);
  });

  socket.on('join-room', (roomId) => {
    const room = rooms.get(roomId);
    
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }
    
    socket.join(roomId);
    room.participants.add(socket.id);
    
    socket.emit('whiteboard-state', { events: room.events });
    
    socket.to(roomId).emit('user-joined', { userId: socket.id });
    console.log(`${socket.id} joined room ${roomId}`);
  });

  socket.on('draw', ({ roomId, points, color, tool }) => {
    const room = rooms.get(roomId);
    
    if (!room) return;
    
    const drawEvent = { points, color, tool, timestamp: Date.now() };
    room.events.push(drawEvent);
    
    socket.to(roomId).emit('draw', drawEvent);
  });

  socket.on('webrtc-signal', ({ roomId, signal }) => {
    socket.to(roomId).emit('webrtc-signal', { signal, from: socket.id });
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    
    rooms.forEach((room, roomId) => {
      if (room.participants.has(socket.id)) {
        room.participants.delete(socket.id);
        
        if (room.participants.size === 0) {
          // Last person left - delete room
          rooms.delete(roomId);
          console.log(`Room ${roomId} deleted (empty)`);
        } else {
          socket.to(roomId).emit('user-left', { userId: socket.id });
        }
      }
    });
  });
});
 


const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});