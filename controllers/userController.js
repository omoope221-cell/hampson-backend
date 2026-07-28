const mongoose = require('mongoose');
const User = require('../models/User');
const Student = require('../models/Student');
const Staff = require('../models/Staff');
const Parent = require('../models/Parent');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');
const ApiFeatures = require('../utils/apiFeatures');
const recordAudit = require('../utils/audit');
const { DEFAULT_STAFF_PERMISSIONS, ROLE_LABELS, loginPathFor } = require('../config/roles');
const { sendEmail } = require('../utils/email');
const { welcomeTemplate, accountStatusTemplate, tempPasswordIssuedTemplate } = require('../utils/emailTemplates');
const { nextStudentId } = require('../utils/idGenerator');
const { randomTempPassword } = require('../utils/randomPassword');

// Fire-and-forget: a Brevo hiccup must never block account creation.
function sendWelcomeEmailSafe({ user, tempPassword, loginIdentifier }) {
  const { subject, html } = welcomeTemplate({
    fullName: user.fullName,
    roleLabel: ROLE_LABELS[user.accountType] || 'User',
    loginIdentifier,
    tempPassword,
    loginPath: loginPathFor(user.accountType),
  });
  sendEmail({ to: user.email, toName: user.fullName, subject, html }).catch(() => {});
}

// GET /api/v1/users?accountType=staff&status=active&search=john
exports.getAllUsers = catchAsync(async (req, res) => {
  const features = new ApiFeatures(User.find(), req.query)
    .filter()
    .search(['fullName', 'email', 'username'])
    .sort()
    .limitFields()
    .paginate();

  const [docs, total] = await Promise.all([
    features.query,
    User.countDocuments(features.query.getFilter()),
  ]);

  res.status(200).json({
    status: 'success',
    results: docs.length,
    pagination: { ...features.pagination, total, pages: Math.ceil(total / features.pagination.limit) },
    data: docs,
  });
});

exports.getUser = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.params.id)
    .populate('studentProfile staffProfile parentProfile');
  if (!user) return next(new AppError('User not found.', 404));
  res.status(200).json({ status: 'success', data: user });
});

// POST /api/v1/users/staff  — creates a User + linked Staff profile
exports.createStaffAccount = catchAsync(async (req, res, next) => {
  const { fullName, email, phone, role, department, staffId, tempPassword, assignedClasses, assignedSubjects } = req.body;
  if (!fullName || !email || !role || !staffId) {
    return next(new AppError('fullName, email, role and staffId are required.', 400));
  }

  const password = tempPassword || randomTempPassword();

  const session = await mongoose.startSession();
  let user;
  try {
    await session.withTransaction(async () => {
      const [createdUser] = await User.create(
        [
          {
            fullName,
            email,
            username: staffId,
            phone,
            passwordHash: password,
            accountType: role === 'super_admin' ? 'super_admin' : 'staff',
            staffRole: role,
            permissions: DEFAULT_STAFF_PERMISSIONS[role] || [],
            mustChangePassword: false,
          },
        ],
        { session }
      );

      const [staffProfile] = await Staff.create(
        [
          {
            user: createdUser._id,
            staffId,
            firstName: req.body.firstName || fullName.split(' ')[0],
            lastName: req.body.lastName || fullName.split(' ').slice(1).join(' ') || fullName,
            role,
            department,
            assignedClasses: Array.isArray(assignedClasses) ? assignedClasses : [],
            assignedSubjects: Array.isArray(assignedSubjects) ? assignedSubjects : [],
          },
        ],
        { session }
      );

      createdUser.staffProfile = staffProfile._id;
      await createdUser.save({ session });
      user = createdUser;
    });
  } finally {
    session.endSession();
  }

  await recordAudit({ actor: req.user.id, action: 'user.create_staff', targetModel: 'User', targetId: user._id });
  sendWelcomeEmailSafe({ user, tempPassword: password, loginIdentifier: user.email });

  res.status(201).json({
    status: 'success',
    data: user.toSafeJSON(),
    tempPassword: password,
    note: 'Share this temporary password with the staff member securely. They will be required to change it on first login.',
  });
});

