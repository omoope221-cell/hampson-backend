const express = require('express');
const sessionController = require('../controllers/sessionController');
const { protect } = require('../middleware/auth');
const { restrictTo } = require('../middleware/rbac');

const router = express.Router();

router.use(protect);

router.get('/', sessionController.getAllSessions);
router.get('/current', sessionController.getCurrent);
router.get('/:id', sessionController.getSession);
router.post('/', restrictTo('super_admin'), sessionController.createSession);
router.patch('/:id', restrictTo('super_admin'), sessionController.updateSession);
router.patch('/:id/set-current', restrictTo('super_admin'), sessionController.setCurrent);
router.delete('/:id', restrictTo('super_admin'), sessionController.deleteSession);

module.exports = router;
