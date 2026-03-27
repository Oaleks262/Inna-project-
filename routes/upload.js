const express = require('express');
const router = express.Router();
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const auth = require('../middleware/auth');

// Multer — зберігаємо в пам'яті перед Cloudinary
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter(req, file, cb) {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Тільки зображення дозволені'));
    }
  }
});

// POST /api/admin/upload
router.post('/', auth, upload.array('photos', 10), async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'Файли не завантажено' });
  }

  try {
    const urls = await Promise.all(
      req.files.map(file => {
        return new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            { folder: 'corset-master', resource_type: 'image' },
            (error, result) => {
              if (error) return reject(error);
              resolve(result.secure_url);
            }
          );
          stream.end(file.buffer);
        });
      })
    );
    res.json({ urls });
  } catch (err) {
    res.status(500).json({ error: 'Помилка завантаження: ' + err.message });
  }
});

module.exports = router;
