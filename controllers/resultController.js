const mongoose = require('mongoose');
const { streamReportCard } = require('../utils/reportCardPdf');
const SiteSettings = require('../models/SiteSettings');
const Result = require('../models/Result');
const Parent = require('../models/Parent');
const Staff = require('../models/Staff');
const Class = require('../models/Class');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');
const ApiFeatures = require('../utils/apiFeatures');
const recordAudit = require('../utils/audit');

function computeGrade(total) {
  if (total >= 80) return 'A';
  if (total >= 70) return 'B';
  if (total >= 60) return 'C';
  if (total >= 50) return 'D';
  if (total >= 40) return 'E';
  return 'F';
}

const GRADE_REMARKS = { A: 'Excellent', B: 'Very Good', C: 'Good', D: 'Fair', E: 'Pass', F: 'Fail' };

function recomputeTotals(doc) {
  doc.scores.forEach((s) => {
    s.total = (s.ca1 || 0) + (s.ca2 || 0) + (s.assignment || 0) + (s.exam || 0);
    s.grade = computeGrade(s.total);
    s.remark = GRADE_REMARKS[s.grade] || '';
  });
  doc.totalScore = doc.scores.reduce((sum, s) => sum + s.total, 0);
  doc.average = doc.scores.length ? +(doc.totalScore / doc.scores.length).toFixed(2) : 0;
}

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

