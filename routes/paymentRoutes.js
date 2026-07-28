const express = require('express');
const paymentController = require('../controllers/paymentController');
const { protect } = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');

const router = express.Router();

router.use(protect);

router.get('/', paymentController.getAllPayments);
router.get('/balance', paymentController.getStudentBalance);
router.post('/', requirePermission('payments.create'), paymentController.recordPayment);

module.exports = router;