// POST /api/v1/users/parent
exports.createParentAccount = catchAsync(async (req, res, next) => {
  const { fullName, email, phone, firstName, lastName, relationship, tempPassword, children } = req.body;
  if (!fullName || !email) return next(new AppError('fullName and email are required.', 400));

  const password = tempPassword || randomTempPassword();

  const session = await mongoose.startSession();
  let user;
  try {
    await session.withTransaction(async () => {
      const [createdUser] = await User.create(
        [{ fullName, email, phone, passwordHash: password, accountType: 'parent', mustChangePassword: false }],
        { session }
      );
      const [parentProfile] = await Parent.create(
        [
          {
            user: createdUser._id,
            firstName: firstName || fullName.split(' ')[0],
            lastName: lastName || fullName.split(' ').slice(1).join(' ') || fullName,
            relationship: relationship || 'guardian',
            children: Array.isArray(children) ? children : [],
          },
        ],
        { session }
      );
      createdUser.parentProfile = parentProfile._id;
      await createdUser.save({ session });
      user = createdUser;
    });
  } finally {
    session.endSession();
  }

  await recordAudit({ actor: req.user.id, action: 'user.create_parent', targetModel: 'User', targetId: user._id });
  sendWelcomeEmailSafe({ user, tempPassword: password, loginIdentifier: user.email });

  res.status(201).json({ status: 'success', data: user.toSafeJSON(), tempPassword: password });
});

// POST /api/v1/users/student
exports.createStudentAccount = catchAsync(async (req, res, next) => {
  const {
    fullName, email, section, class: classId,
    firstName, lastName, dateOfBirth, gender, parentIds, tempPassword, department,
  } = req.body;

  if (!fullName || !email || !section || !classId) {
    return next(new AppError('fullName, email, section and class are required.', 400));
  }
  if (!['primary', 'secondary'].includes(section)) {
    return next(new AppError('section must be "primary" or "secondary".', 400));
  }

  const password = tempPassword || randomTempPassword();
  const accountType = section === 'primary' ? 'primary_student' : 'secondary_student';
  // Student ID is always system-generated (HMP0001, HMP0002, ...) — never
  // typed in by the Super Admin — so it can never collide or be reused.
  const admissionNumber = await nextStudentId();

  const session = await mongoose.startSession();
  let user;
  try {
    await session.withTransaction(async () => {
      const [createdUser] = await User.create(
        [{ fullName, email, username: admissionNumber, passwordHash: password, accountType, mustChangePassword: false }],
        { session }
      );

      const [studentProfile] = await Student.create(
        [
          {
            user: createdUser._id,
            admissionNumber,
            firstName: firstName || fullName.split(' ')[0],
            lastName: lastName || fullName.split(' ').slice(1).join(' ') || fullName,
            dateOfBirth,
            gender,
            section,
            department: department || '',
            class: classId,
            parents: parentIds || [],
          },
        ],
        { session }
      );

      createdUser.studentProfile = studentProfile._id;
      await createdUser.save({ session });

      if (Array.isArray(parentIds) && parentIds.length) {
        await Parent.updateMany(
          { _id: { $in: parentIds } },
          { $addToSet: { children: studentProfile._id } },
          { session }
        );
      }

      user = createdUser;
    });
  } finally {
    session.endSession();
  }

  await recordAudit({ actor: req.user.id, action: 'user.create_student', targetModel: 'User', targetId: user._id });
  sendWelcomeEmailSafe({ user, tempPassword: password, loginIdentifier: admissionNumber });

  res.status(201).json({ status: 'success', data: user.toSafeJSON(), tempPassword: password, studentId: admissionNumber });
});

