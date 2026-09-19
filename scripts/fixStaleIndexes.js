// Drops indexes that MongoDB still has on the `students` collection but
// that the current Student schema (backend/models/Student.js) no longer
// defines — specifically the old unique index on `studentId`, a field
// that was renamed to `admissionNumber` at some point. Because every new
// student document leaves `studentId` unset, Mongo treats it as `null`,
// and the leftover unique index then rejects every student after the
// first with "Duplicate value for 'studentId': 'null'".
//
// Safe to run more than once — it only drops an index if it's actually
// there, and only ever touches indexes on the exact field `studentId`,
// never `_id` or anything the current schema still uses.
//
// Run once after pulling this change:
//   node scripts/fixStaleIndexes.js
// or:
//   npm run fix-indexes
//
// It also runs automatically (safely, non-fatally) on every server
// start — see server.js — so a fresh deploy fixes itself without this
// needing to be run by hand at all.

require('dotenv').config();
const mongoose = require('mongoose');
const logger = require('../utils/logger');

async function dropStaleStudentIdIndex(connection) {
  const collection = connection.collection('students');
  let indexes;
  try {
    indexes = await collection.indexes();
  } catch (err) {
    // Collection doesn't exist yet on a brand-new database — nothing to fix.
    if (err.codeName === 'NamespaceNotFound') return { dropped: [] };
    throw err;
  }

  const stale = indexes.filter((idx) => Object.keys(idx.key).length === 1 && 'studentId' in idx.key);

  const dropped = [];
  for (const idx of stale) {
    await collection.dropIndex(idx.name);
    dropped.push(idx.name);
  }
  return { dropped };
}

async function main() {
  const isDirectRun = require.main === module;
  if (isDirectRun) {
    mongoose.set('strictQuery', true);
    await mongoose.connect(process.env.MONGO_URI);
  }

  const { dropped } = await dropStaleStudentIdIndex(mongoose.connection);

  if (dropped.length) {
    logger.info(`Dropped stale student index(es): ${dropped.join(', ')}`);
  } else {
    logger.info('No stale studentId index found on students collection — nothing to do.');
  }

  if (isDirectRun) await mongoose.disconnect();
  return dropped;
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((err) => {
      logger.error(`fixStaleIndexes failed: ${err.message}`);
      process.exit(1);
    });
}

module.exports = { dropStaleStudentIdIndex, main };
