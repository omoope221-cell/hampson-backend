const Payment = require('../models/Payment');
const Parent = require('../models/Parent');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');
const ApiFeatures = require('../utils/apiFeatures');
const recordAudit = require('../utils/audit');

async function scopeToRequester(req, baseFilter = {}) {
  const { accountType, parentProfile, studentProfile } = req.user;
  if (['primary_student', 'secondary_student'].includes(accountType)) {
    // Students don't see fees/payments at all — only their guardians do.
    return { ...baseFilter, _id: null }; // matches nothing
  }
  if (accountType === 'parent') {
    const parent = await Parent.findById(parentProfile);
    return { ...baseFilter, student: { $in: parent?.children || [] } };
  }
  if (accountType === 'primary_student' || accountType === 'secondary_student') {
    return { ...baseFilter, student: studentProfile };
  }
  return baseFilter;
}

const Student = require('../models/Student');

async function scopeToRequester(req, baseFilter = {}) {
  const { accountType, parentProfile, studentProfile } = req.user;
  if (accountType === 'parent') {
    const parent = await Parent.findById(parentProfile);
    return { ...baseFilter, student: { $in: parent?.children || [] } };
  }
  if (accountType === 'primary_student' || accountType === 'secondary_student') {
    return { ...baseFilter, student: studentProfile };
  }
  return baseFilter;
}

exports.getAllPayments = catchAsync(async (req, res, next) => {
  if (['primary_student', 'secondary_student'].includes(req.user.accountType)) {
    return next(new AppError('Fees and payments are not available in the student portal.', 403));
  }
  const scoped = await scopeToRequester(req);
  const features = new ApiFeatures(Payment.find(), req.query).filter().sort().limitFields().paginate();
  // Applied AFTER the user's own query filter, so it always wins.
  features.query = features.query
    .find(scoped)
    .populate('student', 'firstName lastName admissionNumber')
    .populate('fee');

  const finalFilter = features.query.getFilter();
  const [docs, total] = await Promise.all([features.query, Payment.countDocuments(finalFilter)]);

  res.status(200).json({
    status: 'success',
    results: docs.length,
    pagination: { ...features.pagination, total, pages: Math.ceil(total / features.pagination.limit) },
    data: docs,
  });
});

exports.recordPayment = catchAsync(async (req, res, next) => {
  const { student, fee, amountPaid, method, reference } = req.body;
  if (!student || !fee || !amountPaid || !method) {
    return next(new AppError('student, fee, amountPaid and method are required.', 400));
  }

  const payment = await Payment.create({
    student, fee, amountPaid, method, reference, recordedBy: req.user.id,
  });

  await recordAudit({ actor: req.user.id, action: 'payment.record', targetModel: 'Payment', targetId: payment._id, details: { amountPaid } });

  res.status(201).json({ status: 'success', data: payment });
});

// GET /api/v1/payments/balance?studentId=... — students can never reach
// this (fees/payments aren't part of the student portal); a parent may
// only query balance for one of their own children; staff/admin may
// query any student.
exports.getStudentBalance = catchAsync(async (req, res, next) => {
  const { studentId } = req.query;
  if (!studentId) return next(new AppError('studentId query param is required.', 400));

  const { accountType, parentProfile } = req.user;
  if (['primary_student', 'secondary_student'].includes(accountType)) {
    return next(new AppError('Fees and payments are not available in the student portal.', 403));
  }
  if (accountType === 'parent') {
    const parent = await Parent.findById(parentProfile);
    const isMyChild = (parent?.children || []).some((c) => c.toString() === studentId);
    if (!isMyChild) return next(new AppError('You can only view balances for your own children.', 403));
  }

  const mongoose = require('mongoose');
  const Fee = require('../models/Fee');

  const student = await Student.findById(studentId);
  if (!student) return next(new AppError('Student not found.', 404));

  const fees = await Fee.find({ class: student.class });
  const payments = await Payment.aggregate([
    { $match: { student: new mongoose.Types.ObjectId(studentId), status: 'completed' } },
    { $group: { _id: '$fee', totalPaid: { $sum: '$amountPaid' } } },
  ]);
  const paidMap = Object.fromEntries(payments.map((p) => [p._id.toString(), p.totalPaid]));

  const breakdown = fees.map((f) => ({
    fee: f,
    paid: paidMap[f._id.toString()] || 0,
    balance: f.amount - (paidMap[f._id.toString()] || 0),
  }));

  res.status(200).json({
    status: 'success',
    data: {
      totalDue: fees.reduce((s, f) => s + f.amount, 0),
      totalPaid: breakdown.reduce((s, b) => s + b.paid, 0),
      breakdown,
    },
  });
});
