const express = require('express');
const studentController = require('../controllers/studentController');
const { protect } = require('../middleware/auth');
const { restrictTo, requirePermission } = require('../middleware/rbac');
const { uploadStudentPhoto } = require('../middleware/upload');

const router = express.Router();

router.use(protect);

router.get('/', studentController.getAllStudents);
router.get('/:id', studentController.getStudent);

router.patch('/:id', requirePermission('students.update'), studentController.updateStudent);
router.delete('/:id', restrictTo('super_admin'), studentController.deleteStudent);
router.post('/promote', requirePermission('students.update'), studentController.promoteStudents);
router.post('/:id/photo', requirePermission('students.update'), uploadStudentPhoto, studentController.uploadPhoto);

module.exports = router;
