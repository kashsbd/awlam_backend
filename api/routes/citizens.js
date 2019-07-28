const express = require('express');
const multer = require('multer');
const router = express.Router();

const CitizenController = require('../controllers/citizens');
const checkAuth = require('../middlewares/check-auth');
const cache = require('../middlewares/cache-service');
const { CITIZEN_PIC_URL } = require('../config/config');

const storage = multer.diskStorage(
    {
        destination: function (req, file, cb) {
            cb(null, CITIZEN_PIC_URL);
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

//get all citizen posts
router.get('/', checkAuth, CitizenController.get_all_posts);
//get citizen post by id
router.get('/:cid', checkAuth, CitizenController.get_post_by_id);

//get all citizen sub posts
router.get('/:cid/subposts', checkAuth, CitizenController.get_all_subposts);

//create new citizen post
router.post('/', checkAuth, upload.array('media'), CitizenController.create_post);

//approve citizen post
router.post('/:cid/approve', checkAuth, CitizenController.approve_post);

//create new citizen sub post
router.post('/:cid/subposts', checkAuth, upload.array('media'), CitizenController.create_subpost);

//get photo by media id
router.get('/media/:mediaId/:type', CitizenController.get_photo);
//stream video by media id
router.get('/stream/:mediaId', CitizenController.stream_video);

//like post
router.post('/:cid/like', checkAuth, CitizenController.like_post);
//like sub post
router.post('/subposts/:scid/like', checkAuth, CitizenController.like_subpost);
//unlike post
router.post('/:cid/unlike', checkAuth, CitizenController.unlike_post);
//unlike sub post
router.post('/subposts/:scid/unlike', checkAuth, CitizenController.unlike_subpost);
//dislike post
router.post('/:cid/dislike', checkAuth, CitizenController.dislike_post);
//dislike sub post
router.post('/subposts/:scid/dislike', checkAuth, CitizenController.dislike_subpost);
//undislike post
router.post('/:cid/undislike', checkAuth, CitizenController.undislike_post);
//undislike sub post
router.post('/subposts/:scid/undislike', checkAuth, CitizenController.undislike_subpost);

//comment post
router.post('/:cid/comments', checkAuth, CitizenController.comment_post);
//comment sub post
router.post('/subposts/:scid/comments', checkAuth, CitizenController.comment_subpost);
//get all comments of specific citizen post by  id
router.get('/:cid/comments', checkAuth, CitizenController.get_comments);
//get all comments of specific sub citizen post by  id
router.get('/subposts/:scid/comments', checkAuth, CitizenController.get_subcomments);

//get citizen post reactions
router.post('/:cid/reactions', checkAuth, CitizenController.get_post_reactions);
//get citizen sub post reactions
router.post('/subposts/:scid/reactions', checkAuth, CitizenController.get_subpost_reactions);


module.exports = router;