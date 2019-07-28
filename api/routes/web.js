const express = require('express');
const router = express.Router();

const PostController = require('../controllers/posts');

//render post by id
router.get('/posts/:postId', PostController.render_web_post);

module.exports = router;