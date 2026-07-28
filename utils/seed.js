require('dotenv').config();
const connectDB = require('../config/db');
const User = require('../models/User');
const Session = require('../models/Session');
const logger = require('./logger');

async function seed() {
  await connectDB();

  const email = process.env.SUPER_ADMIN_EMAIL;
  const password = process.env.SUPER_ADMIN_PASSWORD;

  if (!email || !password) {
    logger.error('SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD must be set in .env before seeding.');
    process.exit(1);
  }

  const existing = await User.findOne({ email });
  if (existing) {
    logger.info(`Super Admin already exists: ${email}`);
  } else {
    await User.create({
      fullName: 'System Administrator',
      email,
      passwordHash: password,
      accountType: 'super_admin',
      staffRole: 'super_admin',
      status: 'active',
    });
    logger.info(`Super Admin created: ${email}`);
    logger.info('IMPORTANT: change this password after first login.');
  }

  const currentSession = await Session.findOne({ isCurrent: true });
  if (!currentSession) {
    const now = new Date();
    await Session.create({
      name: `${now.getFullYear()}/${now.getFullYear() + 1}`,
      startDate: new Date(now.getFullYear(), 8, 1),
      endDate: new Date(now.getFullYear() + 1, 6, 31),
      isCurrent: true,
      terms: [
        { name: 'First Term', startDate: new Date(now.getFullYear(), 8, 1), endDate: new Date(now.getFullYear(), 11, 20), isCurrent: true },
        { name: 'Second Term', startDate: new Date(now.getFullYear() + 1, 0, 5), endDate: new Date(now.getFullYear() + 1, 3, 5) },
        { name: 'Third Term', startDate: new Date(now.getFullYear() + 1, 3, 20), endDate: new Date(now.getFullYear() + 1, 6, 31) },
      ],
    });
    logger.info('Default academic session created.');
  }

  process.exit(0);
}

seed().catch((err) => {
  logger.error(`Seed failed: ${err.message}`);
  process.exit(1);
});
