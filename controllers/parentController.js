const Parent = require('../models/Parent');
const User = require('../models/User');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');
const ApiFeatures = require('../utils/apiFeatures');
const recordAudit = require('../utils/audit');

// GET /api/v1/parents/me — the logged-in parent's own profile, with
// children populated (name, class, section) so the dashboard can list
// them straight away.
exports.getMe = catchAsync(async (req, res, next) => {
  const parent = await Parent.findById(req.user.parentProfile).populate({
    path: 'children',
    select: 'firstName lastName admissionNumber section class',
    populate: { path: 'class', select: 'name arm' },
  });
  if (!parent) return next(new AppError('Parent profile not found.', 404));
  res.status(200).json({ status: 'success', data: parent });
});

// GET /api/v1/parents — Super Admin only
exports.getAllParents = catchAsync(async (req, res) => {
  const features = new ApiFeatures(
    Parent.find().populate('user', 'email status').populate('children', 'firstName lastName admissionNumber'),
    req.query
  )
    .filter()
    .search(['firstName', 'lastName'])
    .sort()
    .limitFields()
    .paginate();

  const [docs, total] = await Promise.all([features.query, Parent.countDocuments(features.query.getFilter())]);

  res.status(200).json({
    status: 'success',
    results: docs.length,
    pagination: { ...features.pagination, total, pages: Math.ceil(total / features.pagination.limit) },
    data: docs,
  });
});

exports.getParent = catchAsync(async (req, res, next) => {
  const parent = await Parent.findById(req.params.id).populate('user', 'email status').populate('children', 'firstName lastName admissionNumber class');
  if (!parent) return next(new AppError('Parent not found.', 404));
  res.status(200).json({ status: 'success', data: parent });
});

// PATCH /api/v1/parents/:id — Super Admin edits contact details or, most
// commonly, the linked children (this is the "link a parent to their
// child" action used from Admin → Parent Management).
exports.updateParent = catchAsync(async (req, res, next) => {
  const parent = await Parent.findById(req.params.id);
  if (!parent) return next(new AppError('Parent not found.', 404));

  const { firstName, lastName, relationship, occupation, address, alternatePhone, children } = req.body;
  Object.assign(parent, {
    firstName: firstName ?? parent.firstName,
    lastName: lastName ?? parent.lastName,
    relationship: relationship ?? parent.relationship,
    occupation: occupation ?? parent.occupation,
    address: address ?? parent.address,
    alternatePhone: alternatePhone ?? parent.alternatePhone,
    children: Array.isArray(children) ? children : parent.children,
  });
  await parent.save();

  await recordAudit({ actor: req.user.id, action: 'parent.update', targetModel: 'Parent', targetId: parent._id });
  res.status(200).json({ status: 'success', data: parent });
});

exports.deleteParent = catchAsync(async (req, res, next) => {
  const parent = await Parent.findById(req.params.id);
  if (!parent) return next(new AppError('Parent not found.', 404));

  await User.deleteOne({ parentProfile: parent._id });
  await parent.deleteOne();

  await recordAudit({ actor: req.user.id, action: 'parent.delete', targetModel: 'Parent', targetId: parent._id });
  res.status(204).json({ status: 'success', data: null });
});
