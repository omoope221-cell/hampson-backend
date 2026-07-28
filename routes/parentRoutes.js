const express = require('express');
const parentController = require('../controllers/parentController');
const { protect } = require('../middleware/auth');
const { restrictTo } = require('../middleware/rbac');

const router = express.Router();

router.use(protect);

// Any logged-in parent can read their own profile + children.
router.get('/me', parentController.getMe);

// Everything else — browsing/editing/linking/deleting parent records — is
// a Super Admin action.
router.use(restrictTo('super_admin'));
router.get('/', parentController.getAllParents);
router.get('/:id', parentController.getParent);
router.patch('/:id', parentController.updateParent);
router.delete('/:id', parentController.deleteParent);

module.exports = router;
