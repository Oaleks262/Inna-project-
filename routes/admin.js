const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const auth = require('../middleware/auth');

const PORTFOLIO_FILE = path.join(__dirname, '../data/portfolio.json');
const REQUESTS_FILE = path.join(__dirname, '../data/requests.json');
const SETTINGS_FILE = path.join(__dirname, '../data/settings.json');

function readJSON(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

// ─── AUTH ──────────────────────────────────────────────────────────────────

// POST /api/admin/login
router.post('/login', async (req, res) => {
  const { login, password } = req.body;
  if (login !== process.env.ADMIN_LOGIN) {
    return res.status(401).json({ error: 'Невірний логін або пароль' });
  }
  const valid = await bcrypt.compare(password, process.env.ADMIN_PASSWORD_HASH);
  if (!valid) {
    return res.status(401).json({ error: 'Невірний логін або пароль' });
  }
  const token = jwt.sign({ login }, process.env.JWT_SECRET, { expiresIn: '7d' });
  res.json({ token });
});

// ─── PORTFOLIO ──────────────────────────────────────────────────────────────

// GET /api/admin/portfolio — всі роботи (з прихованими)
router.get('/portfolio', auth, (req, res) => {
  const items = readJSON(PORTFOLIO_FILE);
  res.json({ items, total: items.length });
});

// POST /api/admin/portfolio — додати роботу
router.post('/portfolio', auth, (req, res) => {
  const { title, category, description, materials, parameters, workingTime, pricing, isVisible, images } = req.body;
  if (!title || !category) {
    return res.status(400).json({ error: 'Назва та категорія обов\'язкові' });
  }

  const slug = title
    .toLowerCase()
    .replace(/[а-яёїієа-я]/gi, c => ({
      'а':'a','б':'b','в':'v','г':'h','ґ':'g','д':'d','е':'e','є':'ie','ж':'zh',
      'з':'z','и':'y','і':'i','ї':'i','й':'i','к':'k','л':'l','м':'m','н':'n',
      'о':'o','п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'kh','ц':'ts',
      'ч':'ch','ш':'sh','щ':'shch','ь':'','ю':'iu','я':'ia'
    }[c] || c))
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  const items = readJSON(PORTFOLIO_FILE);
  const maxOrder = items.length ? Math.max(...items.map(i => i.sortOrder)) : 0;

  const newItem = {
    id: uuidv4(),
    title,
    slug,
    category,
    images: images || [],
    description: description || '',
    materials: materials || [],
    parameters: parameters || {},
    workingTime: workingTime || '',
    pricing: pricing || { basePrice: 0, priceNote: '', currency: 'грн' },
    isVisible: isVisible !== false,
    sortOrder: maxOrder + 1,
    createdAt: new Date().toISOString().slice(0, 10)
  };

  items.push(newItem);
  writeJSON(PORTFOLIO_FILE, items);
  res.status(201).json(newItem);
});

// PUT /api/admin/portfolio/:id — оновити роботу
router.put('/portfolio/:id', auth, (req, res) => {
  const items = readJSON(PORTFOLIO_FILE);
  const idx = items.findIndex(i => i.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Роботу не знайдено' });

  const { title, category, description, materials, parameters, workingTime, pricing, isVisible, images, sortOrder } = req.body;

  if (title) items[idx].title = title;
  if (category) items[idx].category = category;
  if (description !== undefined) items[idx].description = description;
  if (materials) items[idx].materials = materials;
  if (parameters) items[idx].parameters = parameters;
  if (workingTime !== undefined) items[idx].workingTime = workingTime;
  if (pricing) items[idx].pricing = pricing;
  if (isVisible !== undefined) items[idx].isVisible = isVisible;
  if (images) items[idx].images = images;
  if (sortOrder !== undefined) items[idx].sortOrder = sortOrder;

  writeJSON(PORTFOLIO_FILE, items);
  res.json(items[idx]);
});

// DELETE /api/admin/portfolio/:id
router.delete('/portfolio/:id', auth, (req, res) => {
  const items = readJSON(PORTFOLIO_FILE);
  const idx = items.findIndex(i => i.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Роботу не знайдено' });
  items.splice(idx, 1);
  writeJSON(PORTFOLIO_FILE, items);
  res.json({ success: true });
});

// PUT /api/admin/portfolio/:id/toggle — видимість
router.put('/portfolio/:id/toggle', auth, (req, res) => {
  const items = readJSON(PORTFOLIO_FILE);
  const item = items.find(i => i.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'Роботу не знайдено' });
  item.isVisible = !item.isVisible;
  writeJSON(PORTFOLIO_FILE, items);
  res.json({ id: item.id, isVisible: item.isVisible });
});

// ─── REQUESTS ────────────────────────────────────────────────────────────────

// GET /api/admin/requests
router.get('/requests', auth, (req, res) => {
  const { status } = req.query;
  let requests = readJSON(REQUESTS_FILE);
  if (status && status !== 'all') {
    requests = requests.filter(r => r.status === status);
  }
  // Сортуємо від нових до старих
  requests.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ requests, total: requests.length });
});

// PUT /api/admin/requests/:id/status
router.put('/requests/:id/status', auth, (req, res) => {
  const { status } = req.body;
  const validStatuses = ['new', 'viewed', 'in_progress', 'done'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Невірний статус' });
  }
  const requests = readJSON(REQUESTS_FILE);
  const req_ = requests.find(r => r.id === req.params.id);
  if (!req_) return res.status(404).json({ error: 'Заявку не знайдено' });
  req_.status = status;
  writeJSON(REQUESTS_FILE, requests);
  res.json({ id: req_.id, status: req_.status });
});

// ─── SETTINGS ────────────────────────────────────────────────────────────────

// GET /api/admin/settings
router.get('/settings', auth, (req, res) => {
  res.json(readJSON(SETTINGS_FILE));
});

// PUT /api/admin/settings
router.put('/settings', auth, (req, res) => {
  const allowed = ['phone', 'instagram', 'telegram', 'address', 'siteUrl'];
  const settings = readJSON(SETTINGS_FILE);
  allowed.forEach(key => {
    if (req.body[key] !== undefined) settings[key] = req.body[key];
  });
  writeJSON(SETTINGS_FILE, settings);
  res.json(settings);
});

// PUT /api/admin/settings/password
router.put('/settings/password', auth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Заповніть всі поля' });
  }
  const valid = await bcrypt.compare(currentPassword, process.env.ADMIN_PASSWORD_HASH);
  if (!valid) return res.status(401).json({ error: 'Поточний пароль невірний' });

  const hash = await bcrypt.hash(newPassword, 10);
  // Оновлюємо в .env потрібно вручну або через інший механізм
  // Повертаємо хеш — адміністратор вставить його в .env
  res.json({ success: true, newHash: hash, note: 'Замініть ADMIN_PASSWORD_HASH в .env на це значення і перезапустіть сервер' });
});

// POST /api/admin/settings/test-telegram
router.post('/settings/test-telegram', auth, (req, res) => {
  if (!global.sendTelegramTest) {
    return res.status(503).json({ error: 'Telegram бот не підключений. Перевірте TELEGRAM_BOT_TOKEN в .env' });
  }
  global.sendTelegramTest()
    .then(() => res.json({ success: true, message: '✓ Повідомлення надіслано успішно' }))
    .catch(err => res.status(500).json({ error: '✗ Помилка: ' + err.message }));
});

module.exports = router;
