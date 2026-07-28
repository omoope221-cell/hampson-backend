const Counter = require('../models/Counter');

async function nextSequence(name) {
  const counter = await Counter.findByIdAndUpdate(
    name,
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return counter.seq;
}

const pad4 = (n) => String(n).padStart(4, '0');

// HMP0001, HMP0002, ... — used for Student IDs.
async function nextStudentId() {
  return `HMP${pad4(await nextSequence('studentId'))}`;
}

// HMP-ADM-0001, ... — used for admission application numbers.
async function nextApplicationNumber() {
  return `HMP-ADM-${pad4(await nextSequence('admissionNumber'))}`;
}

module.exports = { nextSequence, nextStudentId, nextApplicationNumber };