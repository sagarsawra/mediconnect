const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const multer = require("multer");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Cloudinary storage configuration for medical reports
 * Files are organized by hospital and patient
 */
const medicalReportStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => ({
    folder: `mediconnect/reports/${req.user.id}`,
    resource_type: "auto",  // supports both images and PDFs
    allowed_formats: ["jpg", "jpeg", "png", "pdf", "webp"],
    public_id: `report_${Date.now()}_${Math.round(Math.random() * 1e9)}`,
    transformation: file.mimetype.startsWith("image/")
      ? [{ quality: "auto", fetch_format: "auto" }]
      : undefined,
  }),
});

/**
 * Avatar / logo storage
 */
const avatarStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "mediconnect/avatars",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    transformation: [{ width: 400, height: 400, crop: "fill", quality: "auto" }],
  },
});

const uploadReport = multer({
  storage: medicalReportStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only JPG, PNG, WEBP, and PDF are allowed."), false);
    }
  },
});

const uploadAvatar = multer({
  storage: avatarStorage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
});

module.exports = { cloudinary, uploadReport, uploadAvatar };
