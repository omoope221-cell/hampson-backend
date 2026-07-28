const express = require('express');
const newsEventController = require('../controllers/newsEventController');
const { protect } = require('../middleware/auth');
const { restrictTo } = require('../middleware/rbac');
const { uploadNewsEventImage } = require('../middleware/upload');

const router = express.Router();

router.use(protect);
router.use(restrictTo('super_admin'));

router.get('/', newsEventController.getAll);
router.get('/:id', newsEventController.getOne);
router.post('/', uploadNewsEventImage, newsEventController.create);
router.patch('/:id', uploadNewsEventImage, newsEventController.update);
router.delete('/:id', newsEventController.remove);

module.exports = router;
