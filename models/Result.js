const mongoose = require('mongoose');

const scoreSchema = new mongoose.Schema(
  {
    subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
    ca1: { type: Number, default: 0 }, // out of 10
    ca2: { type: Number, default: 0 }, // out of 10
    assignment: { type: Number, default: 0 }, // out of 10
    exam: { type: Number, default: 0 }, // out of 70
    total: { type: Number, default: 0 }, // out of 100
    grade: { type: String, default: '' },
    position: { type: Number, default: null }, // this subject's rank within the class for this term
    remark: { type: String, default: '' },
  },
  { _id: false }
);

const RATING_TRAITS = { type: Number, min: 1, max: 5, default: null };

const affectiveDomainSchema = new mongoose.Schema(
  {
    punctuality: RATING_TRAITS,
    neatness: RATING_TRAITS,
    honesty: RATING_TRAITS,
    respect: RATING_TRAITS,
    leadership: RATING_TRAITS,
    cooperation: RATING_TRAITS,
    initiative: RATING_TRAITS,
    responsibility: RATING_TRAITS,
    selfControl: RATING_TRAITS,
  },
  { _id: false }
);

const psychomotorDomainSchema = new mongoose.Schema(
  {
    handwriting: RATING_TRAITS,
    creativity: RATING_TRAITS,
    drawing: RATING_TRAITS,
    sports: RATING_TRAITS,
    musicalSkills: RATING_TRAITS,
    practicalSkills: RATING_TRAITS,
    communication: RATING_TRAITS,
  },
  { _id: false }
);

const resultSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    class: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
    session: { type: mongoose.Schema.Types.ObjectId, ref: 'Session', required: true },
    term: { type: String, enum: ['First Term', 'Second Term', 'Third Term'], required: true },
    scores: [scoreSchema],
    totalScore: { type: Number, default: 0 },
    average: { type: Number, default: 0 },
    positionInClass: { type: Number, default: null },
    classSize: { type: Number, default: null }, // "Position X of Y students" — Y, snapshotted at publish time
    teacherComment: { type: String, trim: true },
    principalComment: { type: String, trim: true },

    // --- Report card extras (Hampsons Group of Schools template) ---
    attendance: {
      daysPresent: { type: Number, default: null },
      totalDays: { type: Number, default: null },
    },
    affectiveDomain: affectiveDomainSchema,
    psychomotorDomain: psychomotorDomainSchema,
    nextTermBegins: { type: Date, default: null },
    promotedTo: { type: String, trim: true, default: '' },
    nextClass: { type: String, trim: true, default: '' },

    // Results stay hidden from parents/students until Super Admin (or
    // delegated approver) approves them.
    status: { type: String, enum: ['draft', 'submitted', 'approved', 'rejected'], default: 'draft' },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    approvedAt: { type: Date, default: null },

    enteredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' },
  },
  { timestamps: true }
);

resultSchema.index({ student: 1, session: 1, term: 1 }, { unique: true });

module.exports = mongoose.model('Result', resultSchema);
