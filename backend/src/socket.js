const roomUsers = {};

function setupSocket(io) {
  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    // Join a board room
    socket.on('joinRoom', ({ boardId, userName, userColor }) => {
      socket.join(boardId);

      if (!roomUsers[boardId]) roomUsers[boardId] = {};
      
      const user = {
        id: socket.id,
        name: userName || `User-${socket.id.substring(0, 4)}`,
        color: userColor || '#00d4ff',
      };

      roomUsers[boardId][socket.id] = user;
      socket.currentRoom = boardId;
      socket.userName = user.name;
      socket.userColor = user.color;

      // Notify others that user joined
      socket.to(boardId).emit('userJoined', { name: user.name });

      // Broadcast updated user list to room
      io.to(boardId).emit('roomUsers', {
        users: Object.values(roomUsers[boardId]),
      });

      console.log(`${user.name} joined room ${boardId}`);
    });

    // Cursor movement
    socket.on('cursorMove', ({ x, y, name, color }) => {
      const boardId = socket.currentRoom;
      if (!boardId) return;

      socket.to(boardId).emit('cursorUpdate', {
        userId: socket.id,
        name: name || socket.userName || 'Anonymous',
        color: color || socket.userColor || '#00d4ff',
        x,
        y,
      });
    });

    // Drawing (pen tool)
    socket.on('draw', (data) => {
      const boardId = socket.currentRoom;
      if (!boardId) return;
      socket.to(boardId).emit('drawUpdate', data);
    });

    // Add object (rectangle, text etc)
    socket.on('addObject', (data) => {
      const boardId = socket.currentRoom;
      if (!boardId) return;
      socket.to(boardId).emit('objectAdded', data);
    });

    // Chat message
    socket.on('chatMessage', ({ boardId, ...msg }) => {
      if (!boardId) return;
      socket.to(boardId).emit('chatMessage', msg);
    });

    // Disconnect
    socket.on('disconnect', () => {
      const boardId = socket.currentRoom;
      if (boardId && roomUsers[boardId]) {
        const userName = roomUsers[boardId][socket.id]?.name;
        delete roomUsers[boardId][socket.id];

        // Remove cursor
        io.to(boardId).emit('cursorRemove', { userId: socket.id });

        // Notify others
        if (userName) {
          io.to(boardId).emit('userLeft', { name: userName });
        }

        // Update user list
        io.to(boardId).emit('roomUsers', {
          users: Object.values(roomUsers[boardId]),
        });

        if (Object.keys(roomUsers[boardId]).length === 0) {
          delete roomUsers[boardId];
        }
      }
      console.log('Client disconnected:', socket.id);
    });
  });
}

module.exports = { setupSocket };