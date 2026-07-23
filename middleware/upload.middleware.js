const multer  = require('multer');
const path    = require('path');
const crypto  = require('crypto');
const fs      = require('fs');
const cloudinary = require('../utils/cloudinary');

// ─── Allowed MIME types ───────────────────────────────────────
const allowedTypes = [
  'application/pdf',
  'image/jpeg', 'image/png', 'image/jpg',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const fileFilter = (req, file, cb) => {
  if (allowedTypes.includes(file.mimetype)) cb(null, true);
  else cb(new Error('Only PDF, JPG, PNG, DOC, DOCX files are allowed'), false);
};

// ─── Disk storage (local dev) ─────────────────────────────────
const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '..', 'uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `${crypto.randomUUID()}${path.extname(file.originalname)}`);
  },
});

// ─── Memory storage (always — Cloudinary handles persistence) ────
const memStorage = multer.memoryStorage();

// Always use memoryStorage so processUploads can push to Cloudinary.
// Disk storage is only a local fallback when Cloudinary creds are absent.
const upload = multer({
  storage:    memStorage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

// ─── Helper: upload a buffer to Cloudinary ───────────────────
const uploadToCloudinary = (buffer, originalname, mimetype) => {
  return new Promise((resolve, reject) => {
    // Determine resource_type
    const isPdf = mimetype === 'application/pdf';
    const isDoc = mimetype.includes('word') || mimetype.includes('officedocument');
    const resourceType = (isPdf || isDoc) ? 'raw' : 'image';

    const ext    = path.extname(originalname);
    const pubId  = crypto.randomUUID();

    const stream = cloudinary.uploader.upload_stream(
      {
        public_id:     pubId,
        resource_type: resourceType,
        folder:        'eportal',
        use_filename:  false,
        unique_filename: true,
      },
      (err, result) => {
        if (err) return reject(err);
        // Store filename as "publicId + ext" so existing code using
        // user.cv / user.profileImage continues to work via /uploads proxy
        result.storedFilename = `${pubId}${ext}`;
        resolve(result);
      }
    );
    stream.end(buffer);
  });
};

// ─── Middleware: after multer, push memory files to Cloudinary ─
const processUploads = async (req, res, next) => {
  // Check at runtime whether Cloudinary credentials are available
  const hasCloudinary = !!(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );

  // If no Cloudinary creds, files already on disk — skip
  if (!hasCloudinary) return next();

  try {
    const uploadFile = async (file) => {
      const result = await uploadToCloudinary(file.buffer, file.originalname, file.mimetype);
      file.filename      = result.storedFilename;
      file.cloudinaryUrl = result.secure_url;
      file.cloudinaryId  = result.public_id;
    };

    if (req.files) {
      // upload.fields() — req.files is { fieldName: [file, ...] }
      const promises = [];
      for (const field of Object.values(req.files)) {
        for (const file of field) promises.push(uploadFile(file));
      }
      await Promise.all(promises);
    } else if (req.file) {
      await uploadFile(req.file);
    }

    next();
  } catch (err) {
    console.error('Cloudinary upload error:', err);
    res.status(500).json({ message: 'File upload failed', detail: err.message });
  }
};

module.exports = upload;
module.exports.processUploads = processUploads;
