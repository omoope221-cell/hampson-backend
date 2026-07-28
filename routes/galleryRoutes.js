const express = require('express');
const galleryController = require('../controllers/galleryController');
const { protect } = require('../middleware/auth');
const { restrictTo } = require('../middleware/rbac');
const { uploadGalleryImage } = require('../middleware/upload');

const router = express.Router();

router.use(protect);
router.use(restrictTo('super_admin'));

router.get('/', galleryController.getAllImages);
router.post('/', uploadGalleryImage, galleryController.uploadImage);
router.patch('/:id', galleryController.updateImage);
router.delete('/:id', galleryController.deleteImage);

module.exports = router;
