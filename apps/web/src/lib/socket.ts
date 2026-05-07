import { io, Socket } from 'socket.io-client';
import { API_URL, getToken } from './api';

let socket: Socket | null = null;

export function getSocket() {
  const token = getToken();
  if (!token) {
    return null;
  }

  if (!socket) {
    socket = io(API_URL, {
      auth: { token },
      transports: ['websocket'],
    });
  }

  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
