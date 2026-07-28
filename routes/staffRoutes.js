const express = require('express');
const staffController = require('../controllers/staffController');
const { protect } = require('../middleware/auth');
const { restrictTo, requirePermission } = require('../middleware/rbac');
const { uploadStaffPhoto } = require('../middleware/upload');

const router = express.Router();

router.use(protect);
router.use(requirePermission('staff.view'));

router.get('/', staffController.getAllStaff);
router.get('/:id', staffController.getStaffMember);
router.patch('/:id', restrictTo('super_admin'), staffController.updateStaff);
router.delete('/:id', restrictTo('super_admin'), staffController.deleteStaff);
router.patch('/:id/assignments', restrictTo('super_admin'), staffController.updateAssignments);
router.post('/:id/photo', uploadStaffPhoto, staffController.uploadPhoto);

module.exports = router;
