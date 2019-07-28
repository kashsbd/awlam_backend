const express = require('express');
const multer = require('multer');
const router = express.Router();

const PostController = require('../controllers/posts');
const checkAuth = require('../middlewares/check-auth');
const cache = require('../middlewares/cache-service');
const { FEED_PIC_URL } = require('../config/config');

const storage = multer.diskStorage(
    {
        destination: function (req, file, cb) {
            cb(null, FEED_PIC_URL);
        },
        filename: function (req, file, cb) {
            cb(null, Date.now() + '-' + file.originalname);
        }
    }
);

const fileFilter = function (req, file, cb) {
    const mimeType = file.mimetype;
    if (mimeType.startsWith('image/') || mimeType.startsWith('video/')) {
        return cb(null, true);
    }
    else
        return cb(new Error(mimeType + " file types are not allowed."), false);
}

const upload = multer(
    {
        storage: storage,
        fileFilter: fileFilter,
        limits: {
            fileSize: 524288000 // 500MB in bytes
        }
    }
);

//get all posts
router.get('/getAllPosts', checkAuth, cache(10), PostController.get_all_posts);
//get follower posts
router.post('/getFollowerPosts', checkAuth, PostController.get_follower_posts);
//get popular posts
router.get('/getPopularPosts', checkAuth, cache(10), PostController.get_popular_posts);

//create new post
router.post('/', checkAuth, upload.array('postImage'), PostController.create_post);
//get post by id
router.get('/:postId', checkAuth, PostController.get_post_by_id);

//get photo by media id
router.get('/media/:mediaId/:type', PostController.get_photo);
//stream video by media id
router.get('/stream/:mediaId', PostController.stream_video);
//get video thumbnail by media id
router.get('/media/:mediaId/thumbnail', PostController.get_video_thumbnail);

//like post
router.post('/:postId/like', checkAuth, PostController.like_post);
//unlike post
router.post('/:postId/unlike', checkAuth, PostController.unlike_post);
//dislike post
router.post('/:postId/dislike', checkAuth, PostController.dislike_post);
//undislike post
router.post('/:postId/undislike', checkAuth, PostController.undislike_post);

//comment post
router.post('/:postId/comments', checkAuth, PostController.comment_post);
//get all comments of specific post by post id
router.get('/:postId/comments', checkAuth, PostController.get_comments);


//get post reactions
router.post('/:postId/reactions', checkAuth, PostController.get_post_reactions);

//get all searched results
router.get('/:userId/search', checkAuth, PostController.search_posts);

module.exports = router;