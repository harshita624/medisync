'use strict';
const express    = require('express');
const http       = require('http');
const cors       = require('cors');
const mongoose   = require('mongoose');
const path       = require('path');
const morgan     = require('morgan');
const rateLimit  = require('express-rate-limit');
const { Server } = require('socket.io');
require('dotenv').config();

const seedDanaShivamDoctors = require('./utils/seedDanaShivamDoctors');

const app    = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: [
      process.env.FRONTEND_URL || 'http://localhost:3000',
      'http://localhost:3001','http://localhost:3002','http://localhost:3003',
    ],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
});

io.on('connection', socket => {
  socket.on('join',      userId   => { if (userId)   socket.join(`user:${userId}`);    });
  socket.on('joinQueue', doctorId => { if (doctorId) socket.join(`queue:${doctorId}`); });
  socket.on('disconnect', () => {});
});

app.set('io', io);

app.use(cors({ origin: (origin, cb) => cb(null, true), credentials: true }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(morgan('dev'));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use('/api/', rateLimit({
  windowMs: 15 * 60 * 1000, max: 500,
  standardHeaders: true, legacyHeaders: false,
}));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth',          require('./routes/auth'));
app.use('/api/patient',       require('./routes/patient'));
app.use('/api/doctor',        require('./routes/doctor'));
app.use('/api/appointments',  require('./routes/appointment'));
app.use('/api/records',       require('./routes/record'));
app.use('/api/qr',            require('./routes/qr'));
app.use('/api/notifications', require('./routes/notification'));
app.use('/api/insurance',     require('./routes/insurance'));
app.use('/api/claims',        require('./routes/claim'));
app.use('/api/admin',         require('./routes/admin'));
app.use('/api/chat',          require('./routes/chat'));
app.use('/api/symptoms',      require('./routes/symptom'));
app.use('/api/public',        require('./routes/public'));

app.get('/api/health', (req, res) => res.json({ status: 'ok', ts: new Date() }));
app.use((req, res) => res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` }));
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message);
  res.status(err.status || 500).json({ success: false, message: err.message || 'Internal server error' });
});

// ── Database — no deprecated options ─────────────────────────────────────────
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/healthbridge')
  .then(async () => {
    console.log('✅ MongoDB connected');
    await seedDanaShivamDoctors();
    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
  })
  .catch(err => {
    console.error('❌ MongoDB connection failed:', err.message);
    process.exit(1);
  });

module.exports = { app, io, server };