const express = require('express');
const multer = require('multer');
const router = express.Router();

const UserController = require('../controllers/users');
const { PROPIC_URL } = require('../config/config');
const checkAuth = require('../middlewares/check-auth');

const storage = multer.diskStorage(
    {
        destination: function (req, file, cb) {
            cb(null, PROPIC_URL);
        },
        filename: function (req, file, cb) {
            cb(null, Date.now() + '-' + file.originalname);
        }
    }
);

const fileFilter = function (req, file, cb) {
    const mimeType = file.mimetype;
    if (mimeType.startsWith('image/')) {
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

router.get('/test', UserController.test);

router.post('/', checkAuth, upload.single('propic'), UserController.create_new_user);

router.post('/signup', upload.single('propic'), UserController.user_signup);

router.post('/login', UserController.user_login);

router.get('/:userId/profile_pic', UserController.get_profile_pic);

router.post('/:userId/logout', UserController.user_logout);

//follow user
router.post('/:userId/follow', checkAuth, UserController.follow_user);
//unfollow user
router.post('/:userId/unfollow', checkAuth, UserController.unfollow_user);

//get all unsaved notis
router.get('/:userId/getUnsavedNotis', checkAuth, UserController.get_unsaved_notis);

//get all posts by userId
router.get('/:userId/posts', checkAuth, UserController.get_all_posts);

router.post('/:userId/notifyAppChange', checkAuth, UserController.notify_state_change);

//get all followers of userId
router.post('/:userId/followers', checkAuth, UserController.get_all_followers);

//get all followings of userId
router.post('/:userId/followings', checkAuth, UserController.get_all_followings);

//get all followers and followings
router.get('/:userId/followerfollowings', checkAuth, UserController.get_all_followers_and_followings);

//get all suggestions of userId
router.get('/:userId/suggestions', checkAuth, UserController.get_all_suggestions);

//get all search results
router.get('/search', checkAuth, UserController.search);

//get all search results
router.get('/:userId/search', checkAuth, UserController.search_name_of_user);
module.exports = router;