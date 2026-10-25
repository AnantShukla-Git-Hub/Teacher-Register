import { io } from 'socket.io-client';

// Use same host or proxy
const socket = io('/', {
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
});

export default socket;
