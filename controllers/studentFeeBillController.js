const StudentFeeBill = require('../models/StudentFeeBill');
const Student = require('../models/Student');
const Class = require('../models/Class');
const Staff = require('../models/Staff');
const Parent = require('../models/Parent');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');
const recordAudit = require('../utils/audit');

function recomputeTotal(bill) {
  bill.totalAmount = bill.items.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
  if (bill.amountPaid <= 0) bill.status = 'unpaid';
  else if (bill.amountPaid >= bill.totalAmount) bill.status = 'paid';
  else bill.status = 'partial';
}

// Only this student's Class Teacher (or an oversight/finance role) may
// create or edit a fee bill for them — same ownership pattern as
// results and class-wide fee items.
async function assertCanManage(req, classId) {
  const { accountType, staffRole } = req.user;
  if (accountType === 'super_admin' || ['principal', 'vice_principal', 'accountant', 'bursar'].includes(staffRole)) return;
  const staff = await Staff.findOne({ user: req.user.id });
  const classDoc = await Class.findById(classId);
  if (!classDoc) throw new AppError('Class not found.', 404);
  const isClassTeacher = !!(staff && classDoc.classTeacher && classDoc.classTeacher.equals(staff._id));
  if (!isClassTeacher) {
    throw new AppError('Only this student\'s Class Teacher or a Super Admin/Accountant can manage their fee bill.', 403);
  }
}

// Students see only their own bill; parents only their own children's;
// staff (Class Teacher of the relevant class, or finance/oversight
// roles) see what they're allowed to manage; Super Admin sees everything.
async function scopeToRequester(req) {
  const { accountType, parentProfile, studentProfile, staffRole } = req.user;
  if (['primary_student', 'secondary_student'].includes(accountType)) {
    return { student: studentProfile };
  }
  if (accountType === 'parent') {
    const parent = await Parent.findById(parentProfile);
    return { student: { $in: parent?.children || [] } };
  }
  if (accountType === 'staff' && !['principal', 'vice_principal', 'accountant', 'bursar'].includes(staffRole)) {
    const staff = await Staff.findOne({ user: req.user.id });
    const owned = staff ? await Class.find({ classTeacher: staff._id }).select('_id') : [];
    return { class: { $in: owned.map((c) => c._id) } };
  }
  return {}; // super_admin / principal / vice_principal / accountant / bursar — full visibility
}

// GET /api/v1/student-fee-bills?student=&session=&term=&class=
exports.getAllBills = catchAsync(async (req, res) => {
  const scope = await scopeToRequester(req);
  const features = { ...scope };
  if (req.query.student) features.student = req.query.student;
  if (req.query.session) features.session = req.query.session;
  if (req.query.term) features.term = req.query.term;
  if (req.query.class) features.class = req.query.class;
  // The requester's own scope always wins over the query string — apply
  // it last so a student/parent can't widen access via query params.
  Object.assign(features, scope);

  const bills = await StudentFeeBill.find(features)
    .populate('student', 'firstName lastName admissionNumber')
    .populate('class', 'name arm')
    .populate('session', 'name')
    .populate({ path: 'uploadedBy', select: 'firstName lastName' })
    .sort('-uploadedAt');

  res.status(200).json({ status: 'success', results: bills.length, data: bills });
});

exports.getBill = catchAsync(async (req, res, next) => {
  const scope = await scopeToRequester(req);
  const bill = await StudentFeeBill.findOne({ _id: req.params.id, ...scope })
    .populate('student', 'firstName lastName admissionNumber')
    .populate('class', 'name arm')
    .populate('session', 'name')
    .populate({ path: 'uploadedBy', select: 'firstName lastName' });
  if (!bill) return next(new AppError('Fee bill not found.', 404));
  res.status(200).json({ status: 'success', data: bill });
});

// POST /api/v1/student-fee-bills — Class Teacher builds/replaces a
// student's itemized bill for a session/term in one upload.
exports.upsertBill = catchAsync(async (req, res, next) => {
  const { student, class: classId, session, term, items, remarks } = req.body;
  if (!student || !classId || !session || !term || !Array.isArray(items) || !items.length) {
    return next(new AppError('student, class, session, term and at least one fee item are required.', 400));
  }
  if (items.some((i) => !i.feeName || i.amount === undefined || i.amount < 0)) {
    return next(new AppError('Every fee item needs a name and a non-negative amount.', 400));
  }

  await assertCanManage(req, classId);

  const studentDoc = await Student.findById(student);
  if (!studentDoc) return next(new AppError('Student not found.', 404));

  const staff = await Staff.findOne({ user: req.user.id });

  let bill = await StudentFeeBill.findOne({ student, session, term });
  if (!bill) {
    bill = new StudentFeeBill({ student, class: classId, session, term, uploadedBy: staff?._id });
  }
  bill.items = items.map((i) => ({ feeName: i.feeName.trim(), amount: Number(i.amount) }));
  bill.remarks = remarks || '';
  bill.uploadedBy = staff?._id || bill.uploadedBy;
  bill.uploadedAt = new Date();
  recomputeTotal(bill);
  await bill.save();

  await recordAudit({ actor: req.user.id, action: 'student_fee_bill.upsert', targetModel: 'StudentFeeBill', targetId: bill._id });

  res.status(200).json({ status: 'success', data: bill });
});

// PATCH /api/v1/student-fee-bills/:id/payment-status — Accountant/Bursar/
// Super Admin records how much of the bill has been paid so far.
exports.updatePaymentStatus = catchAsync(async (req, res, next) => {
  const { accountType, staffRole } = req.user;
  if (accountType !== 'super_admin' && !['accountant', 'bursar', 'principal', 'vice_principal'].includes(staffRole)) {
    return next(new AppError('Only Accounts/Admin staff can update a fee bill\'s payment status.', 403));
  }
  const bill = await StudentFeeBill.findById(req.params.id);
  if (!bill) return next(new AppError('Fee bill not found.', 404));

  const { amountPaid } = req.body;
  if (amountPaid === undefined || amountPaid < 0) return next(new AppError('amountPaid must be a non-negative number.', 400));
  bill.amountPaid = Number(amountPaid);
  recomputeTotal(bill);
  await bill.save();

  await recordAudit({ actor: req.user.id, action: 'student_fee_bill.payment_update', targetModel: 'StudentFeeBill', targetId: bill._id });

  res.status(200).json({ status: 'success', data: bill });
});

exports.deleteBill = catchAsync(async (req, res, next) => {
  const bill = await StudentFeeBill.findById(req.params.id);
  if (!bill) return next(new AppError('Fee bill not found.', 404));
  await assertCanManage(req, bill.class);

  await bill.deleteOne();
  await recordAudit({ actor: req.user.id, action: 'student_fee_bill.delete', targetModel: 'StudentFeeBill', targetId: bill._id });
  res.status(204).json({ status: 'success', data: null });
});
