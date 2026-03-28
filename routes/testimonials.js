const express = require('express');
const router  = express.Router();
const path    = require('path');
const fs      = require('fs');
const { v4: uuidv4 } = require('uuid');
const auth    = require('../middleware/auth');

const FILE = path.join(__dirname, '../data/testimonials.json');

function read()        { return JSON.parse(fs.readFileSync(FILE, 'utf8')); }
function write(data)   { fs.writeFileSync(FILE, JSON.stringify(data, null, 2), 'utf8'); }

// GET /api/testimonials — публічний, тільки видимі
router.get('/', (req, res) => {
  const items = read().filter(t => t.isVisible !== false);
  res.json({ items, total: items.length });
});

// ─── Admin ────────────────────────────────────────────────────────────────────

// GET /api/testimonials/all — всі (з прихованими)
router.get('/all', auth, (req, res) => {
  const items = read();
  res.json({ items, total: items.length });
});

// POST /api/testimonials
router.post('/', auth, (req, res) => {
  const { name, city, service, text, rating } = req.body;
  if (!name || !text) return res.status(400).json({ error: 'Ім\'я та текст обов\'язкові' });
  const items = read();
  const item = {
    id: uuidv4(),
    name,
    city:      city    || '',
    service:   service || '',
    text,
    rating:    Math.min(5, Math.max(1, parseInt(rating) || 5)),
    isVisible: true,
    createdAt: new Date().toISOString().slice(0, 10)
  };
  items.push(item);
  write(items);
  res.status(201).json(item);
});

// PUT /api/testimonials/:id
router.put('/:id', auth, (req, res) => {
  const items = read();
  const idx = items.findIndex(t => t.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Відгук не знайдено' });
  const { name, city, service, text, rating, isVisible } = req.body;
  if (name      !== undefined) items[idx].name      = name;
  if (city      !== undefined) items[idx].city      = city;
  if (service   !== undefined) items[idx].service   = service;
  if (text      !== undefined) items[idx].text      = text;
  if (rating    !== undefined) items[idx].rating    = Math.min(5, Math.max(1, parseInt(rating) || 5));
  if (isVisible !== undefined) items[idx].isVisible = isVisible;
  write(items);
  res.json(items[idx]);
});

// DELETE /api/testimonials/:id
router.delete('/:id', auth, (req, res) => {
  const items = read();
  const idx = items.findIndex(t => t.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Відгук не знайдено' });
  items.splice(idx, 1);
  write(items);
  res.json({ success: true });
});

module.exports = router;
