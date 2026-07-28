const express = require('express');
const dashboardController = require('../controllers/dashboardController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);
router.get('/summary', dashboardController.getSummary);

module.exports = router;
