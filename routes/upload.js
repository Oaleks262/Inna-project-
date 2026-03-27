const express  = require('express');
const router   = express.Router();
const multer   = require('multer');
const sharp    = require('sharp');
const path     = require('path');
const fs       = require('fs');
const { v4: uuidv4 } = require('uuid');
const auth     = require('../middleware/auth');

const UPLOAD_DIR = path.join(__dirname, '../public/uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

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

module.exports = router;
