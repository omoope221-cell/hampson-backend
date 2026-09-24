// Sets `section: 'both'` on any Staff document that predates the
// `section` field (added for splitting Classes & Subjects, the Admin
// Overview stat cards, and the Staff list by Primary/Secondary/Both).
// Without this, a document with no `section` at all won't match a
// `{ section: 'both' }` filter in Mongo — so those staff would silently
// disappear from every tab on the Staff page instead of showing up
// under "Both Sections" as intended.
//
// Safe to run more than once — only ever touches documents where
// `section` doesn't exist yet.
//
// Run once after pulling this change:
//   node scripts/backfillStaffSection.js
// or:
//   npm run backfill-staff-section
//
// It also runs automatically (safely, non-fatally) on every server
// start — see server.js — so a fresh deploy fixes itself without this
// needing to be run by hand at all.

require('dotenv').config();
const mongoose = require('mongoose');
const logger = require('../utils/logger');
const Staff = require('../models/Staff');

async function backfillStaffSection() {
  const result = await Staff.updateMany({ section: { $exists: false } }, { $set: { section: 'both' } });
  const modified = result.modifiedCount ?? result.nModified ?? 0;
  return { modified };
}

async function main() {
  const isDirectRun = require.main === module;
  if (isDirectRun) {
    mongoose.set('strictQuery', true);
    await mongoose.connect(process.env.MONGO_URI);
  }

  const { modified } = await backfillStaffSection();

  if (modified) {
    logger.info(`Backfilled section: 'both' on ${modified} staff record(s).`);
  } else {
    logger.info('No staff records missing a section value — nothing to do.');
  }

  if (isDirectRun) await mongoose.disconnect();
  return modified;
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((err) => {
      logger.error(`backfillStaffSection failed: ${err.message}`);
      process.exit(1);
    });
}

module.exports = { backfillStaffSection, main };
