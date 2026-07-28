const express = require('express');

const router = express.Router();

router.use('/auth', require('./authRoutes'));
router.use('/users', require('./userRoutes'));
router.use('/students', require('./studentRoutes'));
router.use('/parents', require('./parentRoutes'));
router.use('/student-fee-bills', require('./studentFeeBillRoutes'));
router.use('/staff', require('./staffRoutes'));
router.use('/classes', require('./classRoutes'));
router.use('/subjects', require('./subjectRoutes'));
router.use('/sessions', require('./sessionRoutes'));
router.use('/results', require('./resultRoutes'));
router.use('/fees', require('./feeRoutes'));
router.use('/payments', require('./paymentRoutes'));
router.use('/notifications', require('./notificationRoutes'));
router.use('/dashboard', require('./dashboardRoutes'));
router.use('/leadership', require('./leadershipRoutes'));
router.use('/gallery', require('./galleryRoutes'));
router.use('/news-events', require('./newsEventRoutes'));
router.use('/site-settings', require('./siteSettingsRoutes'));
router.use('/admissions', require('./admissionRoutes'));
router.use('/faqs', require('./faqRoutes'));
router.use('/public', require('./publicRoutes'));

module.exports = router;
