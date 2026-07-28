const mongoose = require('mongoose');

const admissionApplicationSchema = new mongoose.Schema(
  {
    studentFullName: { type: String, required: true, trim: true },
    dateOfBirth: { type: Date, required: true },
    gender: { type: String, enum: ['male', 'female'], required: true },
    gradeApplyingFor: { type: String, required: true, trim: true },
    previousSchool: { type: String, trim: true },

    guardianName: { type: String, required: true, trim: true },
    guardianEmail: { type: String, required: true, trim: true, lowercase: true },
    guardianPhone: { type: String, required: true, trim: true },
    guardianRelationship: { type: String, trim: true },
    address: { type: String, trim: true },
    state: { type: String, trim: true },
    country: { type: String, trim: true },

    notes: { type: String, trim: true },

    // Each uploaded to Cloudinary (resource_type 'auto' — covers PDF or
    // image scans) by the submit endpoint; publicId kept for cleanup.
    documents: {
      type: [
        {
          label: String, // 'Birth Certificate' | 'Previous Report Card' | 'Passport Photograph'
          url: String,
          publicId: String,
        },
      ],
      default: [],
    },

    // --- Generated as soon as the application is submitted (see utils/idGenerator.js) ---
    applicationNumber: { type: String, unique: true, sparse: true }, // HMP-ADM-0001

    // --- Physical payment & entrance exam appointment ---
    // There is no online payment or online exam. These are a snapshot,
    // taken at submission time, of the Admission Settings amount/dates —
    // so a later settings change never shifts the appointment for an
    // applicant who has already been sent their instructions email.
    admissionFeeAmount: { type: Number }, // Naira, payable physically at the school
    schoolVisitDate: { type: Date },
    examDate: { type: Date },
    examStartTime: { type: String },
    examEndTime: { type: String },
    examDurationMinutes: { type: Number },
    instructionsEmailSentAt: { type: Date, default: null },

    // --- Admission outcome ---
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    reviewNotes: { type: String, trim: true },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },

    // Set once the Super Admin approves and a real Student/User account is
    // generated from this application — see admissionController.updateStatus.
    createdStudentUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

admissionApplicationSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('AdmissionApplication', admissionApplicationSchema);