const Staff = require('../models/Staff');
const User = require('../models/User');
const Class = require('../models/Class');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');
const ApiFeatures = require('../utils/apiFeatures');
const recordAudit = require('../utils/audit');
const { uploadBuffer } = require('../utils/cloudinaryUpload');

exports.getAllStaff = catchAsync(async (req, res) => {
  const features = new ApiFeatures(Staff.find().populate('assignedClasses assignedSubjects', 'name'), req.query)
    .filter()
    .search(['firstName', 'lastName', 'staffId', 'department'])
    .sort()
    .limitFields()
    .paginate();

  const [docs, total] = await Promise.all([features.query, Staff.countDocuments()]);

  res.status(200).json({
    status: 'success',
    results: docs.length,
    pagination: { ...features.pagination, total, pages: Math.ceil(total / features.pagination.limit) },
    data: docs,
  });
});

exports.getStaffMember = catchAsync(async (req, res, next) => {
  const staff = await Staff.findById(req.params.id).populate('assignedClasses assignedSubjects');
  if (!staff) return next(new AppError('Staff member not found.', 404));
  res.status(200).json({ status: 'success', data: staff });
});

exports.updateStaff = catchAsync(async (req, res, next) => {
  delete req.body.user;
  const staff = await Staff.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!staff) return next(new AppError('Staff member not found.', 404));
  await recordAudit({ actor: req.user.id, action: 'staff.update', targetModel: 'Staff', targetId: staff._id });
  res.status(200).json({ status: 'success', data: staff });
});

exports.deleteStaff = catchAsync(async (req, res, next) => {
  const staff = await Staff.findById(req.params.id);
  if (!staff) return next(new AppError('Staff member not found.', 404));

  await Promise.all([
    User.deleteOne({ staffProfile: staff._id }),
    Class.updateMany({ classTeacher: staff._id }, { $set: { classTeacher: null } }),
  ]);
  await staff.deleteOne();

  await recordAudit({ actor: req.user.id, action: 'staff.delete', targetModel: 'Staff', targetId: staff._id });
  res.status(204).json({ status: 'success', data: null });
});

// PATCH /api/v1/staff/:id/assignments  { classIds: [...], subjectIds: [...] }
exports.updateAssignments = catchAsync(async (req, res, next) => {
  const { classIds, subjectIds } = req.body;
  const update = {};
  if (Array.isArray(classIds)) update.assignedClasses = classIds;
  if (Array.isArray(subjectIds)) update.assignedSubjects = subjectIds;

  const staff = await Staff.findByIdAndUpdate(req.params.id, update, { new: true });
  if (!staff) return next(new AppError('Staff member not found.', 404));

  await recordAudit({ actor: req.user.id, action: 'staff.update_assignments', targetModel: 'Staff', targetId: staff._id });
  res.status(200).json({ status: 'success', data: staff });
});

exports.uploadPhoto = catchAsync(async (req, res, next) => {
  if (!req.file) return next(new AppError('No file uploaded.', 400));
  const { url } = await uploadBuffer(req.file.buffer, { folder: 'staff' });
  const staff = await Staff.findByIdAndUpdate(req.params.id, { profilePicture: url }, { new: true });
  if (!staff) return next(new AppError('Staff member not found.', 404));
  res.status(200).json({ status: 'success', data: staff });
});
