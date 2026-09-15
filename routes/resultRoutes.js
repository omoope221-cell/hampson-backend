const express = require('express');
const resultController = require('../controllers/resultController');
const subjectResultController = require('../controllers/subjectResultController');
const { protect } = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');

const router = express.Router();

router.use(protect);

// --- Subject Teacher: enter/submit scores for their own assigned
// class+subject only (ownership enforced inside the controller, not
// just by which links the frontend shows). These literal paths MUST be
// declared before the '/:id' routes below or Express would treat
// "subject-entries"/"review" as an :id.
router.get('/subject-entries/assignments', subjectResultController.getMyAssignments);
router.get('/subject-entries', subjectResultController.getSubjectClassSheet);
router.post('/subject-entries', requirePermission('results.create'), subjectResultController.upsertSubjectResult);
router.patch('/subject-entries/submit', requirePermission('results.update'), subjectResultController.submitSubjectResults);

// --- Class Teacher / Admin: the completion matrix and the aggregate
// Result document (comment, promotion status, submit-for-review,
// approve/publish, reject, unpublish).
router.get('/review', resultController.getClassReviewMatrix);

router.get('/', resultController.getResults);
router.get('/:id', resultController.getResult);
router.get('/:id/report-card', resultController.getReportCardPdf);
router.post('/', requirePermission('results.create'), resultController.upsertResult);
router.patch('/:id/submit', requirePermission('results.update'), resultController.submitResult);
router.patch('/:id/approve', requirePermission('results.approve'), resultController.approveResult);
router.patch('/:id/reject', requirePermission('results.approve'), resultController.rejectResult);
router.patch('/:id/unpublish', requirePermission('results.approve'), resultController.unpublishResult);

module.exports = router;
    