const express = require('express');
const router = express.Router();

const CommentController = require('../controllers/comments');
const checkAuth = require('../middlewares/check-auth');
const cache = require('../middlewares/cache-service');

router.post('/:cmtId/like', checkAuth, CommentController.like_comment);

router.post('/:cmtId/unlike', checkAuth, CommentController.unlike_comment);

router.get('/:cmtId/replies', checkAuth, CommentController.get_replies);

router.post('/:cmtId/replies', checkAuth, CommentController.reply_to_comment);

module.exports = router;