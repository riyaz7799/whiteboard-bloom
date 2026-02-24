require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const session = require('express-session');
const passport = require('passport');

const authRoutes = require('./routes/auth');
const boardRoutes = require('./routes/boards');
const { setupSocket } = require('./socket');
const { initDB } = require('./db');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());

app.use(session({
  secret: process.env.SESSION_SECRET || 'whiteboard-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, httpOnly: true, maxAge: 24 * 60 * 60 * 1000 },
}));

app.use(passport.initialize());
app.use(passport.session());
require('./config/passport');

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/boards', boardRoutes);

setupSocket(io);

const PORT = process.env.PORT || 3001;

initDB().then(() => {
  server.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
}).catch(err => { console.error('DB init failed:', err); process.exit(1); });