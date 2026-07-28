const Student = require('../models/Student');
const Staff = require('../models/Staff');
const Payment = require('../models/Payment');
const Result = require('../models/Result');
const catchAsync = require('../utils/catchAsync');

// GET /api/v1/dashboard/summary — shape of the response depends on accountType
exports.getSummary = catchAsync(async (req, res) => {
  const { accountType, studentProfile } = req.user;

  if (accountType === 'super_admin' || (accountType === 'staff' && req.user.staffRole !== 'teacher')) {
    const [studentCount, staffCount, revenueAgg] = await Promise.all([
      Student.countDocuments({ status: 'active' }),
      Staff.countDocuments({ status: 'active' }),
      Payment.aggregate([{ $match: { status: 'completed' } }, { $group: { _id: null, total: { $sum: '$amountPaid' } } }]),
    ]);
    return res.status(200).json({
      status: 'success',
      data: {
        studentCount, staffCount,
        totalRevenue: revenueAgg[0]?.total || 0,
      },
    });
  }

  if (accountType === 'staff' && req.user.staffRole === 'teacher') {
    const staff = await Staff.findById(req.user.staffProfile);
    const classCount = staff?.assignedClasses?.length || 0;
    const studentCount = await Student.countDocuments({ class: { $in: staff?.assignedClasses || [] } });
    return res.status(200).json({ status: 'success', data: { classCount, studentCount } });
  }

  if (accountType === 'primary_student' || accountType === 'secondary_student') {
    const resultCount = await Result.countDocuments({ student: studentProfile, status: 'approved' });
    return res.status(200).json({ status: 'success', data: { approvedResults: resultCount } });
  }

  res.status(200).json({ status: 'success', data: {} });
});
