const mongoose = require('mongoose');
const AdmissionApplication = require('../models/AdmissionApplication');
const SiteSettings = require('../models/SiteSettings');
const User = require('../models/User');
const Student = require('../models/Student');
const Class = require('../models/Class');
const Notification = require('../models/Notification');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');
const ApiFeatures = require('../utils/apiFeatures');
const recordAudit = require('../utils/audit');
const { sendEmail } = require('../utils/email');
const {
  admissionInstructionsTemplate,
  admissionApprovedTemplate,
  admissionRejectedTemplate,
  welcomeTemplate,
} = require('../utils/emailTemplates');
const { uploadBuffer } = require('../utils/cloudinaryUpload');
const { nextStudentId, nextApplicationNumber } = require('../utils/idGenerator');
const { randomTempPassword } = require('../utils/randomPassword');

const DOCUMENT_FIELDS = [
  { field: 'birthCertificate', label: 'Birth Certificate' },
  { field: 'reportCard', label: 'Previous Report Card' },
  { field: 'passportPhoto', label: 'Passport Photograph' },
];

// POST /api/v1/public/admissions/submit — no auth.
// The entire public application flow: fill form, upload documents, submit.
// There is NO online payment and NO online entrance exam. The application
// is created immediately with an application number, and the system
// automatically emails the guardian the amount to pay, the date to come to
// the school, the entrance exam date/time, and the school's contact
// details — payment and the exam both happen physically at the school.
exports.submitApplication = catchAsync(async (req, res, next) => {
  const {
    studentFullName, dateOfBirth, gender, gradeApplyingFor, previousSchool,
    guardianName, guardianEmail, guardianPhone, guardianRelationship, address, state, country, notes,
  } = req.body;

  if (!studentFullName || !dateOfBirth || !gender || !gradeApplyingFor || !guardianName || !guardianEmail || !guardianPhone) {
    return next(new AppError('Please fill in all required fields.', 400));
  }

  const settings = await SiteSettings.getSingleton();
  if (settings.admissions.status !== 'open') {
    return next(new AppError('Admissions are currently closed.', 400));
  }

  const documents = [];
  for (const { field, label } of DOCUMENT_FIELDS) {
    const file = req.files?.[field]?.[0];
    if (!file) continue;
    const { url, publicId } = await uploadBuffer(file.buffer, { folder: 'admissions', resourceType: 'auto' });
    documents.push({ label, url, publicId });
  }

  const application = await AdmissionApplication.create({
    studentFullName, dateOfBirth, gender, gradeApplyingFor, previousSchool,
    guardianName, guardianEmail, guardianPhone, guardianRelationship, address, state, country, notes,
    documents,
    applicationNumber: await nextApplicationNumber(),
    admissionFeeAmount: settings.admissions.admissionFeeAmount,
    schoolVisitDate: settings.admissions.schoolVisitDate,
    examDate: settings.admissions.examDate,
    examStartTime: settings.admissions.examStartTime,
    examEndTime: settings.admissions.examEndTime,
    examDurationMinutes: settings.admissions.examDurationMinutes,
  });

  const { subject, html } = admissionInstructionsTemplate({
    guardianName,
    studentFullName,
    applicationNumber: application.applicationNumber,
    admissionFeeAmount: application.admissionFeeAmount,
    schoolVisitDate: application.schoolVisitDate,
    examDate: application.examDate,
    examStartTime: application.examStartTime,
    examEndTime: application.examEndTime,
    examDurationMinutes: application.examDurationMinutes,
    schoolAddress: settings.address,
    schoolPhones: settings.phones,
    schoolEmail: settings.admissionsEmail || settings.email,
    instructions: settings.admissions.instructions,
  });
  const emailResult = await sendEmail({ to: guardianEmail, toName: guardianName, subject, html });
  if (emailResult.sent) {
    application.instructionsEmailSentAt = new Date();
    await application.save();
  }

  const admins = await User.find({ accountType: 'super_admin', status: 'active' }).select('_id');
  if (admins.length) {
    await Notification.insertMany(
      admins.map((admin) => ({
        user: admin._id,
        title: 'New admission application',
        body: `${application.studentFullName} — ${application.applicationNumber}`,
        type: 'system',
        link: '/admin/dashboard/admissions/applications',
      }))
    );
  }

  res.status(201).json({ status: 'success', data: { applicationNumber: application.applicationNumber } });
});

