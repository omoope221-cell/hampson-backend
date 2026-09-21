const mongoose = require('mongoose');
const { streamReportCard } = require('../utils/reportCardPdf');
const SiteSettings = require('../models/SiteSettings');
const Result = require('../models/Result');
const SubjectResult = require('../models/SubjectResult');
const Parent = require('../models/Parent');
const Staff = require('../models/Staff');
const Class = require('../models/Class');
const Student = require('../models/Student');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');
const ApiFeatures = require('../utils/apiFeatures');
const recordAudit = require('../utils/audit');
const { syncResultFromSubjectEntries } = require('../utils/resultAggregate');

// Overseers can review/correct/approve/publish ANY class's results.
// Everyone else (including a Class Teacher) is scoped to the class(es)
// they are the Class Teacher for.
const OVERSEER_STAFF_ROLES = ['principal', 'vice_principal', 'head_teacher'];
const isOverseerReq = (req) => req.user.accountType === 'super_admin' || OVERSEER_STAFF_ROLES.includes(req.user.staffRole);

// Ranks every published (approved) result in a class for a given
// session/term by totalScore, highest first, and writes positionInClass
// (1, 2, 3, ...) onto each. Ties share the same rank (standard
// competition ranking) rather than being arbitrarily ordered.
function competitionRank(items, scoreOf) {
  // Standard competition ranking: ties share a rank, next rank skips
  // ahead by the tie-count (1, 2, 2, 4, ...). `items` must already be
  // sorted by scoreOf(item) descending.
  let rank = 0;
  let lastScore = null;
  let seen = 0;
  return items.map((item) => {
    seen += 1;
    if (scoreOf(item) !== lastScore) {
      rank = seen;
      lastScore = scoreOf(item);
    }
    return rank;
  });
}

async function recomputeClassPositions(classId, session, term) {
  const results = await Result.find({ class: classId, session, term, status: 'approved' });
  if (!results.length) return;

  // Overall position — ranks the whole result (totalScore across every
  // subject) against the rest of the class.
  const byTotal = [...results].sort((a, b) => b.totalScore - a.totalScore);
  const overallRanks = competitionRank(byTotal, (r) => r.totalScore);
  const overallOps = byTotal.map((r, i) => ({
    updateOne: { filter: { _id: r._id }, update: { positionInClass: overallRanks[i], classSize: results.length } },
  }));

  // Per-subject position — ranks every student's score in ONE subject
  // against classmates who also took that subject.
  const bySubject = new Map(); // subjectId -> [{ resultId, total }]
  results.forEach((r) => {
    r.scores.forEach((s) => {
      const key = String(s.subject);
      if (!bySubject.has(key)) bySubject.set(key, []);
      bySubject.get(key).push({ resultId: r._id, total: s.total });
    });
  });

  const subjectOps = [];
  for (const [subjectId, entries] of bySubject) {
    entries.sort((a, b) => b.total - a.total);
    const ranks = competitionRank(entries, (e) => e.total);
    entries.forEach((e, i) => {
      subjectOps.push({
        updateOne: {
          filter: { _id: e.resultId },
          update: { $set: { 'scores.$[elem].position': ranks[i] } },
          arrayFilters: [{ 'elem.subject': new mongoose.Types.ObjectId(subjectId) }],
        },
      });
    });
  }

  await Result.bulkWrite([...overallOps, ...subjectOps]);
}

