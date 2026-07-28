const Fee = require('../models/Fee');
const Staff = require('../models/Staff');
const Class = require('../models/Class');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');
const ApiFeatures = require('../utils/apiFeatures');
const recordAudit = require('../utils/audit');

// Fee items are the "payment plan" for a class — school fees, excursions,
// books/textbooks, equipment, etc. Whoever is the Class Teacher for a
// class manages that class's fee items directly (this is what shows up
// in the parent portal); financial staff (Accountant/Bursar) and
// Super Admin/Principal/Vice Principal can manage any class's fee items.
// Students never see fee items at all — only their guardians do.
async function assertCanManage(req, classId) {
  const { accountType, staffRole } = req.user;
  if (['primary_student', 'secondary_student'].includes(accountType)) {
    throw new AppError('Fees are not available in the student portal.', 403);
  }
  if (accountType === 'super_admin' || ['principal', 'vice_principal', 'accountant', 'bursar'].includes(staffRole)) {
    return; // school-wide financial/oversight access
  }
  const staff = await Staff.findOne({ user: req.user.id });
  const classDoc = await Class.findById(classId);
  if (!classDoc) throw new AppError('Class not found.', 404);
  const isClassTeacher = !!(staff && classDoc.classTeacher && classDoc.classTeacher.equals(staff._id));
  if (!isClassTeacher) {
    throw new AppError('Only this class\'s Class Teacher or a Super Admin/Accountant can manage its fee items.', 403);
  }
}

// GET /api/v1/fees — students are blocked entirely; everyone else (staff,
// admin, parents) can browse, typically filtered by ?class=<id>.
exports.getAllFees = catchAsync(async (req, res, next) => {
  if (['primary_student', 'secondary_student'].includes(req.user.accountType)) {
    return next(new AppError('Fees are not available in the student portal.', 403));
  }
  const features = new ApiFeatures(Fee.find().populate('class session'), req.query).filter().sort().limitFields().paginate();
  const [docs, total] = await Promise.all([features.query, Fee.countDocuments(features.query.getFilter())]);
  res.status(200).json({
    status: 'success',
    results: docs.length,
    pagination: { ...features.pagination, total, pages: Math.ceil(total / features.pagination.limit) },
    data: docs,
  });
});

exports.getFee = catchAsync(async (req, res, next) => {
  if (['primary_student', 'secondary_student'].includes(req.user.accountType)) {
    return next(new AppError('Fees are not available in the student portal.', 403));
  }
  const fee = await Fee.findById(req.params.id).populate('class session');
  if (!fee) return next(new AppError('Fee item not found.', 404));
  res.status(200).json({ status: 'success', data: fee });
});

exports.createFee = catchAsync(async (req, res, next) => {
  const { class: classId, session, term, feeType, amount, dueDate } = req.body;
  if (!classId || !session || !term || !feeType || amount === undefined) {
    return next(new AppError('class, session, term, feeType and amount are required.', 400));
  }
  await assertCanManage(req, classId);

  const fee = await Fee.create({ class: classId, session, term, feeType, amount, dueDate, createdBy: req.user.id });
  await recordAudit({ actor: req.user.id, action: 'fee.create', targetModel: 'Fee', targetId: fee._id });
  res.status(201).json({ status: 'success', data: fee });
});

exports.updateFee = catchAsync(async (req, res, next) => {
  const fee = await Fee.findById(req.params.id);
  if (!fee) return next(new AppError('Fee item not found.', 404));
  await assertCanManage(req, fee.class);

  Object.assign(fee, {
    feeType: req.body.feeType ?? fee.feeType,
    amount: req.body.amount ?? fee.amount,
    dueDate: req.body.dueDate ?? fee.dueDate,
    term: req.body.term ?? fee.term,
  });
  await fee.save();

  await recordAudit({ actor: req.user.id, action: 'fee.update', targetModel: 'Fee', targetId: fee._id });
  res.status(200).json({ status: 'success', data: fee });
});

exports.deleteFee = catchAsync(async (req, res, next) => {
  const fee = await Fee.findById(req.params.id);
  if (!fee) return next(new AppError('Fee item not found.', 404));
  await assertCanManage(req, fee.class);

  await fee.deleteOne();
  await recordAudit({ actor: req.user.id, action: 'fee.delete', targetModel: 'Fee', targetId: fee._id });
  res.status(204).json({ status: 'success', data: null });
});
