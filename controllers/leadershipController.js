const Leadership = require('../models/Leadership');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');
const ApiFeatures = require('../utils/apiFeatures');
const recordAudit = require('../utils/audit');
const { uploadBuffer, deleteFromCloudinary } = require('../utils/cloudinaryUpload');

// GET /api/v1/leadership — admin view, every status
exports.getAllLeadership = catchAsync(async (req, res) => {
  const features = new ApiFeatures(Leadership.find(), req.query)
    .filter()
    .search(['fullName', 'position'])
    .sort()
    .paginate();

  const [docs, total] = await Promise.all([features.query, Leadership.countDocuments()]);

  res.status(200).json({
    status: 'success',
    results: docs.length,
    pagination: { ...features.pagination, total, pages: Math.ceil(total / features.pagination.limit) },
    data: docs,
  });
});

exports.getLeader = catchAsync(async (req, res, next) => {
  const leader = await Leadership.findById(req.params.id);
  if (!leader) return next(new AppError('Leadership profile not found.', 404));
  res.status(200).json({ status: 'success', data: leader });
});

exports.createLeader = catchAsync(async (req, res, next) => {
  const { fullName, position } = req.body;
  if (!fullName || !position) return next(new AppError('fullName and position are required.', 400));

  const leader = await Leadership.create({ ...req.body, createdBy: req.user.id });
  await recordAudit({ actor: req.user.id, action: 'leadership.create', targetModel: 'Leadership', targetId: leader._id });
  res.status(201).json({ status: 'success', data: leader });
});

exports.updateLeader = catchAsync(async (req, res, next) => {
  const leader = await Leadership.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!leader) return next(new AppError('Leadership profile not found.', 404));
  await recordAudit({ actor: req.user.id, action: 'leadership.update', targetModel: 'Leadership', targetId: leader._id });
  res.status(200).json({ status: 'success', data: leader });
});

exports.deleteLeader = catchAsync(async (req, res, next) => {
  const leader = await Leadership.findByIdAndDelete(req.params.id);
  if (!leader) return next(new AppError('Leadership profile not found.', 404));
  await deleteFromCloudinary(leader.photoPublicId);
  await recordAudit({ actor: req.user.id, action: 'leadership.delete', targetModel: 'Leadership', targetId: leader._id });
  res.status(204).json({ status: 'success', data: null });
});

// POST /api/v1/leadership/:id/photo — multipart, field name "photo"
exports.uploadPhoto = catchAsync(async (req, res, next) => {
  if (!req.file) return next(new AppError('No file uploaded.', 400));
  const { url, publicId } = await uploadBuffer(req.file.buffer, { folder: 'leadership' });
  const leader = await Leadership.findByIdAndUpdate(
    req.params.id,
    { photo: url, photoPublicId: publicId },
    { new: true }
  );
  if (!leader) return next(new AppError('Leadership profile not found.', 404));
  res.status(200).json({ status: 'success', data: leader });
});
