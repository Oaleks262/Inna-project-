const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

const DATA_FILE = path.join(__dirname, '../data/portfolio.json');

function readPortfolio() {
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

// GET /api/portfolio — всі видимі роботи (з фільтром і пагінацією)
router.get('/', (req, res) => {
  const { category, page, limit } = req.query;
  let items = readPortfolio().filter(item => item.isVisible);

  if (category && category !== 'all') {
    items = items.filter(i => i.category === category);
  }

  const total = items.length;

  if (page && limit) {
    const p = parseInt(page, 10) || 1;
    const l = parseInt(limit, 10) || 9;
    const start = (p - 1) * l;
    items = items.slice(start, start + l);
    return res.json({ items, total, page: p, limit: l });
  }

  res.json({ items, total });
});

// GET /api/portfolio/:slug — одна робота за slug
router.get('/:slug', (req, res) => {
  const items = readPortfolio();
  const item = items.find(i => i.slug === req.params.slug && i.isVisible);
  if (!item) return res.status(404).json({ error: 'Роботу не знайдено' });
  res.json(item);
});

module.exports = router;
