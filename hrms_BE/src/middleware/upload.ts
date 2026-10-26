import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { env } from '../config/env';
import { AppError } from '../utils/errors';

const UPLOAD_DIR = path.join(env.storageDir, 'tmp');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, '');
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

/** Generic disk upload (5 MB cap). Files land in `<storageDir>/tmp`. */
export const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
});

/** CSV-only upload. */
export const csvUpload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ok = /\.csv$/i.test(file.originalname) || /csv|excel|text\/plain/i.test(file.mimetype);
    if (!ok) return cb(AppError.badRequest('Only CSV files are accepted'));
    return cb(null, true);
  },
});
