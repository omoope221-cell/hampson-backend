const mongoose = require('mongoose');

// One document per student + subject + session + term — this is what a
// Subject Teacher owns and edits. It is intentionally separate from the
// aggregate `Result` document (one per student + session + term, holding
// every subject plus the Class Teacher's comment) so that two different
// subject teachers editing the same student's record at the same time
// can never clobber each other, and so a subject teacher's write can be
// authorized/rejected purely by checking THIS document's `subject` +
// `class` against their assignment — no need to touch or even read any
// other teacher's scores.
const subjectResultSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
    subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
    session: { type: mongoose.Schema.Types.ObjectId, ref: 'Session', required: true },
    term: { type: String, enum: ['First Term', 'Second Term', 'Third Term'], required: true },

    // The Staff document of the subject teacher who owns this entry.
    // Set once on creation from the Class.subjectTeachers assignment and
    // used for ownership checks on every subsequent write.
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff', required: true },

    ca1: { type: Number, default: 0, min: 0, max: 10 },
    ca2: { type: Number, default: 0, min: 0, max: 10 },
    assignment: { type: Number, default: 0, min: 0, max: 10 },
    exam: { type: Number, default: 0, min: 0, max: 70 },
    total: { type: Number, default: 0 },
    grade: { type: String, default: '' },
    remark: { type: String, default: '' },

    // not_started never actually gets stored (the document doesn't exist
    // yet) — it's a UI-only state computed client/server-side when no
    // SubjectResult exists for a student+subject. in_progress = saved but
    // not yet submitted; submitted = locked from further edits by the
    // subject teacher (Admin can still correct it).
    status: { type: String, enum: ['in_progress', 'submitted'], default: 'in_progress' },
    submittedAt: { type: Date, default: null },

    // Optional because an overseer without a Staff profile (a pure Super
    // Admin account) can also create/correct an entry.
    enteredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff', default: null },
    lastUpdatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' },
  },
  { timestamps: true }
);

// Prevents duplicate result entries for the same student + subject +
// session + term (spec 13) and is also what upsertSubjectResult uses to
// find-or-create.
subjectResultSchema.index({ student: 1, subject: 1, session: 1, term: 1 }, { unique: true });
// Fast lookup of "every entry for this class+subject+session+term" —
// used to render a subject teacher's class sheet and to check completion.
subjectResultSchema.index({ class: 1, subject: 1, session: 1, term: 1 });

module.exports = mongoose.model('SubjectResult', subjectResultSchema);
