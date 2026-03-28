const TelegramBot = require('node-telegram-bot-api');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const TOKEN = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
const OWNER_CHAT_ID = String(process.env.TELEGRAM_OWNER_CHAT_ID || '').trim();
const SITE_URL = process.env.SITE_URL || 'https://inna-corset.lviv.ua';

const REQUESTS_FILE = path.join(__dirname, '../data/requests.json');

// Перевірка токена — має містити ':' і бути непорожнім
if (!TOKEN || !TOKEN.includes(':')) {
  console.warn('⚠ Telegram бот: токен не налаштований, бот не запускається.');
  module.exports = null;
  return;
}

function readRequests() {
  return JSON.parse(fs.readFileSync(REQUESTS_FILE, 'utf8'));
}
function writeRequests(data) {
  fs.writeFileSync(REQUESTS_FILE, JSON.stringify(data, null, 2), 'utf8');
}

const bot = new TelegramBot(TOKEN, { polling: true });

// Тихо ігноруємо polling помилки (мережа, Telegram downtime тощо)
bot.on('polling_error', (err) => {
  console.warn('⚠ Telegram polling:', err.code || err.message);
});

// ─── Стан діалогу клієнтів ────────────────────────────────────────────────────
// chat_id → { step: 'name'|'type'|'size'|'contact'|'message'|'done', name, type, size, contact, message }
const sessions = new Map();

function newSession() {
  return { step: 'name', name: '', type: '', size: '', contact: '', message: '' };
}

// ─── Нотифікатор (глобально для server.js) ───────────────────────────────────

global.notifyNewRequest = function (request) {
  if (!OWNER_CHAT_ID) return;
  const text =
    `🆕 *Нова заявка з сайту*\n\n` +
    `👤 Ім'я: ${request.name}\n` +
    `📱 Телефон: ${request.phone}\n` +
    `📐 Розмір: ${request.size}\n` +
    `👗 Робота: ${request.portfolioItem || '—'}\n` +
    `💬 Побажання: ${request.message || '—'}\n` +
    `📍 Джерело: Сайт\n` +
    `🕐 ${new Date(request.createdAt).toLocaleString('uk-UA')}`;

  bot.sendMessage(OWNER_CHAT_ID, text, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [[
        { text: '✓ Позначити як переглянуто', callback_data: `viewed:${request.id}` }
      ]]
    }
  }).catch(err => console.error('Telegram notify error:', err.message));
};

global.sendTelegramTest = function () {
  return bot.sendMessage(OWNER_CHAT_ID,
    '✅ Тестове повідомлення від бота сайту Інни Ляховської. Бот працює коректно.');
};

// ─── Єдиний обробник callback_query ──────────────────────────────────────────

bot.on('callback_query', async (query) => {
  const { data, message, from } = query;
  const chatId = String(from.id);
  const isOwner = chatId === OWNER_CHAT_ID;

  // 1. Позначити заявку з сайту як переглянуту
  if (data.startsWith('viewed:')) {
    const id = data.split(':')[1];
    const requests = readRequests();
    const req = requests.find(r => r.id === id);
    if (req) {
      req.status = 'viewed';
      writeRequests(requests);
      bot.answerCallbackQuery(query.id, { text: '✓ Позначено як переглянуто' });
      bot.editMessageReplyMarkup({ inline_keyboard: [] }, {
        chat_id: message.chat.id,
        message_id: message.message_id
      }).catch(() => {});
    } else {
      bot.answerCallbackQuery(query.id, { text: 'Заявку не знайдено' });
    }
    return;
  }

  // 2. Команди Інни (cmd_)
  if (data.startsWith('cmd_') && isOwner) {
    bot.answerCallbackQuery(query.id);
    if (data === 'cmd_new')   sendNewRequests(chatId);
    if (data === 'cmd_stats') sendStats(chatId);
    if (data === 'cmd_help')  sendHelp(chatId);
    return;
  }

  // 3. Кнопки клієнтського діалогу
  const session = sessions.get(chatId);
  if (!session) {
    bot.answerCallbackQuery(query.id);
    return;
  }

  if (session.step === 'type' && ['wedding', 'evening', 'casual'].includes(data)) {
    session.type = { wedding: 'Весільний', evening: 'Вечірній', casual: 'Casual' }[data];
    session.step = 'size';
    bot.answerCallbackQuery(query.id);
    bot.sendMessage(chatId, 'Чудовий вибір!\n\nВкажіть ваш розмір (орієнтовно):', {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'XS', callback_data: 'XS' }, { text: 'S', callback_data: 'S' },
           { text: 'M', callback_data: 'M' },  { text: 'L', callback_data: 'L' }],
          [{ text: 'XL', callback_data: 'XL' }, { text: 'XXL', callback_data: 'XXL' },
           { text: 'XXXL', callback_data: 'XXXL' }, { text: 'Не знаю', callback_data: 'unknown' }]
        ]
      }
    });
    return;
  }

  if (session.step === 'size' && ['XS','S','M','L','XL','XXL','XXXL','unknown'].includes(data)) {
    session.size = data === 'unknown' ? 'Не знаю' : data;
    session.step = 'contact';
    bot.answerCallbackQuery(query.id);
    bot.sendMessage(chatId,
      'Вкажіть ваш номер телефону або Telegram,\nщоб Інна могла з вами зв\'язатись:');
    return;
  }

  if (session.step === 'message' && data === 'skip') {
    session.message = '';
    bot.answerCallbackQuery(query.id);
    await finishBotOrder(chatId, session);
    return;
  }

  bot.answerCallbackQuery(query.id);
});

