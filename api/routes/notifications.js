const express = require('express');
const router = express.Router();

const NotiController = require('../controllers/notifications');
const checkAuth = require('../middlewares/check-auth');

router.post('/:notiId/notifySaved', checkAuth, NotiController.notify_saved);

module.exports = router;