const { cloudinary, isCloudinaryConfigured } = require('../config/cloudinary');
const AppError = require('./AppError');

// Root-cause fix for "images upload but don't display": every upload
// now goes to Cloudinary and stores the absolute `secure_url` it returns,
// instead of a relative /uploads/... path that only resolves when the
// frontend and backend happen to share an origin (they don't in dev —
// the frontend runs on :5173, the backend on :5000, with no proxy).
//
// Returns { url, publicId } — url is what gets saved on the document,
// publicId is kept so deleteFromCloudinary can clean up later.
function uploadBuffer(buffer, { folder, resourceType = 'image' }) {
  if (!isCloudinaryConfigured) {
    return Promise.reject(
      new AppError(
        'Image uploads are not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET in the backend .env.',
        500
      )
    );
  }

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: `hampsons-group-of-school/${folder}`, resource_type: resourceType },
      (err, result) => {
        if (err) return reject(new AppError(`Image upload failed: ${err.message}`, 502));
        resolve({ url: result.secure_url, publicId: result.public_id });
      }
    );
    stream.end(buffer);
  });
}

// Best-effort cleanup — never throws, so a failed delete on Cloudinary's
// side never blocks the corresponding DB record from being removed.
async function deleteFromCloudinary(publicId, resourceType = 'image') {
  if (!publicId || !isCloudinaryConfigured) return;
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
  } catch {
    // Swallow — orphaned Cloudinary assets are a cheap trade-off for
    // never blocking a delete the user asked for.
  }
}

module.exports = { uploadBuffer, deleteFromCloudinary };
