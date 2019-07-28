const express = require('express');
const multer = require('multer');
const router = express.Router();

const TopicController = require('../controllers/topics');
const checkAuth = require('../middlewares/check-auth');
const { TOPIC_URL } = require('../config/config');

const storage = multer.diskStorage(
    {
        destination: function (req, file, cb) {
            cb(null, TOPIC_URL);
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

//get all topic posts
router.get('/', checkAuth, TopicController.get_all_posts);
//get all invited and private topic posts
router.get('/invited/:userId', checkAuth, TopicController.get_private_and_invited);
//get all private topic posts
router.get('/private/:userId', checkAuth, TopicController.get_private);
//search all private topic posts
router.get('/private/:userId/search', checkAuth, TopicController.search_private_post);
//get topic post by id
router.get('/:tid', checkAuth, TopicController.get_post_by_id);
//subscribe to public topic post
router.post('/:tid/subscribe/:userId', checkAuth, TopicController.subscribe_topic);
//get all subscribed posts using userId
router.get('/subscribed/:userId', checkAuth, TopicController.get_subscribed_posts);

//get all topic sub posts
router.get('/:tid/subposts', checkAuth, TopicController.get_all_subposts);

//create new topic post
router.post('/', checkAuth, upload.array('media'), TopicController.create_post);

//create new topic sub post
router.post('/:tid/subposts', checkAuth, upload.array('media'), TopicController.create_subpost);

//get photo by media id
router.get('/media/:mediaId/:type', TopicController.get_photo);
//stream video by media id
router.get('/stream/:mediaId', TopicController.stream_video);

//like post
router.post('/:tid/like', checkAuth, TopicController.like_post);
//like sub post
router.post('/subposts/:stid/like', checkAuth, TopicController.like_subpost);
//unlike post
router.post('/:tid/unlike', checkAuth, TopicController.unlike_post);
//unlike sub post
router.post('/subposts/:stid/unlike', checkAuth, TopicController.unlike_subpost);
//dislike post
router.post('/:tid/dislike', checkAuth, TopicController.dislike_post);
//dislike sub post
router.post('/subposts/:stid/dislike', checkAuth, TopicController.dislike_subpost);
//undislike post
router.post('/:tid/undislike', checkAuth, TopicController.undislike_post);
//undislike sub post
router.post('/subposts/:stid/undislike', checkAuth, TopicController.undislike_subpost);

//comment post
router.post('/:tid/comments', checkAuth, TopicController.comment_post);
//comment sub post
router.post('/subposts/:stid/comments', checkAuth, TopicController.comment_subpost);
//get all comments of specific topic post by  id
router.get('/:tid/comments', checkAuth, TopicController.get_comments);
//get all comments of specific sub topic post by  id
router.get('/subposts/:stid/comments', checkAuth, TopicController.get_subcomments);

//get topic post reactions
router.post('/:tid/reactions', checkAuth, TopicController.get_post_reactions);
//get topic sub post reactions
router.post('/subposts/:stid/reactions', checkAuth, TopicController.get_subpost_reactions);

//get all searched results
router.get('/search', checkAuth, TopicController.search_posts);

module.exports = router;