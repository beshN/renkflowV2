/**
 * RenkFlow WebSocket Server
 * Real-time communication for orders, presence, and sync
 */

import express from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const PORT = process.env.WS_PORT || 3001;
const CORS_ORIGIN = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

// ============================================
// Types
// ============================================

interface JoinPayload {
  room: string;
  userId: string;
  userName: string;
  tenantId?: string;
}

interface RealtimeEvent {
  type: string;
  room: string;
  userId: string;
  userName: string;
  timestamp: number;
  version: number;
  payload: unknown;
}

interface PresenceUser {
  id: string;
  name: string;
  socketId: string;
  room: string;
  status: 'online' | 'away' | 'busy';
  viewingOrderId?: string;
  lastSeen: number;
}

interface TypingPayload {
  userId: string;
  userName: string;
  isTyping: boolean;
  entityType: string;
  entityId: string;
}

interface ViewingPayload {
  userId: string;
  orderId: string | null;
}

// ============================================
// Server Setup
// ============================================

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: CORS_ORIGIN,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

// ============================================
// State Management
// ============================================

const rooms = new Map<string, Set<string>>(); // room -> socketIds
const users = new Map<string, PresenceUser>(); // socketId -> user
const typingUsers = new Map<string, NodeJS.Timeout>(); // `${room}:${userId}` -> timeout

// ============================================
// Helper Functions
// ============================================

function getRoomUsers(room: string): PresenceUser[] {
  const socketIds = rooms.get(room);
  if (!socketIds) return [];
  
  return Array.from(socketIds)
    .map((id) => users.get(id))
    .filter((u): u is PresenceUser => !!u);
}

function broadcastPresence(room: string): void {
  const roomUsers = getRoomUsers(room);
  io.to(room).emit('presence', roomUsers);
}

function generateEventId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================
// Socket.IO Connection Handler
// ============================================

