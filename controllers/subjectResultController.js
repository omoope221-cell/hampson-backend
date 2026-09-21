const SubjectResult = require('../models/SubjectResult');
const Class = require('../models/Class');
const Student = require('../models/Student');
const Staff = require('../models/Staff');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');
const recordAudit = require('../utils/audit');
const { scoreSubjectEntry, syncResultFromSubjectEntries } = require('../utils/resultAggregate');

const OVERSEER_ROLES = ['principal', 'vice_principal', 'head_teacher'];
const isOverseerReq = (req) => req.user.accountType === 'super_admin' || OVERSEER_ROLES.includes(req.user.staffRole);

// Confirms the logged-in user may touch this class+subject's scores, and
// tells the caller WHO the entry should be attributed to. Three ways in:
//   1. Overseer (Super Admin/Principal/Vice Principal/Head Teacher) —
//      can correct anything.
//   2. The specific subject teacher Class.subjectTeachers names for this
//      subject in this class.
//   3. The class's Class Teacher, but ONLY when this subject has no
//      subject teacher assigned at all — the fallback for classes (often
//      primary/lower classes) where one teacher covers every subject.
//      The moment Admin assigns a real subject teacher, this fallback
//      stops applying for that subject.
// This is the backend enforcement spec item 6 asks for — it runs
// regardless of what the frontend shows or hides.
async function assertSubjectAssignment(req, classId, subjectId) {
  const classDoc = await Class.findById(classId);
  if (!classDoc) throw new AppError('Class not found.', 404);

  const staff = await Staff.findOne({ user: req.user.id });
  const assignment = (classDoc.subjectTeachers || []).find(
    (st) => String(st.subject) === String(subjectId)
  );
  if (!assignment) {
    throw new AppError('This subject has not been added to this class yet — add it from Classes & Subjects first.', 400);
  }
  const assignedStaffId = assignment.teacher || null;

  if (isOverseerReq(req)) {
    return { staff, isOverseer: true, classDoc, effectiveTeacherId: assignedStaffId };
  }

  if (!staff) throw new AppError('No staff profile linked to this account.', 403);

  // Path 2: the named subject teacher.
  if (assignedStaffId && String(assignedStaffId) === String(staff._id)) {
    return { staff, isOverseer: false, classDoc, effectiveTeacherId: assignedStaffId };
  }

  // Path 3: nobody specific is assigned to this subject — the Class
  // Teacher can cover it.
  const isClassTeacher = !!(classDoc.classTeacher && String(classDoc.classTeacher) === String(staff._id));
  if (!assignedStaffId && isClassTeacher) {
    return { staff, isOverseer: false, classDoc, effectiveTeacherId: staff._id, viaClassTeacherFallback: true };
  }

  throw new AppError('You are not assigned to teach this subject in this class.', 403);
}

// GET /api/v1/results/subject-entries/assignments — "My Classes" + "My
// Subjects" for the teacher dashboard: every (class, subject) pair this
// staff member is the assigned subject teacher for, in the current (or
// requested) session.
exports.getMyAssignments = catchAsync(async (req, res, next) => {
  const staff = await Staff.findOne({ user: req.user.id });
  if (!staff) return next(new AppError('No staff profile linked to this account.', 403));

  const filter = {};
  if (req.query.session) filter.session = req.query.session;

  const classes = await Class.find(filter)
    .populate('subjectTeachers.subject', 'name code')
    .select('name arm section session subjectTeachers classTeacher');

  const assignments = [];
  classes.forEach((c) => {
    const isClassTeacher = !!(c.classTeacher && String(c.classTeacher) === String(staff._id));
    (c.subjectTeachers || []).forEach((st) => {
      const assignedToMe = st.teacher && String(st.teacher) === String(staff._id);
      const unassignedFallback = !st.teacher && isClassTeacher;
      if (assignedToMe || unassignedFallback) {
        assignments.push({
          class: { _id: c._id, name: c.name, arm: c.arm, section: c.section },
          subject: st.subject,
          session: c.session,
          // True when this shows up because no subject teacher is
          // assigned and the requester is the Class Teacher covering it.
          viaClassTeacher: unassignedFallback,
        });
      }
    });
  });

  res.status(200).json({ status: 'success', results: assignments.length, data: assignments });
});

