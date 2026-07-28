const express = require('express');
const notificationController = require('../controllers/notificationController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.get('/', notificationController.getMyNotifications);
router.patch('/:id/read', notificationController.markRead);
router.patch('/read-all', notificationController.markAllRead);
router.delete('/:id', notificationController.deleteNotification);

module.exports = router;
