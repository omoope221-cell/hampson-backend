const express = require('express');
const userController = require('../controllers/userController');
const { protect } = require('../middleware/auth');
const { restrictTo, requirePermission } = require('../middleware/rbac');

const router = express.Router();

router.use(protect);
router.use(restrictTo('super_admin'));

router.get('/', userController.getAllUsers);
router.get('/password-reset-logs', userController.getPasswordResetLogs);
router.get('/:id', userController.getUser);
router.post('/staff', userController.createStaffAccount);
router.post('/parent', userController.createParentAccount);
router.post('/student', userController.createStudentAccount);
router.patch('/:id/status', userController.updateStatus);
router.patch('/:id/permissions', userController.updatePermissions);
router.post('/:id/reset-password', userController.adminResetPassword);
router.delete('/:id', userController.deleteUser);

module.exports = router;
