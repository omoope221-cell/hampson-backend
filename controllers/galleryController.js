const GalleryImage = require('../models/GalleryImage');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');
const ApiFeatures = require('../utils/apiFeatures');
const recordAudit = require('../utils/audit');
const { uploadBuffer, deleteFromCloudinary } = require('../utils/cloudinaryUpload');

exports.getAllImages = catchAsync(async (req, res) => {
  const features = new ApiFeatures(GalleryImage.find(), req.query).filter().sort().paginate();
  const [docs, total] = await Promise.all([features.query, GalleryImage.countDocuments()]);

  res.status(200).json({
    status: 'success',
    results: docs.length,
    pagination: { ...features.pagination, total, pages: Math.ceil(total / features.pagination.limit) },
    data: docs,
  });
});

// POST /api/v1/gallery — multipart, field name "image"
exports.uploadImage = catchAsync(async (req, res, next) => {
  if (!req.file) return next(new AppError('No image file uploaded.', 400));
  const { caption, category, featured, displayOrder } = req.body;

  const { url, publicId } = await uploadBuffer(req.file.buffer, { folder: 'gallery' });

  const image = await GalleryImage.create({
    image: url,
    imagePublicId: publicId,
    caption,
    category: category || 'General',
    featured: featured === 'true' || featured === true,
    displayOrder: displayOrder ? Number(displayOrder) : 0,
    uploadedBy: req.user.id,
  });

  await recordAudit({ actor: req.user.id, action: 'gallery.upload', targetModel: 'GalleryImage', targetId: image._id });
  res.status(201).json({ status: 'success', data: image });
});

exports.updateImage = catchAsync(async (req, res, next) => {
  const { caption, category, featured, displayOrder } = req.body;
  const image = await GalleryImage.findByIdAndUpdate(
    req.params.id,
    { caption, category, featured, displayOrder },
    { new: true, runValidators: true }
  );
  if (!image) return next(new AppError('Image not found.', 404));
  await recordAudit({ actor: req.user.id, action: 'gallery.update', targetModel: 'GalleryImage', targetId: image._id });
  res.status(200).json({ status: 'success', data: image });
});

exports.deleteImage = catchAsync(async (req, res, next) => {
  const image = await GalleryImage.findByIdAndDelete(req.params.id);
  if (!image) return next(new AppError('Image not found.', 404));
  await deleteFromCloudinary(image.imagePublicId);
  await recordAudit({ actor: req.user.id, action: 'gallery.delete', targetModel: 'GalleryImage', targetId: image._id });
  res.status(204).json({ status: 'success', data: null });
});
