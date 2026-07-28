const Student = require('../models/Student');
const Class = require('../models/Class');
const User = require('../models/User');
const Parent = require('../models/Parent');
const Result = require('../models/Result');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');
const ApiFeatures = require('../utils/apiFeatures');
const recordAudit = require('../utils/audit');
const { uploadBuffer } = require('../utils/cloudinaryUpload');

// Applies row-level scoping on top of the base query depending on who is asking.
async function scopeToRequester(req, baseFilter = {}) {
  const { accountType, staffProfile, parentProfile, studentProfile } = req.user;

  if (accountType === 'super_admin' || accountType === 'staff') {
    // Teachers only see students in their assigned classes; other staff
    // roles with students.view permission see everyone.
    if (req.user.staffRole === 'teacher') {
      const Staff = require('../models/Staff');
      const staff = await Staff.findById(staffProfile);
      return { ...baseFilter, class: { $in: staff?.assignedClasses || [] } };
    }
    return baseFilter;
  }
  if (accountType === 'parent') {
    const Parent = require('../models/Parent');
    const parent = await Parent.findById(parentProfile);
    return { ...baseFilter, _id: { $in: parent?.children || [] } };
  }
  if (accountType === 'primary_student' || accountType === 'secondary_student') {
    return { ...baseFilter, _id: studentProfile };
  }
  return { ...baseFilter, _id: null }; // no access by default
}

exports.getAllStudents = catchAsync(async (req, res) => {
  const scoped = await scopeToRequester(req);

  const features = new ApiFeatures(Student.find(scoped).populate('class', 'name section arm'), req.query)
    .filter()
    .search(['firstName', 'lastName', 'admissionNumber'])
    .sort()
    .limitFields()
    .paginate();

  const [docs, total] = await Promise.all([features.query, Student.countDocuments(scoped)]);

  res.status(200).json({
    status: 'success',
    results: docs.length,
    pagination: { ...features.pagination, total, pages: Math.ceil(total / features.pagination.limit) },
    data: docs,
  });
});

exports.getStudent = catchAsync(async (req, res, next) => {
  const scoped = await scopeToRequester(req, { _id: req.params.id });
  const student = await Student.findOne(scoped).populate('class parents');
  if (!student) return next(new AppError('Student not found or access denied.', 404));
  res.status(200).json({ status: 'success', data: student });
});

exports.updateStudent = catchAsync(async (req, res, next) => {
  const disallowed = ['user', 'admissionNumber'];
  disallowed.forEach((f) => delete req.body[f]);

  const student = await Student.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!student) return next(new AppError('Student not found.', 404));

  await recordAudit({ actor: req.user.id, action: 'student.update', targetModel: 'Student', targetId: student._id });
  res.status(200).json({ status: 'success', data: student });
});

exports.deleteStudent = catchAsync(async (req, res, next) => {
  const student = await Student.findById(req.params.id);
  if (!student) return next(new AppError('Student not found.', 404));

  await Promise.all([
    User.deleteOne({ studentProfile: student._id }),
    Parent.updateMany({ children: student._id }, { $pull: { children: student._id } }),
    Result.deleteMany({ student: student._id }),
  ]);
  await student.deleteOne();

  await recordAudit({ actor: req.user.id, action: 'student.delete', targetModel: 'Student', targetId: student._id });
  res.status(204).json({ status: 'success', data: null });
});

// POST /api/v1/students/promote  { studentIds: [...], toClassId }
exports.promoteStudents = catchAsync(async (req, res, next) => {
  const { studentIds, toClassId } = req.body;
  if (!Array.isArray(studentIds) || !studentIds.length || !toClassId) {
    return next(new AppError('studentIds (array) and toClassId are required.', 400));
  }
  const targetClass = await Class.findById(toClassId);
  if (!targetClass) return next(new AppError('Target class not found.', 404));

  await Student.updateMany({ _id: { $in: studentIds } }, { class: toClassId });

  await recordAudit({
    actor: req.user.id,
    action: 'student.promote',
    details: { studentIds, toClassId },
  });

  res.status(200).json({ status: 'success', message: `${studentIds.length} student(s) promoted.` });
});

exports.uploadPhoto = catchAsync(async (req, res, next) => {
  if (!req.file) return next(new AppError('No file uploaded.', 400));
  const { url } = await uploadBuffer(req.file.buffer, { folder: 'students' });
  const student = await Student.findByIdAndUpdate(
    req.params.id,
    { passportPhoto: url },
    { new: true }
  );
  if (!student) return next(new AppError('Student not found.', 404));
  res.status(200).json({ status: 'success', data: student });
});
