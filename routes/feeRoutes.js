const express = require('express');
const feeController = require('../controllers/feeController');
const { protect } = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');

const router = express.Router();

router.use(protect);

router.get('/', feeController.getAllFees);
router.get('/:id', feeController.getFee);
router.post('/', requirePermission('fees.create'), feeController.createFee);
router.patch('/:id', requirePermission('fees.update'), feeController.updateFee);
router.delete('/:id', requirePermission('fees.delete'), feeController.deleteFee);

module.exports = router;