// ─── Обробник повідомлень ─────────────────────────────────────────────────────

bot.on('message', async (msg) => {
  if (!msg.text) return;
  const chatId = String(msg.chat.id);
  const text = msg.text.trim();
  const isOwner = chatId === OWNER_CHAT_ID;

  // Команди Інни
  if (isOwner) {
    if (text === '/start') { sendOwnerMenu(chatId); return; }
    if (text === '/new')   { sendNewRequests(chatId); return; }
    if (text === '/stats') { sendStats(chatId); return; }
    if (text === '/help')  { sendHelp(chatId); return; }
  }

  // Клієнтський /start або перше повідомлення — починаємо діалог
  if (text === '/start' || !sessions.has(chatId)) {
    sessions.set(chatId, newSession());
    bot.sendMessage(chatId,
      `Привіт! 👗\n\n` +
      `Я помічник Інни Ляховської —\n` +
      `майстра корсетного пошиву у Львові.\n\n` +
      `Допоможу оформити заявку на пошив корсету.\n` +
      `Це займе буквально 1 хвилину 🙂\n\n` +
      `Як вас звати?`
    );
    return;
  }

  const session = sessions.get(chatId);

  if (session.step === 'name') {
    session.name = text;
    session.step = 'type';
    bot.sendMessage(chatId,
      `Приємно познайомитись, ${session.name}! ✨\n\nЯкий тип корсету вас цікавить?`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '👰 Весільний', callback_data: 'wedding' }],
            [{ text: '🌙 Вечірній',  callback_data: 'evening' }],
            [{ text: '👗 Casual',    callback_data: 'casual'  }]
          ]
        }
      }
    );
    return;
  }

  if (session.step === 'contact') {
    session.contact = text;
    session.step = 'message';
    bot.sendMessage(chatId,
      `Є якісь побажання або питання?\n(матеріал, колір, особливості фігури...)`,
      {
        reply_markup: {
          inline_keyboard: [[{ text: 'Пропустити', callback_data: 'skip' }]]
        }
      }
    );
    return;
  }

  if (session.step === 'message') {
    session.message = text;
    await finishBotOrder(chatId, session);
    return;
  }

  // Якщо діалог завершено — починаємо новий
  if (session.step === 'done') {
    sessions.set(chatId, newSession());
    bot.sendMessage(chatId, 'Як вас звати?');
  }
});

// ─── Завершення замовлення ────────────────────────────────────────────────────

