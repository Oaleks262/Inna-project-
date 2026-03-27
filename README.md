# Інна Ляховська — Сайт корсетного пошиву

Сайт-портфоліо майстра корсетного пошиву з Львова. Node.js + Express, JSON-файли як сховище, Telegram-бот, адмін-панель.

## Стек

- **Backend**: Node.js, Express
- **Сховище**: JSON-файли (`data/`)
- **Auth**: JWT + bcrypt
- **Фото**: Cloudinary (upload via API)
- **Бот**: node-telegram-bot-api (polling)
- **Процес**: PM2
- **Proxy**: Nginx + Let's Encrypt

## Структура проекту

```
├── server.js              # Точка входу Express
├── ecosystem.config.js    # PM2 конфіг
├── nginx.conf             # Nginx конфіг (скопіювати в /etc/nginx/sites-available/)
├── .env.example           # Шаблон змінних оточення
├── middleware/
│   └── auth.js            # JWT middleware
├── routes/
│   ├── admin.js           # Адмін API (/api/admin/*)
│   ├── portfolio.js       # Публічне портфоліо (/api/portfolio)
│   ├── requests.js        # Заявки з сайту (/api/requests)
│   └── upload.js          # Завантаження фото (/api/admin/upload)
├── bot/
│   └── index.js           # Telegram бот
├── data/
│   ├── portfolio.json     # Роботи портфоліо
│   ├── requests.json      # Заявки клієнтів
│   └── settings.json      # Налаштування сайту
└── public/
    ├── index.html         # Головна сторінка
    ├── portfolio.html     # Сторінка портфоліо
    ├── admin/
    │   ├── index.html     # Адмін-панель
    │   └── login.html     # Вхід в адмін
    ├── css/
    │   ├── main.css       # Загальні стилі
    │   ├── portfolio.css  # Стилі портфоліо
    │   └── admin.css      # Стилі адмін-панелі
    └── js/
        ├── main.js        # Загальний JS (cursor, nav, reveal)
        ├── portfolio.js   # Логіка портфоліо
        └── admin.js       # Логіка адмін-панелі
```

## Локальний запуск

### 1. Клонування та залежності

```bash
git clone <repo-url>
cd inna-project
npm install
```

### 2. Налаштування змінних оточення

```bash
cp .env.example .env
```

Відредагуйте `.env`:

```env
PORT=3000
JWT_SECRET=your-random-secret-32chars

# Пароль адміна (bcrypt hash)
ADMIN_LOGIN=admin
ADMIN_PASSWORD_HASH=<hash>   # Згенерувати нижче

# Telegram (необов'язково для локального)
TELEGRAM_BOT_TOKEN=
TELEGRAM_OWNER_CHAT_ID=

# Cloudinary (необов'язково для локального)
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

SITE_URL=http://localhost:3000
```

### 3. Генерація bcrypt hash для пароля

```bash
node -e "const b=require('bcrypt'); b.hash('YOUR_PASSWORD',10).then(h=>console.log(h))"
```

Вставте результат у `ADMIN_PASSWORD_HASH` у `.env`.

### 4. Запуск

```bash
node server.js
```

Або з nodemon для розробки:

```bash
npx nodemon server.js
```

Відкрийте: [http://localhost:3000](http://localhost:3000)
Адмін-панель: [http://localhost:3000/admin/](http://localhost:3000/admin/)

---

## Розгортання на сервері (Ubuntu/Debian)

### 1. Підготовка сервера

```bash
# Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# PM2
sudo npm install -g pm2

# Nginx
sudo apt install -y nginx

# Certbot (Let's Encrypt)
sudo apt install -y certbot python3-certbot-nginx
```

### 2. Розгортання коду

```bash
sudo mkdir -p /var/www/inna-project
sudo chown $USER:$USER /var/www/inna-project

git clone <repo-url> /var/www/inna-project
cd /var/www/inna-project
npm install --omit=dev

cp .env.example .env
# Відредагуйте .env з продакшн значеннями
nano .env
```

### 3. Налаштування Nginx

```bash
sudo cp /var/www/inna-project/nginx.conf /etc/nginx/sites-available/inna-corset
sudo ln -s /etc/nginx/sites-available/inna-corset /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 4. SSL сертифікат

```bash
sudo certbot --nginx -d inna-corset.lviv.ua -d www.inna-corset.lviv.ua
```

### 5. Запуск через PM2

```bash
cd /var/www/inna-project
pm2 start ecosystem.config.js
pm2 save
pm2 startup
# Виконайте команду, яку виведе pm2 startup
```

### 6. Корисні команди PM2

```bash
pm2 status               # Статус процесів
pm2 logs corset-site     # Логи додатку
pm2 restart corset-site  # Перезапуск
pm2 reload corset-site   # Reload без downtime
pm2 stop corset-site     # Зупинка
```

---

## Telegram бот

### Налаштування

1. Створіть бота через [@BotFather](https://t.me/BotFather) → отримайте `TELEGRAM_BOT_TOKEN`
2. Дізнайтесь свій `chat_id` через [@userinfobot](https://t.me/userinfobot)
3. Вставте обидва значення в `.env`

### Команди власника

| Команда | Дія |
|---------|-----|
| `/start` | Головне меню |
| `/new` | Показати нові заявки |
| `/stats` | Статистика (день/тиждень/місяць) |
| `/help` | Довідка команд |

### Клієнтський діалог

Будь-якому клієнту, який пише боту, пропонується 5-крокова анкета:
1. Ім'я
2. Тип корсету (Весільний / Вечірній / Casual)
3. Розмір (XS–XXXL або «Не знаю»)
4. Контактний телефон / Telegram
5. Побажання (або «Пропустити»)

Заявка зберігається в `data/requests.json`, Інна отримує повідомлення з деталями.

---

## Cloudinary (завантаження фото)

1. Зареєструйтесь на [cloudinary.com](https://cloudinary.com)
2. Скопіюйте Cloud Name, API Key, API Secret з Dashboard
3. Вставте в `.env`

Після цього у формі додавання роботи в адмін-панелі з'явиться можливість drag-and-drop завантаження фото.

---

## API

### Публічні ендпоінти

| Метод | URL | Опис |
|-------|-----|------|
| GET | `/api/portfolio` | Список робіт (фільтр: `?category=wedding&page=1&limit=9`) |
| GET | `/api/portfolio/:slug` | Одна робота |
| POST | `/api/requests` | Надіслати заявку |

### Адмін ендпоінти (Bearer JWT)

| Метод | URL | Опис |
|-------|-----|------|
| POST | `/api/admin/login` | Вхід (повертає JWT) |
| GET | `/api/admin/portfolio` | Всі роботи (включно невидимі) |
| POST | `/api/admin/portfolio` | Додати роботу |
| PUT | `/api/admin/portfolio/:id` | Оновити роботу |
| DELETE | `/api/admin/portfolio/:id` | Видалити роботу |
| PATCH | `/api/admin/portfolio/:id/toggle` | Перемкнути видимість |
| GET | `/api/admin/requests` | Заявки (фільтр: `?status=new`) |
| PUT | `/api/admin/requests/:id/status` | Змінити статус заявки |
| GET | `/api/admin/settings` | Отримати налаштування |
| PUT | `/api/admin/settings` | Зберегти налаштування |
| PUT | `/api/admin/settings/password` | Змінити пароль |
| POST | `/api/admin/upload` | Завантажити фото на Cloudinary |
| POST | `/api/admin/test-telegram` | Тестове Telegram повідомлення |

---

## Ліцензія

Приватний проект. Всі права захищені.