// GET /api/v1/admissions — admin list, filterable by status
exports.getAllApplications = catchAsync(async (req, res) => {
  const features = new ApiFeatures(AdmissionApplication.find(), req.query).filter().sort().paginate();
  const [docs, total, pendingCount] = await Promise.all([
    features.query,
    AdmissionApplication.countDocuments(),
    AdmissionApplication.countDocuments({ status: 'pending' }),
  ]);

  res.status(200).json({
    status: 'success',
    results: docs.length,
    pendingCount,
    pagination: { ...features.pagination, total, pages: Math.ceil(total / features.pagination.limit) },
    data: docs,
  });
});

exports.getApplication = catchAsync(async (req, res, next) => {
  const application = await AdmissionApplication.findById(req.params.id);
  if (!application) return next(new AppError('Application not found.', 404));
  res.status(200).json({ status: 'success', data: application });
});

// PATCH /api/v1/admissions/:id/status  { status: 'approved'|'rejected', reviewNotes? }
// Approving auto-generates a Student ID + login and moves the applicant
// into the real Student database.
exports.updateStatus = catchAsync(async (req, res, next) => {
  const { status, reviewNotes, classId } = req.body;
  if (!['pending', 'approved', 'rejected'].includes(status)) {
    return next(new AppError('status must be pending, approved, or rejected.', 400));
  }

  const application = await AdmissionApplication.findById(req.params.id);
  if (!application) return next(new AppError('Application not found.', 404));

  let classDoc = null;
  if (status === 'approved' && !application.createdStudentUser) {
    if (!classId) return next(new AppError('Please select a class to place the student in before approving.', 400));
    classDoc = await Class.findById(classId);
    if (!classDoc) return next(new AppError('Selected class was not found.', 404));
  }

  application.status = status;
  application.reviewNotes = reviewNotes;
  application.reviewedBy = req.user.id;
  application.reviewedAt = new Date();

  let studentCredentials = null;

  if (status === 'approved' && !application.createdStudentUser) {
    const accountType = classDoc.section === 'secondary' ? 'secondary_student' : 'primary_student';
    const admissionNumber = await nextStudentId();
    const password = randomTempPassword();

    const [firstName, ...rest] = application.studentFullName.split(' ');
    const lastName = rest.join(' ') || application.studentFullName;

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const [createdUser] = await User.create(
          [{
            fullName: application.studentFullName,
            email: application.guardianEmail,
            username: admissionNumber,
            passwordHash: password,
            accountType,
            mustChangePassword: false,
          }],
          { session }
        );

        const [studentProfile] = await Student.create(
          [{
            user: createdUser._id,
            admissionNumber,
            firstName,
            lastName,
            dateOfBirth: application.dateOfBirth,
            gender: application.gender,
            section: classDoc.section,
            class: classDoc._id,
          }],
          { session }
        );

        createdUser.studentProfile = studentProfile._id;
        await createdUser.save({ session });

        application.createdStudentUser = createdUser._id;
      });
    } finally {
      session.endSession();
    }

    studentCredentials = { studentId: admissionNumber, password };

    const { subject, html } = welcomeTemplate({
      fullName: application.studentFullName,
      roleLabel: 'Student',
      loginIdentifier: admissionNumber,
      tempPassword: password,
      loginPath: '/student/login',
    });
    sendEmail({ to: application.guardianEmail, toName: application.guardianName, subject, html }).catch(() => {});
  }

  await application.save();

  if (status === 'approved' || status === 'rejected') {
    const templateFn = status === 'approved' ? admissionApprovedTemplate : admissionRejectedTemplate;
    const { subject, html } = templateFn({
      guardianName: application.guardianName,
      studentFullName: application.studentFullName,
      notes: reviewNotes,
    });
    sendEmail({ to: application.guardianEmail, toName: application.guardianName, subject, html }).catch(() => {});
  }

  await recordAudit({
    actor: req.user.id,
    action: 'admission.status_update',
    details: { status },
    targetModel: 'AdmissionApplication',
    targetId: application._id,
  });

  res.status(200).json({ status: 'success', data: application, studentCredentials });
});

exports.deleteApplication = catchAsync(async (req, res, next) => {
  const application = await AdmissionApplication.findByIdAndDelete(req.params.id);
  if (!application) return next(new AppError('Application not found.', 404));
  await recordAudit({ actor: req.user.id, action: 'admission.delete', targetModel: 'AdmissionApplication', targetId: application._id });
  res.status(204).json({ status: 'success', data: null });
});