// Students/parents may only ever see status === 'approved' results (that
// status IS "published" — see the approve/publish notes below). Staff
// who aren't an overseer only ever see results for classes they are the
// Class Teacher for — NOT every class they happen to teach a subject
// in, since a Subject Teacher's own scoping is handled separately by
// subjectResultController against Class.subjectTeachers.
async function scopeToRequester(req, baseFilter = {}) {
  const { accountType, parentProfile, studentProfile } = req.user;

  if (accountType === 'parent') {
    const parent = await Parent.findById(parentProfile);
    return { ...baseFilter, student: { $in: parent?.children || [] }, status: 'approved' };
  }
  if (accountType === 'primary_student' || accountType === 'secondary_student') {
    return { ...baseFilter, student: studentProfile, status: 'approved' };
  }
  if (accountType === 'staff' && !isOverseerReq(req)) {
    const staff = await Staff.findOne({ user: req.user.id });
    if (staff) {
      const ownedClasses = await Class.find({ classTeacher: staff._id }).select('_id');
      return { ...baseFilter, class: { $in: ownedClasses.map((c) => c._id) } };
    }
  }
  return baseFilter; // super_admin/principal/vice_principal/head_teacher — full visibility
}

exports.getResults = catchAsync(async (req, res) => {
  const scoped = await scopeToRequester(req);
  const features = new ApiFeatures(Result.find(), req.query).filter().sort().limitFields().paginate();
  // Applied AFTER the user's own query filter, so it always wins — a
  // parent passing ?student=<not-their-child> can't override this.
  features.query = features.query
    .find(scoped)
    .populate('student', 'firstName lastName admissionNumber')
    .populate('class', 'name')
    .populate('scores.subject', 'name code');

  const finalFilter = features.query.getFilter();
  const [docs, total] = await Promise.all([features.query, Result.countDocuments(finalFilter)]);

  res.status(200).json({
    status: 'success',
    results: docs.length,
    pagination: { ...features.pagination, total, pages: Math.ceil(total / features.pagination.limit) },
    data: docs,
  });
});

exports.getResult = catchAsync(async (req, res, next) => {
  const scoped = await scopeToRequester(req, { _id: req.params.id });
  const result = await Result.findOne(scoped)
    .populate('student', 'firstName lastName admissionNumber')
    .populate('class', 'name')
    .populate('scores.subject', 'name code');
  if (!result) return next(new AppError('Result not found or not yet approved.', 404));
  res.status(200).json({ status: 'success', data: result });
});

// GET /api/v1/results/:id/report-card — streams a PDF using the official
// Hampsons Group of Schools report card template. Same access rule as
// viewing the result itself (student sees only their own, parent only
// their children's, staff only their own class's, admin sees all).
exports.getReportCardPdf = catchAsync(async (req, res, next) => {
  const scoped = await scopeToRequester(req, { _id: req.params.id });
  const result = await Result.findOne(scoped)
    .populate('student', 'firstName lastName admissionNumber gender dateOfBirth')
    .populate({ path: 'class', select: 'name arm classTeacher', populate: { path: 'classTeacher', select: 'firstName lastName' } })
    .populate('session', 'name')
    .populate('scores.subject', 'name code');
  if (!result) return next(new AppError('Result not found or not yet approved.', 404));

  const settings = await SiteSettings.getSingleton();
  await streamReportCard(res, { result, schoolName: settings.schoolName, schoolLogo: settings.logo, schoolMotto: settings.motto });
});

// Only this class's Class Teacher (Class.classTeacher), or an overseer,
// may touch the aggregate Result document for one of its students —
// enforced here, not just by hiding the button in the UI.
async function assertClassTeacherOrOverseer(req, classDoc) {
  if (isOverseerReq(req)) return { staff: await Staff.findOne({ user: req.user.id }), isOverseer: true };
  const staff = await Staff.findOne({ user: req.user.id });
  const isClassTeacher = !!(staff && classDoc.classTeacher && classDoc.classTeacher.equals(staff._id));
  if (!isClassTeacher) {
    throw new AppError("Only this class's Class Teacher or an admin can do this.", 403);
  }
  return { staff, isOverseer: false };
}

