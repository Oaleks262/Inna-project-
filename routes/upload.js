const express  = require('express');
const router   = express.Router();
const multer   = require('multer');
const sharp    = require('sharp');
const path     = require('path');
const fs       = require('fs');
const { v4: uuidv4 } = require('uuid');
const auth     = require('../middleware/auth');

const UPLOAD_DIR = path.join(__dirname, '../public/uploads');
const IMG_DIR    = path.join(__dirname, '../public/img');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
if (!fs.existsSync(IMG_DIR))    fs.mkdirSync(IMG_DIR,    { recursive: true });

// Multer — memory storage, конвертуємо через sharp
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter(req, file, cb) {
    if (file.mimetype.startsWith('image/')) return cb(null, true);
    cb(new Error('Тільки зображення дозволені'));
  }
});

// POST /api/admin/upload
router.post('/', auth, upload.array('photos', 10), async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'Файли не завантажено' });
  }

  try {
    const urls = await Promise.all(
      req.files.map(async (file) => {
        const filename = uuidv4() + '.webp';
        const filepath = path.join(UPLOAD_DIR, filename);

        await sharp(file.buffer)
          .rotate()               // авто-орієнтація за EXIF
          .resize(1200, 1600, {   // макс розмір, зберігає пропорції
            fit: 'inside',
            withoutEnlargement: true
          })
          .webp({ quality: 85 }) // конвертуємо в WebP, якість 85%
          .toFile(filepath);

        return '/uploads/' + filename;
      })
    );

    res.json({ urls });
  } catch (err) {
    res.status(500).json({ error: 'Помилка обробки: ' + err.message });
  }
});

// POST /api/admin/upload/site-photo  — фото hero або about
router.post('/site-photo', auth, upload.single('photo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Файл не завантажено' });

  const type = req.body.type;
  if (!type || !['hero', 'about'].includes(type)) {
    return res.status(400).json({ error: 'Невірний тип: hero або about' });
  }

  const filename = type === 'hero' ? 'hero-photo.webp' : 'inna-photo.webp';
  const filepath = path.join(IMG_DIR, filename);

  try {
    await sharp(req.file.buffer)
      .rotate()
      .resize(1200, 1600, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 88 })
      .toFile(filepath);

    res.json({ url: '/img/' + filename + '?v=' + Date.now() });
  } catch (err) {
    res.status(500).json({ error: 'Помилка обробки: ' + err.message });
  }
});

module.exports = router;
