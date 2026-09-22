import multer from "multer";
import { AppError } from "../utils/AppError.js";
import httpStatus from "http-status";

// Memory storage — file stays as a Buffer, never touches disk,
// so we can stream it straight to Cloudinary.
const storage = multer.memoryStorage();

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

export const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      return cb(
        new AppError(
          httpStatus.BAD_REQUEST,
          `Invalid file type. Allowed: ${ALLOWED_MIME_TYPES.join(", ")}`,
        ),
      );
    }
    cb(null, true);
  },
});
