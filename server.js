require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const cloudinary = require('cloudinary').v2;

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Cloudinary ───────────────────────────────────────────────────────────────
if (process.env.CLOUDINARY_CLOUD_NAME) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
}

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Static Files ─────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/portfolio', require('./routes/portfolio'));
app.use('/api/requests', require('./routes/requests'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/admin/upload', require('./routes/upload'));

// ─── Telegram Bot ─────────────────────────────────────────────────────────────
if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_OWNER_CHAT_ID) {
  try {
    require('./bot');
    console.log('✓ Telegram бот запущено');
  } catch (err) {
    console.warn('⚠ Telegram бот не запустився:', err.message);
  }
}

// ─── Чисті URL без .html ──────────────────────────────────────────────────────
const cleanRoutes = {
  '/portfolio': 'portfolio.html',
  '/privacy':   'privacy.html',
  '/terms':     'terms.html',
};
Object.entries(cleanRoutes).forEach(([route, file]) => {
  app.get(route, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', file));
  });
});

// ─── 404 ──────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Маршрут не знайдено' });
  }
  res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✓ Сервер запущено на http://localhost:${PORT}`);
});

module.exports = app;
