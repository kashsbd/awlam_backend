const express = require('express');
const multer = require('multer');
const router = express.Router();

const EventController = require('../controllers/events');
const checkAuth = require('../middlewares/check-auth');
const { EVENT_URL } = require('../config/config');

const storage = multer.diskStorage(
    {
        destination: function (req, file, cb) {
            cb(null, EVENT_URL);
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

//get all event posts
router.get('/', checkAuth, EventController.get_all_posts)
//get event post by id
router.get('/:eid', checkAuth, EventController.get_post_by_id);

//get all event sub posts
router.get('/:eid/subposts', checkAuth, EventController.get_all_subposts);

//create new event post
router.post('/', checkAuth, upload.array('media'), EventController.create_post);

//create new event sub post
router.post('/:eid/subposts', checkAuth, upload.array('media'), EventController.create_subpost);

//get photo by media id
router.get('/media/:mediaId/:type', EventController.get_photo);
//stream video by media id
router.get('/stream/:mediaId', EventController.stream_video);

//interest event
router.post('/:eid/interested', checkAuth, EventController.interest_post);
//uninterest event
router.post('/:eid/uninterested', checkAuth, EventController.uninterest_post);

//going event
router.post('/:eid/going', checkAuth, EventController.going_event);
//ungoing event
router.post('/:eid/ungoing', checkAuth, EventController.ungoing_event);

//like sub post
router.post('/subposts/:seid/like', checkAuth, EventController.like_subpost);
//unlike sub post
router.post('/subposts/:seid/unlike', checkAuth, EventController.unlike_subpost);
//dislike sub post
router.post('/subposts/:seid/dislike', checkAuth, EventController.dislike_subpost);
//undislike sub post
router.post('/subposts/:seid/undislike', checkAuth, EventController.undislike_subpost);

//comment sub post
router.post('/subposts/:seid/comments', checkAuth, EventController.comment_subpost);
//get all comments of specific event post by  id
router.get('/:eid/comments', checkAuth, EventController.get_comments);
//get all comments of specific sub event post by  id
router.get('/subposts/:seid/comments', checkAuth, EventController.get_subcomments);

//get event sub post reactions
router.post('/subposts/:seid/reactions', checkAuth, EventController.get_subpost_reactions);

//get all searched results
router.get('/search', checkAuth, EventController.search_posts);

module.exports = router;