async function finishBotOrder(chatId, session) {
  const newRequest = {
    id: uuidv4(),
    name: session.name,
    phone: session.contact,
    size: session.size,
    portfolioItem: session.type,
    message: session.message,
    status: 'new',
    source: 'telegram',
    createdAt: new Date().toISOString()
  };

  const requests = readRequests();
  requests.push(newRequest);
  writeRequests(requests);

  // Повідомлення клієнту
  await bot.sendMessage(chatId,
    `✅ Дякую, ${session.name}!\n\n` +
    `Ваша заявка:\n` +
    `┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄\n` +
    `👗 Тип:       ${session.type}\n` +
    `📐 Розмір:    ${session.size}\n` +
    `📱 Контакт:   ${session.contact}\n` +
    `💬 Побажання: ${session.message || '—'}\n` +
    `┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄\n\n` +
    `Інна отримала вашу заявку і зв'яжеться\n` +
    `з вами протягом 2 годин 🤝`,
    {
      reply_markup: {
        inline_keyboard: [[
          { text: '🌐 Переглянути роботи на сайті', url: SITE_URL }
        ]]
      }
    }
  );

  // Повідомлення Інні
  if (OWNER_CHAT_ID) {
    bot.sendMessage(OWNER_CHAT_ID,
      `🆕 *Замовлення через Telegram бот*\n\n` +
      `👤 Ім'я:      ${session.name}\n` +
      `📱 Контакт:   ${session.contact}\n` +
      `👗 Тип:       ${session.type}\n` +
      `📐 Розмір:    ${session.size}\n` +
      `💬 Побажання: ${session.message || '—'}\n` +
      `🕐 ${new Date().toLocaleString('uk-UA')}`,
      { parse_mode: 'Markdown' }
    ).catch(() => {});
  }

  sessions.delete(chatId);
}

// ─── Команди Інни ─────────────────────────────────────────────────────────────

function sendOwnerMenu(chatId) {
  bot.sendMessage(chatId, 'Головне меню:', {
    reply_markup: {
      inline_keyboard: [
        [{ text: '📋 Нові заявки', callback_data: 'cmd_new' },
         { text: '📊 Статистика',  callback_data: 'cmd_stats' }],
        [{ text: '⚙️ Допомога',    callback_data: 'cmd_help' }]
      ]
    }
  });
}

function sendNewRequests(chatId) {
  const requests = readRequests().filter(r => r.status === 'new');
  if (requests.length === 0) {
    return bot.sendMessage(chatId, '📋 Нових заявок немає');
  }
  const lines = requests.slice(0, 10).map((r, i) => {
    const d = new Date(r.createdAt);
    const stamp = `${d.getDate()}.${String(d.getMonth()+1).padStart(2,'0')} `
      + `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    return `${i+1}. ${r.name} · ${r.phone} · ${r.portfolioItem || r.size}\n   💬 ${r.message || '—'}\n   🕐 ${stamp}`;
  }).join('\n\n');
  bot.sendMessage(chatId,
    `📋 *Нові заявки (статус: new)*\n\n${lines}\n\nВсього нових: ${requests.length}`,
    { parse_mode: 'Markdown' }
  );
}

function sendStats(chatId) {
  const all = readRequests();
  const now = new Date();
  const today = all.filter(r => {
    const d = new Date(r.createdAt);
    return d.getFullYear() === now.getFullYear()
      && d.getMonth() === now.getMonth()
      && d.getDate() === now.getDate();
  }).length;
  const week  = all.filter(r => (now - new Date(r.createdAt)) < 7 * 86400000).length;
  const month = all.filter(r => {
    const d = new Date(r.createdAt);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }).length;

  const counts = { new: 0, viewed: 0, in_progress: 0, done: 0 };
  all.forEach(r => { if (counts[r.status] !== undefined) counts[r.status]++; });

  bot.sendMessage(chatId,
    `📊 *Статистика заявок*\n\n` +
    `За сьогодні:    ${today}\n` +
    `За тиждень:     ${week}\n` +
    `За місяць:     ${month}\n` +
    `Всього:        ${all.length}\n\n` +
    `Статуси:\n` +
    `🆕 Нові:         ${counts.new}\n` +
    `👀 Переглянуті:  ${counts.viewed}\n` +
    `🔨 В роботі:     ${counts.in_progress}\n` +
    `✅ Завершені:   ${counts.done}`,
    { parse_mode: 'Markdown' }
  );
}

function sendHelp(chatId) {
  bot.sendMessage(chatId,
    `Команди:\n/new    — нові заявки\n/stats  — статистика\n/help   — ця довідка`
  );
}

module.exports = bot;