// POST /api/v1/results — the Class Teacher's "Save Comment" step. This
// NEVER touches scores — scores live in SubjectResult and only ever
// reach Result.scores via syncResultFromSubjectEntries (see
// utils/resultAggregate.js), so a Class Teacher saving their comment can
// never overwrite a Subject Teacher's numbers, by construction rather
// than by convention.
exports.upsertResult = catchAsync(async (req, res, next) => {
  const {
    student, class: classId, session, term, teacherComment,
    attendance, affectiveDomain, psychomotorDomain, nextTermBegins, promotedTo, nextClass,
  } = req.body;
  if (!student || !classId || !session || !term) {
    return next(new AppError('student, class, session and term are required.', 400));
  }

  const classDoc = await Class.findById(classId);
  if (!classDoc) return next(new AppError('Class not found.', 404));
  const { staff } = await assertClassTeacherOrOverseer(req, classDoc);

  let result = await syncResultFromSubjectEntries({ student, class: classId, session, term });
  if (teacherComment !== undefined) result.teacherComment = teacherComment;
  if (attendance) result.attendance = attendance;
  if (affectiveDomain) result.affectiveDomain = affectiveDomain;
  if (psychomotorDomain) result.psychomotorDomain = psychomotorDomain;
  if (nextTermBegins !== undefined) result.nextTermBegins = nextTermBegins || null;
  if (promotedTo !== undefined) result.promotedTo = promotedTo;
  if (nextClass !== undefined) result.nextClass = nextClass;
  if (!result.enteredBy) result.enteredBy = staff?._id;

  await result.save();
  await result.populate('scores.subject', 'name code');

  await recordAudit({ actor: req.user.id, action: 'result.save_comment', targetModel: 'Result', targetId: result._id });

  res.status(200).json({ status: 'success', data: result });
});

// GET /api/v1/results/review?class=&session=&term= — the completion
// matrix for spec items 7 & 9: per student, which subjects are
// submitted/in progress/missing, whether the Class Teacher's comment has
// been added, and the overall Result status. Used by both the Class
// Teacher's review screen (scoped to their own class) and the Admin
// review screen (any class).
exports.getClassReviewMatrix = catchAsync(async (req, res, next) => {
  const { class: classId, session, term } = req.query;
  if (!classId || !session || !term) {
    return next(new AppError('class, session and term are required.', 400));
  }

  const classDoc = await Class.findById(classId)
    .populate('subjectTeachers.subject', 'name code')
    .populate('subjectTeachers.teacher', 'firstName lastName')
    .populate('classTeacher', 'firstName lastName');
  if (!classDoc) return next(new AppError('Class not found.', 404));
  if (!isOverseerReq(req)) {
    const staff = await Staff.findOne({ user: req.user.id });
    const isClassTeacher = !!(staff && classDoc.classTeacher && classDoc.classTeacher._id.equals(staff._id));
    if (!isClassTeacher) return next(new AppError("Only this class's Class Teacher or an admin can view this.", 403));
  }

  const subjectAssignments = classDoc.subjectTeachers || [];
  const [students, entries, results] = await Promise.all([
    Student.find({ class: classId, status: 'active' }).select('firstName lastName admissionNumber').sort('firstName'),
    SubjectResult.find({ class: classId, session, term }),
    Result.find({ class: classId, session, term }),
  ]);

  const entriesByStudent = new Map();
  entries.forEach((e) => {
    const key = String(e.student);
    if (!entriesByStudent.has(key)) entriesByStudent.set(key, new Map());
    entriesByStudent.get(key).set(String(e.subject), e);
  });
  const resultByStudent = new Map(results.map((r) => [String(r.student), r]));

  const data = students.map((s) => {
    const subjectStatuses = subjectAssignments.map((sa) => {
      const entry = entriesByStudent.get(String(s._id))?.get(String(sa.subject._id || sa.subject));
      return {
        subject: sa.subject,
        // No subject teacher assigned → the Class Teacher covers this
        // subject (see subjectResultController's class-teacher fallback).
        teacher: sa.teacher || classDoc.classTeacher || null,
        viaClassTeacher: !sa.teacher,
        status: entry ? entry.status : 'not_started',
        total: entry?.total ?? null,
      };
    });
    const result = resultByStudent.get(String(s._id));
    const completed = subjectStatuses.filter((x) => x.status === 'submitted').length;
    return {
      student: s,
      subjectsCompleted: completed,
      subjectsTotal: subjectStatuses.length,
      subjects: subjectStatuses,
      hasComment: !!result?.teacherComment,
      resultStatus: result?.status || 'draft',
      resultId: result?._id || null,
    };
  });

  res.status(200).json({ status: 'success', results: data.length, data });
});

