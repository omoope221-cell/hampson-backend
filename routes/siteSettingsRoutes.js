const express = require('express');
const siteSettingsController = require('../controllers/siteSettingsController');
const { protect } = require('../middleware/auth');
const { restrictTo } = require('../middleware/rbac');
const { uploadSiteImage } = require('../middleware/upload');

const router = express.Router();

router.use(protect);
router.use(restrictTo('super_admin'));

router.get('/', siteSettingsController.getSettings);
router.patch('/', siteSettingsController.updateSettings);
router.post('/image', uploadSiteImage, siteSettingsController.uploadImage);
router.delete('/hero-image/:index', siteSettingsController.removeHeroImage);

module.exports = router;
