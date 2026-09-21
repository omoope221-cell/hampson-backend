const mongoose = require('mongoose');

const classSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true }, // e.g. "JSS 1", "Primary 4"
    section: { type: String, enum: ['primary', 'secondary'], required: true },
    arm: { type: String, trim: true, default: null }, // e.g. "A", "B" (stream/arm)
    classTeacher: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff', default: null },
    subjects: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Subject' }],
    // Per-subject teacher assignment for THIS class — the source of truth
    // for who may enter results for a given subject in this class. A
    // teacher can be the subjectTeacher for Maths in JSS2A without being
    // able to touch English, Biology, etc. in the same class, and without
    // being able to touch Maths in a class they're not listed here for.
    // Staff.assignedClasses/assignedSubjects (flat lists) are only used
    // for broad "which students can this staff member see" visibility —
    // this array is the one result-entry permission checks rely on.
    subjectTeachers: [
      {
        _id: false,
        subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
        // Optional on purpose: a subject can be listed for a class with
        // no teacher assigned yet — e.g. a primary class where the
        // Class Teacher covers every subject themselves. See
        // subjectResultController's "class teacher fallback" for how
        // that's authorized.
        teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff', default: null },
      },
    ],
    capacity: { type: Number, default: 40 },
    session: { type: mongoose.Schema.Types.ObjectId, ref: 'Session', required: true },
  },
  { timestamps: true }
);

classSchema.index({ name: 1, arm: 1, session: 1 }, { unique: true });

module.exports = mongoose.model('Class', classSchema);
