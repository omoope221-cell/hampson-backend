const express = require('express');
const subjectController = require('../controllers/subjectController');
const { protect } = require('../middleware/auth');
const { requirePermission } = require('../middleware/rbac');

const router = express.Router();

router.use(protect);

router.get('/', subjectController.getAllSubjects);
router.get('/:id', subjectController.getSubject);
router.post('/', requirePermission('subjects.create'), subjectController.createSubject);
router.patch('/:id', requirePermission('subjects.update'), subjectController.updateSubject);
router.delete('/:id', requirePermission('subjects.delete'), subjectController.deleteSubject);

module.exports = router;