// GET /api/v1/results/subject-entries?class=&subject=&session=&term=
// Returns every active student in the class alongside their existing
// score for this subject/session/term (or nulls if not yet started), so
// the teacher can see at a glance who's done and who isn't.
exports.getSubjectClassSheet = catchAsync(async (req, res, next) => {
  const { class: classId, subject: subjectId, session, term } = req.query;
  if (!classId || !subjectId || !session || !term) {
    return next(new AppError('class, subject, session and term are all required.', 400));
  }

  await assertSubjectAssignment(req, classId, subjectId);

  const [students, entries] = await Promise.all([
    Student.find({ class: classId, status: 'active' }).select('firstName lastName admissionNumber').sort('firstName'),
    SubjectResult.find({ class: classId, subject: subjectId, session, term }),
  ]);

  const byStudent = new Map(entries.map((e) => [String(e.student), e]));
  const rows = students.map((s) => {
    const entry = byStudent.get(String(s._id));
    return {
      student: s,
      entry: entry
        ? {
            _id: entry._id, ca1: entry.ca1, ca2: entry.ca2, assignment: entry.assignment, exam: entry.exam,
            total: entry.total, grade: entry.grade, status: entry.status, submittedAt: entry.submittedAt,
            updatedAt: entry.updatedAt,
          }
        : null,
      status: entry ? entry.status : 'not_started',
    };
  });

  res.status(200).json({ status: 'success', results: rows.length, data: rows });
});

// POST /api/v1/results/subject-entries — create/update ONE student's
// score for this subject. Only the assigned subject teacher (or an
// overseer) can call this, and only for their own assignment — enforced
// server-side, not just hidden in the UI.
exports.upsertSubjectResult = catchAsync(async (req, res, next) => {
  const { student, class: classId, subject, session, term, ca1, ca2, assignment, exam } = req.body;
  if (!student || !classId || !subject || !session || !term) {
    return next(new AppError('student, class, subject, session and term are required.', 400));
  }

  const { staff, effectiveTeacherId } = await assertSubjectAssignment(req, classId, subject);
  if (!effectiveTeacherId) {
    return next(new AppError('No subject teacher is assigned to this subject, and this class has no Class Teacher either — assign one of the two from Classes & Subjects first.', 400));
  }

  const studentDoc = await Student.findOne({ _id: student, class: classId });
  if (!studentDoc) return next(new AppError('This student is not in the specified class.', 400));

  for (const [field, value, max] of [['ca1', ca1, 10], ['ca2', ca2, 10], ['assignment', assignment, 10], ['exam', exam, 70]]) {
    if (value === undefined || value === null) continue;
    const n = Number(value);
    if (Number.isNaN(n) || n < 0 || n > max) {
      return next(new AppError(`${field} must be a number between 0 and ${max}.`, 400));
    }
  }

  let entry = await SubjectResult.findOne({ student, subject, session, term });
  if (entry && entry.status === 'submitted' && !isOverseerReq(req)) {
    return next(new AppError('This subject result has already been submitted. Ask an admin to reopen it before editing.', 403));
  }

  if (!entry) {
    entry = new SubjectResult({ student, class: classId, subject, session, term, enteredBy: staff?._id, teacher: effectiveTeacherId });
  }
  if (ca1 !== undefined) entry.ca1 = Number(ca1);
  if (ca2 !== undefined) entry.ca2 = Number(ca2);
  if (assignment !== undefined) entry.assignment = Number(assignment);
  if (exam !== undefined) entry.exam = Number(exam);
  entry.lastUpdatedBy = staff?._id;
  scoreSubjectEntry(entry);

  await entry.save();
  await syncResultFromSubjectEntries({ student, class: classId, session, term });

  await recordAudit({ actor: req.user.id, action: 'subject_result.upsert', targetModel: 'SubjectResult', targetId: entry._id });

  res.status(200).json({ status: 'success', data: entry });
});

// PATCH /api/v1/results/subject-entries/submit — finalizes every score
// this teacher has entered for class+subject+session+term. Refuses if
// any active student in the class is still missing a score, so a
// teacher can't "submit" an incomplete set by mistake (spec item 1:
// "Submit/finalize their subject scores when complete").
exports.submitSubjectResults = catchAsync(async (req, res, next) => {
  const { class: classId, subject, session, term } = req.body;
  if (!classId || !subject || !session || !term) {
    return next(new AppError('class, subject, session and term are required.', 400));
  }

  await assertSubjectAssignment(req, classId, subject);

  const [studentCount, entries] = await Promise.all([
    Student.countDocuments({ class: classId, status: 'active' }),
    SubjectResult.find({ class: classId, subject, session, term }),
  ]);

  if (entries.length < studentCount) {
    return next(new AppError(`${studentCount - entries.length} student(s) in this class still have no score for this subject.`, 400));
  }

  await SubjectResult.updateMany(
    { class: classId, subject, session, term },
    { $set: { status: 'submitted', submittedAt: new Date() } }
  );

  await recordAudit({ actor: req.user.id, action: 'subject_result.submit', targetModel: 'SubjectResult', details: { class: classId, subject, session, term } });

  res.status(200).json({ status: 'success', message: `${entries.length} score(s) submitted.` });
});