io.on('connection', (socket: Socket) => {
  console.log(`[WS] Client connected: ${socket.id}`);

  // ----------------------------------------
  // Join Room
  // ----------------------------------------
  socket.on('join', (payload: JoinPayload) => {
    const { room, userId, userName, tenantId } = payload;
    
    // Leave previous rooms
    socket.rooms.forEach((r) => {
      if (r !== socket.id) {
        socket.leave(r);
        rooms.get(r)?.delete(socket.id);
      }
    });

    // Join new room
    socket.join(room);
    
    if (!rooms.has(room)) {
      rooms.set(room, new Set());
    }
    rooms.get(room)!.add(socket.id);

    // Register user presence
    users.set(socket.id, {
      id: userId,
      name: userName,
      socketId: socket.id,
      room,
      status: 'online',
      lastSeen: Date.now(),
    });

    console.log(`[WS] User ${userName} (${userId}) joined room: ${room}`);
    
    // Broadcast presence update
    broadcastPresence(room);

    // Notify others
    socket.to(room).emit('event', {
      id: generateEventId(),
      type: 'user:joined',
      room,
      userId,
      userName,
      tenantId,
      timestamp: Date.now(),
      version: 1,
      payload: { userId, userName },
    });
  });

  // ----------------------------------------
  // Leave Room
  // ----------------------------------------
  socket.on('leave', (payload: { room: string }) => {
    const { room } = payload;
    const user = users.get(socket.id);
    
    socket.leave(room);
    rooms.get(room)?.delete(socket.id);
    
    if (user) {
      console.log(`[WS] User ${user.name} left room: ${room}`);
      
      socket.to(room).emit('event', {
        id: generateEventId(),
        type: 'user:left',
        room,
        userId: user.id,
        userName: user.name,
        timestamp: Date.now(),
        version: 1,
        payload: { userId: user.id, userName: user.name },
      });
      
      broadcastPresence(room);
    }
  });

  // ----------------------------------------
  // Real-time Event
  // ----------------------------------------
  socket.on('event', (event: RealtimeEvent) => {
    const { room, type } = event;
    
    const fullEvent = {
      ...event,
      id: generateEventId(),
      timestamp: Date.now(),
    };

    // Broadcast to room (except sender)
    socket.to(room).emit('event', fullEvent);
    
    console.log(`[WS] Event ${type} in room ${room}`);
  });

  // ----------------------------------------
  // Presence Update
  // ----------------------------------------
  socket.on('presence', (payload: Partial<PresenceUser>) => {
    const user = users.get(socket.id);
    if (user) {
      Object.assign(user, payload, { lastSeen: Date.now() });
      broadcastPresence(user.room);
    }
  });

  // ----------------------------------------
  // Typing Indicator
  // ----------------------------------------
  socket.on('typing', (payload: TypingPayload) => {
    const user = users.get(socket.id);
    if (!user) return;

    const key = `${user.room}:${payload.userId}`;
    
    // Clear existing timeout
    if (typingUsers.has(key)) {
      clearTimeout(typingUsers.get(key)!);
    }

    if (payload.isTyping) {
      // Set auto-clear timeout (5 seconds)
      typingUsers.set(key, setTimeout(() => {
        socket.to(user.room).emit('typing', { ...payload, isTyping: false });
        typingUsers.delete(key);
      }, 5000));
    }

    socket.to(user.room).emit('typing', payload);
  });

  // ----------------------------------------
  // Viewing Order
  // ----------------------------------------
  socket.on('viewing', (payload: ViewingPayload) => {
    const user = users.get(socket.id);
    if (user) {
      user.viewingOrderId = payload.orderId || undefined;
      broadcastPresence(user.room);
    }
  });

  // ----------------------------------------
  // Cursor Position (for collaborative editing)
  // ----------------------------------------
  socket.on('cursor', (payload: { userId: string; x: number; y: number; elementId?: string }) => {
    const user = users.get(socket.id);
    if (user) {
      socket.to(user.room).emit('cursor', payload);
    }
  });

  // ----------------------------------------
  // Ping/Pong for Latency
  // ----------------------------------------
  socket.on('ping', () => {
    socket.emit('pong', Date.now());
  });

  // ----------------------------------------
  // Disconnect
  // ----------------------------------------
  socket.on('disconnect', (reason) => {
    const user = users.get(socket.id);
    
    if (user) {
      console.log(`[WS] User ${user.name} disconnected: ${reason}`);
      
      // Notify room
      socket.to(user.room).emit('event', {
        id: generateEventId(),
        type: 'user:left',
        room: user.room,
        userId: user.id,
        userName: user.name,
        timestamp: Date.now(),
        version: 1,
        payload: { userId: user.id, userName: user.name, reason },
      });

      // Clean up
      rooms.get(user.room)?.delete(socket.id);
      broadcastPresence(user.room);
    }

    users.delete(socket.id);
  });
});

// ============================================
// Health Check Endpoint
// ============================================

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    connections: io.engine.clientsCount,
    rooms: rooms.size,
    timestamp: new Date().toISOString(),
  });
});

app.get('/stats', (req, res) => {
  const roomStats: Record<string, number> = {};
  rooms.forEach((sockets, room) => {
    roomStats[room] = sockets.size;
  });

  res.json({
    totalConnections: io.engine.clientsCount,
    totalRooms: rooms.size,
    roomStats,
    activeUsers: users.size,
  });
});

// ============================================
// Start Server
// ============================================

httpServer.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🚀 RenkFlow WebSocket Server                            ║
║                                                           ║
║   Port: ${PORT}                                            ║
║   CORS: ${CORS_ORIGIN}                        
║                                                           ║
║   Endpoints:                                              ║
║   • Health: http://localhost:${PORT}/health                ║
║   • Stats:  http://localhost:${PORT}/stats                 ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
  `);
});

// ============================================
// Graceful Shutdown
// ============================================

process.on('SIGTERM', () => {
  console.log('[WS] SIGTERM received, shutting down...');
  
  io.close(() => {
    console.log('[WS] All connections closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('[WS] SIGINT received, shutting down...');
  
  io.close(() => {
    console.log('[WS] All connections closed');
    process.exit(0);
  });
});

export { io, httpServer };
