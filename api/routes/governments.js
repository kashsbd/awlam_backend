const express = require('express');
const multer = require('multer');
const router = express.Router();

const GovernmentController = require('../controllers/governments');
const checkAuth = require('../middlewares/check-auth');
const cache = require('../middlewares/cache-service');
const { GOVERNMENT_URL } = require('../config/config');

const storage = multer.diskStorage(
    {
        destination: function (req, file, cb) {
            cb(null, GOVERNMENT_URL);
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
router.get('/getAllPosts', checkAuth, cache(10), GovernmentController.get_all_posts);

//create new post
router.post('/', checkAuth, upload.array('postImage'), GovernmentController.create_post);
//get post by id
router.get('/:govId', checkAuth, GovernmentController.get_post_by_id);

//get photo by media id
router.get('/media/:mediaId/:type', GovernmentController.get_photo);
//stream video by media id
router.get('/stream/:mediaId', GovernmentController.stream_video);
//get video thumbnail by media id
router.get('/media/:mediaId/thumbnail', GovernmentController.get_video_thumbnail);

//like post
router.post('/:govId/like', checkAuth, GovernmentController.like_post);
//unlike post
router.post('/:govId/unlike', checkAuth, GovernmentController.unlike_post);
//dislike post
router.post('/:govId/dislike', checkAuth, GovernmentController.dislike_post);
//undislike post
router.post('/:govId/undislike', checkAuth, GovernmentController.undislike_post);

//comment post
router.post('/:govId/comments', checkAuth, GovernmentController.comment_post);
//get all comments of specific post by post id
router.get('/:govId/comments', checkAuth, GovernmentController.get_comments);


//get post reactions
router.post('/:govId/reactions', checkAuth, GovernmentController.get_post_reactions);

//get all searched results
router.get('/:userId/search', checkAuth, GovernmentController.search_posts);

module.exports = router;