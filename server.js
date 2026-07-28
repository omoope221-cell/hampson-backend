require('dotenv').config();
const fs = require('fs');
const path = require('path');
const connectDB = require('./config/db');
const logger = require('./utils/logger');
const app = require('./app');

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

connectDB().then(() => {
  const server = app.listen(PORT, () => {
    logger.info(`Hampsons Group of School API running on port ${PORT} [${process.env.NODE_ENV}]`);
  });

  process.on('unhandledRejection', (err) => {
    logger.error(`UNHANDLED REJECTION: ${err.message}`);
    server.close(() => process.exit(1));
  });
});