// PATCH /api/v1/users/:id/status  { status: 'active' | 'suspended' | 'inactive' }
exports.updateStatus = catchAsync(async (req, res, next) => {
  const { status } = req.body;
  if (!['active', 'suspended', 'inactive'].includes(status)) {
    return next(new AppError('Invalid status value.', 400));
  }
  const user = await User.findByIdAndUpdate(req.params.id, { status }, { new: true });
  if (!user) return next(new AppError('User not found.', 404));

  await recordAudit({
    actor: req.user.id,
    action: `user.set_status.${status}`,
    targetModel: 'User',
    targetId: user._id,
  });

  if (status === 'active' || status === 'suspended' || status === 'inactive') {
    const { subject, html } = accountStatusTemplate({
      fullName: user.fullName,
      status: status === 'active' ? 'active' : 'inactive',
    });
    sendEmail({ to: user.email, toName: user.fullName, subject, html }).catch(() => {});
  }

  res.status(200).json({ status: 'success', data: user.toSafeJSON() });
});

// PATCH /api/v1/users/:id/permissions  { permissions: [...] }
// Super Admin fine-tunes exactly which modules a staff member can access.
exports.updatePermissions = catchAsync(async (req, res, next) => {
  const { permissions } = req.body;
  if (!Array.isArray(permissions)) return next(new AppError('permissions must be an array.', 400));

  const user = await User.findByIdAndUpdate(req.params.id, { permissions }, { new: true });
  if (!user) return next(new AppError('User not found.', 404));

  await recordAudit({
    actor: req.user.id,
    action: 'user.update_permissions',
    targetModel: 'User',
    targetId: user._id,
    details: { permissions },
  });

  res.status(200).json({ status: 'success', data: user.toSafeJSON() });
});

// DELETE /api/v1/users/:id
exports.deleteUser = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.params.id);
  if (!user) return next(new AppError('User not found.', 404));

  if (user.accountType === 'staff' && user.staffProfile) {
    await Staff.findByIdAndDelete(user.staffProfile);
    const Class = require('../models/Class');
    await Class.updateMany({ classTeacher: user.staffProfile }, { $set: { classTeacher: null } });
  } else if (['primary_student', 'secondary_student'].includes(user.accountType) && user.studentProfile) {
    await Student.findByIdAndDelete(user.studentProfile);
    await Parent.updateMany({ children: user.studentProfile }, { $pull: { children: user.studentProfile } });
    const Result = require('../models/Result');
    await Result.deleteMany({ student: user.studentProfile });
  } else if (user.accountType === 'parent' && user.parentProfile) {
    await Parent.findByIdAndDelete(user.parentProfile);
  }

  await user.deleteOne();

  await recordAudit({ actor: req.user.id, action: 'user.delete', targetModel: 'User', targetId: user._id });

  res.status(204).json({ status: 'success', data: null });
});

// POST /api/v1/users/:id/reset-password  — admin-triggered reset
// POST /api/v1/users/:id/reset-password  — admin-triggered reset for
// Student and Staff accounts only. Admin accounts use the separate
// OTP-based self-service flow in passwordController.js instead.
exports.adminResetPassword = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.params.id);
  if (!user) return next(new AppError('User not found.', 404));
  if (user.accountType === 'super_admin') {
    return next(new AppError('Admin accounts reset their own password via the Admin Portal\u2019s Forgot Password flow.', 400));
  }

  const password = randomTempPassword();
  user.passwordHash = password;
  user.mustChangePassword = false;
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  await user.save();

  await recordAudit({
    actor: req.user.id,
    action: 'user.admin_reset_password',
    targetModel: 'User',
    targetId: user._id,
    details: {
      accountType: user.accountType,
      targetName: user.fullName,
      targetIdentifier: user.username || user.email,
      tempPasswordGenerated: true,
    },
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });

  const { subject, html } = tempPasswordIssuedTemplate({
    fullName: user.fullName,
    tempPassword: password,
    loginPath: loginPathFor(user.accountType),
  });
  sendEmail({ to: user.email, toName: user.fullName, subject, html }).catch(() => {});

  res.status(200).json({ status: 'success', tempPassword: password });
});

// GET /api/v1/users/password-reset-logs — history for the Password
// Management dashboard: who reset which account, and when.
exports.getPasswordResetLogs = catchAsync(async (req, res) => {
  const AuditLog = require('../models/AuditLog');
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);

  const logs = await AuditLog.find({
    action: { $in: ['user.admin_reset_password', 'auth.forgot_password_reset'] },
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('actor', 'fullName email accountType');

  res.status(200).json({ status: 'success', results: logs.length, data: logs });
});