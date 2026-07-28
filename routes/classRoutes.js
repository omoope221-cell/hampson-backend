const express = require('express');
const classController = require('../controllers/classController');
const { protect } = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');

const router = express.Router();

router.use(protect);

router.get('/', classController.getAllClasses);
router.get('/:id', classController.getClass);
router.post('/', requirePermission('classes.create'), classController.createClass);
router.patch('/:id', requirePermission('classes.update'), classController.updateClass);
router.delete('/:id', requirePermission('classes.delete'), classController.deleteClass);

module.exports = router;
