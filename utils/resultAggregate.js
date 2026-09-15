const Result = require('../models/Result');
const SubjectResult = require('../models/SubjectResult');

function computeGrade(total) {
  if (total >= 80) return 'A';
  if (total >= 70) return 'B';
  if (total >= 60) return 'C';
  if (total >= 50) return 'D';
  if (total >= 40) return 'E';
  return 'F';
}

const GRADE_REMARKS = { A: 'Excellent', B: 'Very Good', C: 'Good', D: 'Fair', E: 'Pass', F: 'Fail' };

// Computes total/grade/remark for one SubjectResult (or a plain object
// shaped like one) from its raw score fields. Mutates and returns it.
function scoreSubjectEntry(entry) {
  entry.total = (entry.ca1 || 0) + (entry.ca2 || 0) + (entry.assignment || 0) + (entry.exam || 0);
  entry.grade = computeGrade(entry.total);
  entry.remark = GRADE_REMARKS[entry.grade] || '';
  return entry;
}

// Rebuilds the aggregate Result document's `scores[]` (and totals) for
// one student+session+term from whatever SubjectResult documents exist
// right now. This is the ONLY place Result.scores gets written from —
// it is a read-through cache of SubjectResult, never edited directly by
// a Class Teacher, so a Subject Teacher's numbers can never be
// overwritten by anyone saving the Class Teacher's comment.
// Creates the Result document (status 'draft') if this is the first
// subject entry for the student in this session/term.
async function syncResultFromSubjectEntries({ student, class: classId, session, term }) {
  const entries = await SubjectResult.find({ student, session, term }).sort({ createdAt: 1 });

  let result = await Result.findOne({ student, session, term });
  if (!result) {
    result = new Result({ student, class: classId, session, term, status: 'draft' });
  }

  result.scores = entries.map((e) => ({
    subject: e.subject,
    ca1: e.ca1,
    ca2: e.ca2,
    assignment: e.assignment,
    exam: e.exam,
    total: e.total,
    grade: e.grade,
    remark: e.remark,
    position: result.scores?.find((s) => String(s.subject) === String(e.subject))?.position ?? null,
  }));
  result.totalScore = result.scores.reduce((sum, s) => sum + s.total, 0);
  result.average = result.scores.length ? +(result.totalScore / result.scores.length).toFixed(2) : 0;

  await result.save();
  return result;
}

module.exports = { computeGrade, GRADE_REMARKS, scoreSubjectEntry, syncResultFromSubjectEntries };
