const express = require('express');
const faqController = require('../controllers/faqController');
const { protect } = require('../middleware/auth');
const { restrictTo } = require('../middleware/rbac');

const router = express.Router();

router.use(protect);
router.use(restrictTo('super_admin'));

router.get('/', faqController.getAllFaqs);
router.post('/', faqController.createFaq);
router.patch('/reorder', faqController.reorderFaqs);
router.patch('/:id', faqController.updateFaq);
router.delete('/:id', faqController.deleteFaq);

module.exports = router;
