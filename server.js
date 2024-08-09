const express = require('express');
const app = express();
const http = require('http');
const { Server } = require('socket.io');
const EVENTS = require('./events');

const server = http.createServer(app);
const io = new Server(server);

const users = {};

// Takes a room id and returns an array of users in that room
// io.sockets.adapter.rooms.get(roomId): This retrieves all the socketIds of the users currently connected to the room with the specified roomId.
// The io.sockets.adapter.rooms object holds information about all the rooms and the socketIds of the users in those rooms.
const getAllUsersInRoom = (roomId) => {
  return Array.from(io.sockets.adapter.rooms.get(roomId) || []).map(
    (socketId) => {
      return {
        socketId,
        user: {
          theme: users[socketId].theme,
          username: users[socketId].username,
        },
      };
    }
  );
}

io.on('connection', (currentSocket) => {
  currentSocket.on(EVENTS.JOIN, ({
    roomId,
    theme,
    username,
  }) => {
    users[currentSocket.id] = {
      theme,
      username,
    };
    currentSocket.join(roomId);
    const editors = getAllUsersInRoom(roomId);

    editors.forEach((editor) => {
      io.to(editor.socketId).emit(EVENTS.JOINED, {
        editors,
        socketId: currentSocket.id,
        user: users[currentSocket.id],
      });
    });
  });

  currentSocket.on(EVENTS.CODE_CHANGE, ({ roomId, code }) => {
    currentSocket.in(roomId).emit(EVENTS.CODE_CHANGE, { code });
  });

  currentSocket.on(EVENTS.SYNC_CODE, ({ socketId, code }) => {
    io.to(socketId).emit(EVENTS.CODE_CHANGE, { code });
  });

  currentSocket.on(EVENTS.CURSOR_POSITION_CHANGE, ({
    cursor,
    cursorCoords,
    roomId,
  }) => {
    const user = users[currentSocket.id];
    currentSocket.in(roomId).emit(EVENTS.CURSOR_POSITION_CHANGE, {
      cursor,
      cursorCoords,
      socketId: currentSocket.id,
      user,
    });
  });

  currentSocket.on('disconnecting', () => {
    const rooms = Array.from(currentSocket.rooms);
    rooms.forEach((roomId) => {
      currentSocket.in(roomId).emit(EVENTS.DISCONNECTED, {
        socketId: currentSocket.id,
        user: users[currentSocket.id],
      });
    });

    delete users[currentSocket.id];

    currentSocket.leave();
  });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => console.log(`Server is listening on port ${PORT}`));