// PATCH /api/v1/results/:id/submit — Class Teacher submits the reviewed
// result for Admin review ("Under Review" in spec item 7). Same
// ownership rule as upsertResult.
exports.submitResult = catchAsync(async (req, res, next) => {
  const existing = await Result.findById(req.params.id).populate('class');
  if (!existing) return next(new AppError('Result not found.', 404));
  await assertClassTeacherOrOverseer(req, existing.class);

  existing.status = 'submitted';
  await existing.save();

  await recordAudit({ actor: req.user.id, action: 'result.submit', targetModel: 'Result', targetId: existing._id });

  res.status(200).json({ status: 'success', data: existing });
});

// PATCH /api/v1/results/:id/approve — Admin (Super Admin/Principal/Vice
// Principal/Head Teacher) reviews and approves. This IS the "publish"
// step in the current schema (status 'approved' == visible to
// students/parents — see scopeToRequester) — a Class Teacher can no
// longer approve/publish their own class's result, only submit it for
// review, matching the brief's workflow.
exports.approveResult = catchAsync(async (req, res, next) => {
  const { principalComment } = req.body;
  if (!isOverseerReq(req)) return next(new AppError('Only an admin can approve/publish a result.', 403));

  const existing = await Result.findById(req.params.id).populate('class');
  if (!existing) return next(new AppError('Result not found.', 404));

  existing.status = 'approved';
  existing.approvedBy = req.user.id;
  existing.approvedAt = new Date();
  if (principalComment !== undefined) existing.principalComment = principalComment;
  await existing.save();
  await recomputeClassPositions(existing.class._id, existing.session, existing.term);

  await recordAudit({ actor: req.user.id, action: 'result.approve', targetModel: 'Result', targetId: existing._id });

  res.status(200).json({ status: 'success', data: existing });
});

// PATCH /api/v1/results/:id/reject — Admin sends it back to the Class
// Teacher (status 'rejected') with a reason.
exports.rejectResult = catchAsync(async (req, res, next) => {
  const { reason } = req.body;
  if (!isOverseerReq(req)) return next(new AppError('Only an admin can reject a result.', 403));

  const existing = await Result.findById(req.params.id).populate('class');
  if (!existing) return next(new AppError('Result not found.', 404));

  existing.status = 'rejected';
  existing.principalComment = reason;
  await existing.save();

  await recordAudit({ actor: req.user.id, action: 'result.reject', targetModel: 'Result', targetId: existing._id, details: { reason } });

  res.status(200).json({ status: 'success', data: existing });
});

// PATCH /api/v1/results/:id/unpublish — Admin reopens an approved
// (published) result, e.g. to correct a mistake after the fact (spec
// item 3: "Unpublish/reopen results when necessary"). Drops it back to
// 'submitted' so it disappears from the student/parent portal again
// until re-approved, without touching any of the scores/comments.
exports.unpublishResult = catchAsync(async (req, res, next) => {
  if (!isOverseerReq(req)) return next(new AppError('Only an admin can unpublish a result.', 403));

  const existing = await Result.findById(req.params.id).populate('class');
  if (!existing) return next(new AppError('Result not found.', 404));
  if (existing.status !== 'approved') return next(new AppError('Only a published (approved) result can be unpublished.', 400));

  existing.status = 'submitted';
  existing.approvedBy = null;
  existing.approvedAt = null;
  await existing.save();

  await recordAudit({ actor: req.user.id, action: 'result.unpublish', targetModel: 'Result', targetId: existing._id });

  res.status(200).json({ status: 'success', data: existing });
});
