const express = require('express');
const resultController = require('../controllers/resultController');
const { protect } = require('../middleware/auth');
const { restrictTo, requirePermission } = require('../middleware/rbac');

const router = express.Router();

router.use(protect);

router.get('/', resultController.getResults);
router.get('/:id', resultController.getResult);
router.get('/:id/report-card', resultController.getReportCardPdf);
router.post('/', requirePermission('results.create'), resultController.upsertResult);
router.patch('/:id/submit', requirePermission('results.update'), resultController.submitResult);
router.patch('/:id/approve', requirePermission('results.approve'), resultController.approveResult);
router.patch('/:id/reject', requirePermission('results.approve'), resultController.rejectResult);

module.exports = router;
