const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const DATA_FILE = path.join(__dirname, '../data/requests.json');

function readRequests() {
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function writeRequests(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// POST /api/requests — нова заявка
router.post('/', (req, res) => {
  const { name, phone, size, portfolioItem, message } = req.body;

  if (!name || name.trim().length < 2) {
    return res.status(400).json({ error: "Ім'я обов'язкове (мінімум 2 символи)" });
  }
  if (!phone || phone.trim().length < 5) {
    return res.status(400).json({ error: "Телефон обов'язковий" });
  }

  const newRequest = {
    id: uuidv4(),
    name: name.trim(),
    phone: phone.trim(),
    size: size || 'Не вказано',
    portfolioItem: portfolioItem || '',
    message: message || '',
    status: 'new',
    source: 'site',
    createdAt: new Date().toISOString()
  };

  const requests = readRequests();
  requests.push(newRequest);
  writeRequests(requests);

  // Надсилаємо в Telegram якщо бот підключений
  if (global.notifyNewRequest) {
    global.notifyNewRequest(newRequest);
  }

  res.status(201).json({ success: true, message: 'Заявку отримано' });
});

module.exports = router;
