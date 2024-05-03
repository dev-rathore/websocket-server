const express = require('express');
const app = express();
const http = require('http');
const { Server } = require('socket.io');
const EVENTS = require('./events');

const server = http.createServer(app);
const io = new Server(server);

const users = {};
const getAllUsersInRoom = (roomId) => {
  return Array.from(io.sockets.adapter.rooms.get(roomId) || []).map(
    (socketId) => {
      return {
        socketId,
        username: users[socketId],
      };
    }
  );
}

io.on('connection', (currentSocket) => {
  currentSocket.on(EVENTS.JOIN, ({
    roomId,
    username,
  }) => {
    users[currentSocket.id] = username;
    currentSocket.join(roomId);
    const editors = getAllUsersInRoom(roomId);
    editors.forEach((editor) => {
      io.to(editor.socketId).emit(EVENTS.JOINED, {
        editors,
        socketId: currentSocket.id,
        username,
      });
    });
  });

  currentSocket.on(EVENTS.CODE_CHANGE, ({ roomId, code }) => {
    currentSocket.in(roomId).emit(EVENTS.CODE_CHANGE, { code });
  });

  currentSocket.on(EVENTS.SYNC_CODE, ({ socketId, code }) => {
    io.to(socketId).emit(EVENTS.CODE_CHANGE, { code });
  });

  currentSocket.on('disconnecting', () => {
    const rooms = [...currentSocket.rooms];
    rooms.forEach((roomId) => {
      currentSocket.in(roomId).emit(EVENTS.DISCONNECTED, {
        socketId: currentSocket.id,
        username: users[currentSocket.id],
      });
    });

    delete users[currentSocket.id];

    currentSocket.leave();
  });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => console.log(`Server is listening on port ${PORT}`));
