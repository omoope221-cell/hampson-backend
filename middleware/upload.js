const multer = require('multer');
const path = require('path');
const fs = require('fs');
const AppError = require('../utils/AppError');

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];

// Non-image attachments (PDFs, docs — e.g. admission supporting
// documents, notice-board attachments) still land on local disk, served
// from /uploads. Images go through memory storage below and are handed
// to Cloudinary by the controller (see utils/cloudinaryUpload.js) —
// that's the fix for uploaded images not displaying: a relative
// /uploads/... path only resolves when the frontend and backend share an
// origin, which they don't (frontend :5173, backend :5000, no proxy).
// Cloudinary's secure_url is absolute and always resolves.
function makeDiskStorage(subfolder) {
  const dest = path.join(__dirname, '..', 'uploads', subfolder);
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });

  return multer.diskStorage({
    destination: (req, file, cb) => cb(null, dest),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
      cb(null, unique);
    },
  });
}

function imageFileFilter(req, file, cb) {
  if (!ALLOWED_MIME.includes(file.mimetype)) {
    return cb(new AppError('Only JPEG, PNG or WEBP images are allowed.', 400), false);
  }
  cb(null, true);
}

const maxSize = (parseInt(process.env.MAX_UPLOAD_MB, 10) || 5) * 1024 * 1024;

// All image uploads: memory storage → buffer → Cloudinary in the controller.
const imageUpload = multer({ storage: multer.memoryStorage(), fileFilter: imageFileFilter, limits: { fileSize: maxSize } });

exports.uploadStudentPhoto = imageUpload.single('passportPhoto');
exports.uploadStaffPhoto = imageUpload.single('profilePicture');
exports.uploadTeacherPhoto = imageUpload.single('photo');
exports.uploadGalleryImage = imageUpload.single('image');
exports.uploadNewsEventImage = imageUpload.single('image');
exports.uploadEventImage = imageUpload.single('image');
exports.uploadAnnouncementImage = imageUpload.single('image');
// Single-file uploads for the various image "slots" on the Website
// Settings page (logo / favicon / OG image / a banner / one hero image at
// a time). The `target` is validated by the controller, not multer.
exports.uploadSiteImage = imageUpload.single('image');

// The public application form: up to three named supporting documents in
// one submission. Can be an image or a PDF, so no imageFileFilter here;
// routed to Cloudinary (resource_type 'auto') by the controller rather
// than disk, for the same reason as the image uploads above.
exports.uploadAdmissionDocuments = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxSize * 2 },
}).fields([
  { name: 'birthCertificate', maxCount: 1 },
  { name: 'reportCard', maxCount: 1 },
  { name: 'passportPhoto', maxCount: 1 },
]);

// Notice-board attachments (internal dashboard use) stay on local disk —
// not shown on the public site, so the cross-origin path issue doesn't apply.
exports.uploadAttachment = multer({
  storage: makeDiskStorage('attachments'),
  limits: { fileSize: maxSize * 2 },
}).single('attachment');