// Students/parents may only ever see status === 'approved' results.
// Staff (other than Super Admin/Principal/Vice Principal) only ever see
// results for classes they are the Class Teacher for.
async function scopeToRequester(req, baseFilter = {}) {
  const { accountType, parentProfile, studentProfile } = req.user;

  if (accountType === 'parent') {
    const parent = await Parent.findById(parentProfile);
    return { ...baseFilter, student: { $in: parent?.children || [] }, status: 'approved' };
  }
  if (accountType === 'primary_student' || accountType === 'secondary_student') {
    return { ...baseFilter, student: studentProfile, status: 'approved' };
  }
  if (accountType === 'staff') {
    const isOverseer = accountType === 'super_admin' || ['principal', 'vice_principal'].includes(req.user.staffRole);
    if (!isOverseer) {
      const staff = await Staff.findOne({ user: req.user.id });
      if (staff) {
        const ownedClasses = await Class.find({ classTeacher: staff._id }).select('_id');
        return { ...baseFilter, class: { $in: ownedClasses.map((c) => c._id) } };
      }
    }
  }
  return baseFilter; // super_admin/principal/vice_principal — full visibility
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

// POST /api/v1/results — the Class Teacher enters and publishes their own
// class's results in one step. There is no separate Subject Teacher
// upload stage or Class Teacher review stage anymore — whoever is the
// Class Teacher for a class (Class.classTeacher) is the only staff member
// who can touch that class's results at all, and saving makes the result
// visible to the student/parent immediately. Super Admin, Principal, and
// Vice Principal keep full override access to any class.
exports.upsertResult = catchAsync(async (req, res, next) => {
  const {
    student, class: classId, session, term, scores, teacherComment,
    attendance, affectiveDomain, psychomotorDomain, nextTermBegins, promotedTo, nextClass,
  } = req.body;
  if (!student || !classId || !session || !term || !Array.isArray(scores)) {
    return next(new AppError('student, class, session, term and scores[] are required.', 400));
  }

  const staff = await Staff.findOne({ user: req.user.id });
  const classDoc = await Class.findById(classId);
  if (!classDoc) return next(new AppError('Class not found.', 404));

  const isOverseer = req.user.accountType === 'super_admin' || ['principal', 'vice_principal'].includes(req.user.staffRole);
  const isClassTeacher = !!(staff && classDoc.classTeacher && classDoc.classTeacher.equals(staff._id));

  if (!isOverseer && !isClassTeacher) {
    return next(new AppError('Only this class\'s Class Teacher can enter results for this class.', 403));
  }

  let result = await Result.findOne({ student, session, term });
  if (!result) {
    result = new Result({ student, class: classId, session, term, scores, teacherComment, enteredBy: staff?._id });
  } else {
    result.scores = scores;
    result.teacherComment = teacherComment ?? result.teacherComment;
  }
  if (attendance) result.attendance = attendance;
  if (affectiveDomain) result.affectiveDomain = affectiveDomain;
  if (psychomotorDomain) result.psychomotorDomain = psychomotorDomain;
  if (nextTermBegins !== undefined) result.nextTermBegins = nextTermBegins || null;
  if (promotedTo !== undefined) result.promotedTo = promotedTo;
  if (nextClass !== undefined) result.nextClass = nextClass;

  // Saved by the Class Teacher (or an overseer, who can edit/override
  // anything) — that's the whole review chain now, so it publishes
  // immediately.
  result.status = 'approved';
  result.approvedBy = req.user.id;
  result.approvedAt = new Date();

  recomputeTotals(result);
  await result.save();
  await recomputeClassPositions(classId, session, term);
  await result.populate('scores.subject', 'name code');

  await recordAudit({ actor: req.user.id, action: 'result.upsert', targetModel: 'Result', targetId: result._id });

  res.status(200).json({ status: 'success', data: result });
});

// PATCH /api/v1/results/:id/submit — teacher marks it ready for approval
exports.submitResult = catchAsync(async (req, res, next) => {
  const result = await Result.findByIdAndUpdate(req.params.id, { status: 'submitted' }, { new: true });
  if (!result) return next(new AppError('Result not found.', 404));
  res.status(200).json({ status: 'success', data: result });
});

// PATCH /api/v1/results/:id/approve — the Class Teacher publishes the
// result once all subject scores have been reviewed. Super Admin,
// Principal, and Vice Principal can also publish/override any result.
exports.approveResult = catchAsync(async (req, res, next) => {
  const { principalComment } = req.body;

  const existing = await Result.findById(req.params.id).populate('class');
  if (!existing) return next(new AppError('Result not found.', 404));

  const staff = await Staff.findOne({ user: req.user.id });
  const isOverseer = req.user.accountType === 'super_admin' || ['principal', 'vice_principal'].includes(req.user.staffRole);
  const isClassTeacher = !!(staff && existing.class?.classTeacher && existing.class.classTeacher.equals(staff._id));
  if (!isOverseer && !isClassTeacher) {
    return next(new AppError('Only this class\'s Class Teacher or an admin can publish this result.', 403));
  }

  existing.status = 'approved';
  existing.approvedBy = req.user.id;
  existing.approvedAt = new Date();
  if (principalComment !== undefined) existing.principalComment = principalComment;
  await existing.save();
  await recomputeClassPositions(existing.class._id, existing.session, existing.term);

  await recordAudit({ actor: req.user.id, action: 'result.approve', targetModel: 'Result', targetId: existing._id });

  res.status(200).json({ status: 'success', data: existing });
});

// PATCH /api/v1/results/:id/reject — same ownership rule as approve.
exports.rejectResult = catchAsync(async (req, res, next) => {
  const { reason } = req.body;

  const existing = await Result.findById(req.params.id).populate('class');
  if (!existing) return next(new AppError('Result not found.', 404));

  const staff = await Staff.findOne({ user: req.user.id });
  const isOverseer = req.user.accountType === 'super_admin' || ['principal', 'vice_principal'].includes(req.user.staffRole);
  const isClassTeacher = !!(staff && existing.class?.classTeacher && existing.class.classTeacher.equals(staff._id));
  if (!isOverseer && !isClassTeacher) {
    return next(new AppError('Only this class\'s Class Teacher or an admin can reject this result.', 403));
  }

  existing.status = 'rejected';
  existing.principalComment = reason;
  await existing.save();
  await recomputeClassPositions(existing.class._id, existing.session, existing.term);

  await recordAudit({ actor: req.user.id, action: 'result.reject', targetModel: 'Result', targetId: existing._id, details: { reason } });

  res.status(200).json({ status: 'success', data: existing });
});
