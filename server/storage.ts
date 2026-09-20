import fs from 'fs';
import path from 'path';
import multer from 'multer';
import crypto from 'crypto';

const UPLOADS_DIR = process.env.UPLOADS_DIR_PATH || path.resolve(process.cwd(), 'uploads');

// Ensure upload directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Multer storage engine
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueName = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`;
    cb(null, uniqueName);
  },
});

export const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100 MB max limit as requested
  },
  fileFilter: (_req, file, cb) => {
    // Allow documents, pdfs, images, excel, zip, and text files
    const allowedExtensions = /\.(pdf|jpg|jpeg|png|webp|svg|xlsx|xls|csv|docx|doc|zip|rar|txt)$/i;
    if (allowedExtensions.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error('فرمت فایل مجاز نیست. فایل‌های PDF، تصاویر، اکسل، ورد، زیپ و متنی مجاز هستند.'));
    }
  },
});

export function getFilePath(storageKey: string): string | null {
  if (!storageKey || typeof storageKey !== 'string' || storageKey.includes('\0')) {
    return null;
  }
  const safeFilename = path.basename(storageKey);
  const resolvedUploadsDir = path.resolve(UPLOADS_DIR);
  const fullPath = path.resolve(resolvedUploadsDir, safeFilename);

  // Path traversal check: must stay strictly inside resolvedUploadsDir
  if (!fullPath.startsWith(resolvedUploadsDir + path.sep)) {
    return null;
  }

  if (fs.existsSync(fullPath)) {
    return fullPath;
  }
  return null;
}

export function deleteFile(storageKey: string): boolean {
  try {
    const fullPath = getFilePath(storageKey);
    if (fullPath && fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
      return true;
    }
  } catch (error) {
    console.error('Failed to delete file:', error);
  }
  return false;
}
