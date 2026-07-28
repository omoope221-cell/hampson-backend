const express = require('express');
const controller = require('../controllers/studentFeeBillController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.get('/', controller.getAllBills);
router.get('/:id', controller.getBill);
router.post('/', controller.upsertBill);
router.patch('/:id/payment-status', controller.updatePaymentStatus);
router.delete('/:id', controller.deleteBill);

module.exports = router;
