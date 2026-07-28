const mongoose = require('mongoose');

// One document per named sequence (e.g. "studentId", "admissionNumber").
// findOneAndUpdate with $inc + upsert is atomic in MongoDB, so concurrent
// requests can never hand out the same number twice.
const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

module.exports = mongoose.model('Counter', counterSchema);