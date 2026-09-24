require('dotenv').config();
const fs = require('fs');
const path = require('path');
const connectDB = require('./config/db');
const logger = require('./utils/logger');
const app = require('./app');
const { dropStaleStudentIdIndex } = require('./scripts/fixStaleIndexes');
const { backfillStaffSection } = require('./scripts/backfillStaffSection');
const mongoose = require('mongoose');

// Make sure logs/ and uploads/ exist before winston or multer try to write.
['logs', 'uploads/students', 'uploads/staff', 'uploads/attachments'].forEach((dir) => {
  const full = path.join(__dirname, dir);
  if (!fs.existsSync(full)) fs.mkdirSync(full, { recursive: true });
});

process.on('uncaughtException', (err) => {
  logger.error(`UNCAUGHT EXCEPTION: ${err.message}`);
  process.exit(1);
});

const PORT = process.env.PORT || 5000;

connectDB().then(async () => {
  // Self-heals the leftover unique index on `studentId` (see
  // scripts/fixStaleIndexes.js) so deploying this change is enough —
  // nobody has to remember to run a migration by hand. Never blocks
  // startup: if this fails for any reason (e.g. a DB user without
  // index-management rights), we just log it and carry on.
  try {
    await dropStaleStudentIdIndex(mongoose.connection);
  } catch (err) {
    logger.error(`Could not check/drop stale student index on startup: ${err.message}`);
  }

  // Same idea, for staff records saved before the `section` field
  // existed — see scripts/backfillStaffSection.js.
  try {
    await backfillStaffSection();
  } catch (err) {
    logger.error(`Could not backfill staff section on startup: ${err.message}`);
  }

  const server = app.listen(PORT, () => {
    logger.info(`Hampsons Group of School API running on port ${PORT} [${process.env.NODE_ENV}]`);
  });

  process.on('unhandledRejection', (err) => {
    logger.error(`UNHANDLED REJECTION: ${err.message}`);
    server.close(() => process.exit(1));
  });
});
