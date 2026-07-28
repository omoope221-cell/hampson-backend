const express = require('express');
const admissionController = require('../controllers/admissionController');
const { protect } = require('../middleware/auth');
const { restrictTo } = require('../middleware/rbac');

const router = express.Router();

router.use(protect);
router.use(restrictTo('super_admin'));

router.get('/', admissionController.getAllApplications);
router.get('/:id', admissionController.getApplication);
router.patch('/:id/status', admissionController.updateStatus);
router.delete('/:id', admissionController.deleteApplication);

module.exports = router;
