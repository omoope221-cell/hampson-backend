const express = require('express');
const publicController = require('../controllers/publicController');
const admissionController = require('../controllers/admissionController');
const { uploadAdmissionDocuments } = require('../middleware/upload');
const { otpRequestLimiter } = require('../middleware/rateLimiter');

// Deliberately no `protect` here — this is the public website's data feed.
const router = express.Router();

router.get('/leadership', publicController.getPublicLeadership);
router.get('/gallery', publicController.getPublicGallery);
router.get('/news-events', publicController.getPublicNewsEvents);
router.get('/news-events/:id', publicController.getPublicNewsEventOne);
router.get('/settings', publicController.getPublicSettings);
router.get('/faqs', publicController.getPublicFaqs);
router.post('/contact', otpRequestLimiter, publicController.submitContactForm);

// Admission application — no online payment, no online exam. Submitting
// the form (with documents) creates the application immediately and
// triggers the automatic instructions email (payment amount, school visit
// date, entrance exam date/time, and school contact details).
router.post('/admissions/submit', otpRequestLimiter, uploadAdmissionDocuments, admissionController.submitApplication);

module.exports = router;
