/**
 * Socket.IO Server for Real-time Order Updates
 * 
 * Features:
 * - Real-time order status updates
 * - Room-based tenant isolation
 * - Connection authentication
 * - Automatic reconnection
 */

import { Server as NetServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { NextApiRequest } from 'next';
import jwt from 'jsonwebtoken';

export const config = {
  api: {
    bodyParser: false,
  },
};

interface SocketServer extends NetServer {
  io?: SocketIOServer;
}

interface SocketWithIO {
  socket: {
    server: SocketServer;
  };
}

// Initialize Socket.IO server
export function initSocketServer(server: NetServer): SocketIOServer {
  const io = new SocketIOServer(server, {
    path: '/api/socket',
    addTrailingSlash: false,
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL || '*',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.query.token;
      
      if (!token) {
        return next(new Error('Authentication error: Token required'));
      }

      // Verify token with JWT
      const decoded = jwt.verify(token as string, process.env.NEXTAUTH_SECRET!) as {
        id: string;
        tenantId: string;
        email: string;
      };

      if (!decoded) {
        return next(new Error('Authentication error: Invalid token'));
      }

      // Attach user data to socket
      socket.data.user = decoded;
      socket.data.tenantId = decoded.tenantId;
      
      next();
    } catch (error) {
      next(new Error('Authentication error'));
    }
  });

  // Connection handler
  io.on('connection', (socket) => {
    const { user, tenantId } = socket.data;
    
    console.log(`[Socket] Client connected: ${socket.id}, Tenant: ${tenantId}`);

    // Join tenant-specific room
    if (tenantId) {
      socket.join(`tenant:${tenantId}`);
      console.log(`[Socket] Client ${socket.id} joined room: tenant:${tenantId}`);
    }

    // Handle order updates
    socket.on('order:update', (data) => {
      const { orderId, status, updates } = data;
      
      // Broadcast to all clients in the same tenant
      socket.to(`tenant:${tenantId}`).emit('order:updated', {
        orderId,
        status,
        updates,
        updatedBy: user.id,
        timestamp: new Date().toISOString(),
      });
    });

    // Handle new order creation
    socket.on('order:create', (data) => {
      socket.to(`tenant:${tenantId}`).emit('order:created', {
        order: data,
        createdBy: user.id,
        timestamp: new Date().toISOString(),
      });
    });

    // Handle order deletion
    socket.on('order:delete', (data) => {
      const { orderId } = data;
      
      socket.to(`tenant:${tenantId}`).emit('order:deleted', {
        orderId,
        deletedBy: user.id,
        timestamp: new Date().toISOString(),
      });
    });

    // Handle status change
    socket.on('order:statusChange', (data) => {
      const { orderId, oldStatus, newStatus } = data;
      
      socket.to(`tenant:${tenantId}`).emit('order:statusChanged', {
        orderId,
        oldStatus,
        newStatus,
        changedBy: user.id,
        timestamp: new Date().toISOString(),
      });
    });

    // Ping for connection health check
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: Date.now() });
    });

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      console.log(`[Socket] Client disconnected: ${socket.id}, Reason: ${reason}`);
    });

    // Error handling
    socket.on('error', (error) => {
      console.error(`[Socket] Error for client ${socket.id}:`, error);
    });
  });

  return io;
}

// Get or create Socket.IO instance
export function getSocketIO(server: NetServer): SocketIOServer {
  const socketServer = server as SocketServer;
  
  if (!socketServer.io) {
    socketServer.io = initSocketServer(server);
  }
  
  return socketServer.io;
}
