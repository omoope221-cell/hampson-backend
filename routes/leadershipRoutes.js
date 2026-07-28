const express = require('express');
const leadershipController = require('../controllers/leadershipController');
const { protect } = require('../middleware/auth');
const { restrictTo } = require('../middleware/rbac');
const { uploadTeacherPhoto } = require('../middleware/upload');

const router = express.Router();

router.use(protect);
router.use(restrictTo('super_admin'));

router.get('/', leadershipController.getAllLeadership);
router.get('/:id', leadershipController.getLeader);
router.post('/', leadershipController.createLeader);
router.patch('/:id', leadershipController.updateLeader);
router.delete('/:id', leadershipController.deleteLeader);
router.post('/:id/photo', uploadTeacherPhoto, leadershipController.uploadPhoto);

module.exports = router;
