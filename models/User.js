const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { ACCOUNT_TYPES, STAFF_ROLES, DEFAULT_STAFF_PERMISSIONS } = require('../config/roles');

const userSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    username: { type: String, unique: true, sparse: true, trim: true },
    phone: { type: String, trim: true },
    passwordHash: { type: String, required: true, select: false },

    // Top-level account type — this is what the login screen's role
    // selector maps to.
    accountType: { type: String, enum: ACCOUNT_TYPES, required: true },

    // Only meaningful when accountType === 'staff'
    staffRole: { type: String, enum: STAFF_ROLES, default: null },

    // Effective permission overrides. If null, defaults from
    // DEFAULT_STAFF_PERMISSIONS[staffRole] are used. Super Admin can set
    // this explicitly per staff member to fine-tune module access.
    permissions: { type: [String], default: null },

    // Links to the role-specific profile document
    studentProfile: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
    staffProfile: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' },
    parentProfile: { type: mongoose.Schema.Types.ObjectId, ref: 'Parent' },

    profilePicture: { type: String, default: null },

    status: {
      type: String,
      enum: ['active', 'suspended', 'inactive'],
      default: 'active',
    },

    lastLoginAt: { type: Date },
    tokenVersion: { type: Number, default: 0 }, // bump to invalidate all refresh tokens
    mustChangePassword: { type: Boolean, default: false },

  
    // Forgot-password OTP flow (see controllers/passwordController.js).
    // The OTP itself is never stored in plain text.
    otpCodeHash: { type: String, select: false },
    otpExpires: { type: Date, select: false },
    otpVerified: { type: Boolean, default: false, select: false },
    otpLastSentAt: { type: Date, select: false },
    otpAttempts: { type: Number, default: 0, select: false },
  },
  { timestamps: true }
);

userSchema.index({ accountType: 1 });
userSchema.index({ staffRole: 1 });

userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('passwordHash')) return next();
  this.passwordHash = await bcrypt.hash(this.passwordHash, 12);
  next();
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.passwordHash);
};

// Resolve the effective permission list for this user.
userSchema.methods.getPermissions = function getPermissions() {
  if (this.accountType === 'super_admin') {
    return DEFAULT_STAFF_PERMISSIONS.super_admin;
  }
  if (this.accountType !== 'staff') return [];
  if (Array.isArray(this.permissions) && this.permissions.length) {
    return this.permissions;
  }
  return DEFAULT_STAFF_PERMISSIONS[this.staffRole] || [];
};

userSchema.methods.toSafeJSON = function toSafeJSON() {
  const obj = this.toObject();
  delete obj.passwordHash;
  delete obj.passwordResetToken;
  delete obj.passwordResetExpires;
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
