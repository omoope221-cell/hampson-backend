const Student = require('../models/Student');
const Staff = require('../models/Staff');
const Payment = require('../models/Payment');
const Result = require('../models/Result');
const catchAsync = require('../utils/catchAsync');

// Turns an aggregate's [{_id: 'primary', count}, ...] rows into a plain
// {primary, secondary, both} object, folding anything unexpected
// (including docs with no value at all, e.g. staff saved before the
// `section` field existed) into `both` — the same "shows up everywhere"
// meaning `both`/unset already has elsewhere in the app.
function bucketBySection(rows) {
  const out = { primary: 0, secondary: 0, both: 0 };
  rows.forEach((r) => {
    if (r._id === 'primary' || r._id === 'secondary') out[r._id] = r.count;
    else out.both += r.count;
  });
  return out;
}

// GET /api/v1/dashboard/summary — shape of the response depends on accountType
exports.getSummary = catchAsync(async (req, res) => {
  const { accountType, studentProfile } = req.user;

  if (accountType === 'super_admin' || (accountType === 'staff' && req.user.staffRole !== 'teacher')) {
    const [studentCount, staffCount, revenueAgg, studentsBySectionRaw, staffBySectionRaw] = await Promise.all([
      Student.countDocuments({ status: 'active' }),
      Staff.countDocuments({ status: 'active' }),
      Payment.aggregate([{ $match: { status: 'completed' } }, { $group: { _id: null, total: { $sum: '$amountPaid' } } }]),
      Student.aggregate([
        { $match: { status: 'active' } },
        { $group: { _id: '$section', count: { $sum: 1 } } },
      ]),
      Staff.aggregate([
        { $match: { status: 'active' } },
        { $group: { _id: '$section', count: { $sum: 1 } } },
      ]),
    ]);

    const studentsBySection = bucketBySection(studentsBySectionRaw); // { primary, secondary } — Student.section is required, so `both` here will always be 0
    const staffBySection = bucketBySection(staffBySectionRaw); // { primary, secondary, both: teach across both / not set yet }

    return res.status(200).json({
      status: 'success',
      data: {
        studentCount, staffCount,
        totalRevenue: revenueAgg[0]?.total || 0,
        studentsBySection,
        staffBySection,
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
