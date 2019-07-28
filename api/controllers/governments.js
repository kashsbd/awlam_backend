const mongoose = require('mongoose');
const sharp = require('sharp');
const fs = require('fs');
const OneSignal = require('onesignal-node');
const readFilePromise = require('fs-readfile-promise');
const _ = require('lodash');

const Government = require("../models/government");
const User = require("../models/user");
const Media = require("../models/media");
const Comment = require("../models/comment");
const Notification = require("../models/notification");

const { GOVERNMENT_URL, THUMBNAIL_URL, SERVER_URL } = require('../config/config');
const { resizeVideo, getThumbnail } = require('../utils/convert-video');
const { getPhotoQuality } = require('../utils/calculate-photo-quality');
const { getNotiSubscriber } = require('../utils/get-noti-subscriber');

exports.get_all_posts = async (req, res, next) => {
    const page = req.query.page || 1;
    // limit is 10 as default  in mongoose pagination
    const options = {
        sort: { createdAt: -1 },
        select: '-__v',
        populate: [
            { path: 'user', select: 'name role' },
            { path: 'media', select: 'width height contentType' }
        ],
        page: page
    };

    try {
        const result = await Government.paginate({ isAvailable: true }, options);
        return res.status(200).send(result);
    } catch (error) {
        return res.status(500).send(error);
    }
}

exports.get_post_by_id = async (req, res, next) => {

    const id = req.params.govId;

    try {
        let doc = await Government.findById(id)
            .populate('user', 'name role')
            .populate('media', 'width height contentType')
            .exec();

        if (doc) {
            let rnDoc = JSON.parse(JSON.stringify(doc));
            rnDoc['type'] = 'GOVERNMENT';
            return res.status(200).send(rnDoc);
        }

        return res.status(404).json({
            message: "No valid entry found for provided ID"
        });

    } catch (error) {
        return res.status(500).send(error);
    }
}

exports.render_web_post = async (req, res, next) => {

    const govId = req.params.govId;

    let og_tags = [];

    try {
        let doc = await Government.findById(govId)
            .populate('user', 'name role')
            .populate('media', 'width height contentType')
            .exec();

        if (doc) {
            let rnDoc = JSON.parse(JSON.stringify(doc));
            rnDoc['type'] = 'GOVERNMENT';
            //check populated post and push to og_tags to use in ejs
            //og tag for status
            if (rnDoc.status) {
                og_tags.push({ tag_name: 'og:description', content: rnDoc.status });
            }
            //og tags for media
            if (rnDoc.media.length > 0) {
                const first_media = rnDoc.media[0];
                if (first_media.contentType.startsWith('image/')) {
                    og_tags.push({ tag_name: 'og:image', content: SERVER_URL + 'governments/media/' + first_media._id + '/1.jpg' });
                    og_tags.push({ tag_name: 'og:image:type', content: first_media.contentType });
                    og_tags.push({ tag_name: 'og:image:width', content: first_media.width });
                    og_tags.push({ tag_name: 'og:image:height', content: first_media.height });
                } else if (first_media.contentType.startsWith('video/')) {
                    og_tags.push({ tag_name: 'og:video', content: SERVER_URL + 'governments/media/' + first_media._id });
                    og_tags.push({ tag_name: 'og:video:type', content: first_media.contentType });
                    og_tags.push({ tag_name: 'og:video:width', content: first_media.width });
                    og_tags.push({ tag_name: 'og:video:height', content: first_media.height });
                }
            }
            //og tags for title
            og_tags.push({ tag_name: 'og:title', content: rnDoc.user.name + ' created a post on Awlam.' });

            return res.render('index', { og_tags });
        }

        return res.status(404).json({
            message: "No valid entry found for provided ID"
        });

    } catch (error) {
        return res.status(500).send(error);
    }
}

exports.like_post = async (req, res, next) => {

    const govId = req.params.govId;
    const userId = req.body.userId;

    const likes_socket = req.likes_socket;
    const noties_socket = req.noties_socket;
    const onesignal_client = req.onesignal_client;

    let background_playerIds = [];

    try {
        const post = await Government.findById(govId);

        if (post) {
            const liker = new mongoose.Types.ObjectId(userId);
            const dislike_index = post.dislikes.indexOf(liker);
            //remove liker id if it is found in dislikes list
            if (dislike_index >= 0) {
                post.dislikes.splice(dislike_index, 1);
                await post.save();
            }
            //add liker id only if it is not found in likes list
            if (post.likes.indexOf(liker) === -1) {
                post.likes.push(liker);
                const rnPost = await post.save();
                if (rnPost) {
                    const likes = { id: rnPost._id, likesCount: rnPost.likes.length, dislikesCount: rnPost.dislikes.length };
                    //emits post likes to likes_socket subscriber
                    likes_socket.emit('government::reacted', likes);
                }

                //create notification model
                //noti type is GOVERNMENT-POST, so we put govId in dataId
                const newNoti = new Notification(
                    {
                        _id: new mongoose.Types.ObjectId(),
                        type: 'GOVERNMENT-POST',
                        createdBy: userId,
                        dataId: govId
                    }
                );

                if (post.media.length >= 1) {
                    newNoti.media = post.media[0];
                } else {
                    newNoti.media = null;
                }

                const noti = await newNoti.save();

                let rnNoti = await Notification.findById(noti._id)
                    .populate('createdBy', 'name role')
                    .populate('media', 'contentType')
                    .exec();

                const noti_subscriber = getNotiSubscriber(noties_socket);

                for (let i = 0, len = noti_subscriber.length; i < len; i++) {

                    const { each_noti_socket, user_id } = noti_subscriber[i];

                    //make sure not to send to own
                    if ((user_id === String(post.user)) && (user_id !== userId)) {

                        rnNoti && each_noti_socket.emit('noti::created', rnNoti);
                    }
                }

                const post_owner = await User.findById(post.user);

                if (post_owner !== null && (String(post.user) !== userId)) {
                    const playerIds = post_owner.playerIds;

                    for (let j of playerIds) {
                        const { playerId, status } = j;
                        if (status === 'background' || status === 'inactive') {
                            background_playerIds.push(playerId);
                        }
                    }

                    post_owner.notiLists.push(noti._id);

                    try {
                        const rnPostOwner = await post_owner.save();
                    } catch (error) {
                        console.log("Can't save post_owner.");
                    }

                }

                if (background_playerIds.length >= 1) {

                    if (rnNoti) {
                        const description = rnNoti.createdBy.name + ' liked your post.';
                        let pic_path = '';
                        if (rnNoti.media) {
                            if (rnNoti.media.contentType.startsWith('video/')) {
                                pic_path = SERVER_URL + 'governments/media/' + rnNoti.media._id + '/thumbnail';
                            } else {
                                pic_path = SERVER_URL + 'governments/media/' + rnNoti.media._id;
                            }
                        }

                        const fn = new OneSignal.Notification({
                            headings: {
                                en: 'Awlam'
                            },
                            contents: {
                                en: description
                            },
                            priority: 10,
                            large_icon: SERVER_URL + 'users/' + rnNoti.createdBy._id + '/profile_pic',
                            big_picture: pic_path,
                            include_player_ids: background_playerIds
                        });

                        try {
                            const push_response = await onesignal_client.sendNotification(fn);
                            console.log(push_response.data);
                        } catch (error) {
                            console.log(error);
                        }
                    }
                }

                return res.status(200).json({
                    message: "OK",
                });
            }

            return res.status(200).json({
                message: "OK"
            });
        }

        return res.status(404).json({
            message: "No valid entry found for provided gov id"
        });

    } catch (error) {
        return res.status(500).send(error);
    }
}

exports.unlike_post = async (req, res, next) => {
    const govId = req.params.govId;
    const userId = req.body.userId;

    const likes_socket = req.likes_socket;

    try {
        const post = await Government.findById(govId);

        if (post) {
            const liker = new mongoose.Types.ObjectId(userId);
            const like_index = post.likes.indexOf(liker);
            //remove liker id if it is found in likes list
            if (like_index >= 0) {
                post.likes.splice(like_index, 1);
                const rnPost = await post.save();

                if (rnPost) {
                    const likes = { id: rnPost._id, likesCount: rnPost.likes.length, dislikesCount: rnPost.dislikes.length };
                    //emits post likes to likes_socket subscriber
                    likes_socket.emit('government::reacted', likes);
                }

                return res.status(200).json({
                    message: 'OK'
                });
            }

            return res.status(200).json({
                message: 'OK'
            });
        }

        return res.status(404).json({
            message: 'No valid entry found for provided gov id.'
        });

    } catch (error) {
        return res.status(500).send(error);
    }
}

exports.dislike_post = async (req, res, next) => {
    const govId = req.params.govId;
    const userId = req.body.userId;

    const likes_socket = req.likes_socket;

    try {
        const post = await Government.findById(govId);

        if (post) {
            const disliker = new mongoose.Types.ObjectId(userId);
            const index = post.likes.indexOf(disliker);
            //remove dislike id if it is found in likes list
            if (index >= 0) {
                post.likes.splice(index, 1);
                await post.save();
            }
            //add dislike id only if it is not found in dislike list
            if (post.dislikes.indexOf(disliker) === -1) {
                post.dislikes.push(disliker);
                const rnPost = await post.save();

                if (rnPost) {
                    const dislikes = { id: rnPost._id, likesCount: rnPost.likes.length, dislikesCount: rnPost.dislikes.length };
                    //emits post likes to likes_socket subscriber
                    likes_socket.emit('government::reacted', dislikes);
                }

                return res.status(200).json({
                    message: "OK!",
                });
            }

            return res.status(200).json({
                message: "OK!",
            });

        }
        return res.status(404).json({
            message: "No valid entry found for provided gov id"
        });

    } catch (error) {
        return res.status(500).send(error);
    }
}

exports.undislike_post = async (req, res, next) => {
    const govId = req.params.govId;
    const userId = req.body.userId;

    const likes_socket = req.likes_socket;

    try {
        const post = await Government.findById(govId);
        if (post) {
            const disliker = new mongoose.Types.ObjectId(userId);
            const dislike_index = post.dislikes.indexOf(disliker);
            //remove disliker id if it is found in dislikes list
            if (dislike_index >= 0) {
                post.dislikes.splice(dislike_index, 1);
                const rnPost = await post.save();

                if (rnPost) {
                    const dislikes = { id: rnPost._id, likesCount: rnPost.likes.length, dislikesCount: rnPost.dislikes.length };
                    //emits post dislikes to likes_socket subscriber
                    likes_socket.emit('government::reacted', dislikes);
                }

                return res.status(200).json({
                    message: 'OK'
                });
            }

            return res.status(200).json({
                message: 'OK'
            });
        }

        return res.status(404).json({
            message: 'No valid entry found for provided gov id.'
        });

    } catch (error) {
        return res.status(500).send(error);
    }
}

exports.comment_post = async (req, res, next) => {
    const {
        cmt_owner,
        commentor,
        comment_type,
        message,
        mentions
    } = req.body;

    const likes_socket = req.likes_socket;
    const noties_socket = req.noties_socket;
    const onesignal_client = req.onesignal_client;

    let background_playerIds = [];
    let mention_noti;

    //create new comment object
    const newCmt = new Comment(
        {
            _id: new mongoose.Types.ObjectId(),
            cmt_owner,
            commentor,
            comment_type,
            message
        }
    );

    newCmt.type = 'GOVERNMENT';
    newCmt.mentions = mentions;

    try {
        const rnCmt = await newCmt.save();
        const post = await Government.findById(cmt_owner);

        if (post) {
            post.comments.push(rnCmt._id);
            const rnPost = await post.save();

            if (rnPost) {
                const cmt_count = { id: rnPost._id, cmtCount: rnPost.comments.length };
                //emits comment counts to likes_socket subscriber
                likes_socket.emit('government::commented', cmt_count);
            }

            const cmt = await Comment.findById(rnCmt._id)
                .populate('commentor', 'name role')
                .exec();


            //create notification model
            //noti type is COMMENT-GOVERNMENT, so we put cmt_owner in dataId
            const newNoti = new Notification(
                {
                    _id: new mongoose.Types.ObjectId(),
                    type: 'COMMENT-GOVERNMENT',
                    createdBy: commentor,
                    dataId: cmt_owner
                }
            );

            //add media id if it exits
            newNoti.media = post.media.length >= 1 ? post.media[0] : null;

            let noti = await newNoti.save();

            //create noti object only if mentions' length is greater than zero 
            if (mentions && mentions.length >= 1) {

                mention_noti = new Notification(
                    {
                        _id: new mongoose.Types.ObjectId(),
                        type: 'MENTION-GOVERNMENT',
                        createdBy: commentor,
                        dataId: cmt_owner
                    }
                );
            }

            if (mention_noti) {
                mention_noti.media = post.media.length >= 1 ? post.media[0] : null;
            }

            const mentionNoti = mention_noti && await mention_noti.save();

            let rnNoti = await Notification.findById(noti._id)
                .populate('createdBy', 'name role')
                .populate('media', 'contentType')
                .exec();

            let rnMentionNoti = mentionNoti && await Notification.findById(mentionNoti._id)
                .populate('createdBy', 'name role')
                .populate('media', 'contentType')
                .exec();

            const noti_subscriber = getNotiSubscriber(noties_socket);

            for (let i = 0, len = noti_subscriber.length; i < len; i++) {

                const { each_noti_socket, user_id } = noti_subscriber[i];

                const index = _.findIndex(mentions, { user_id });

                if (index > -1) {
                    each_noti_socket.emit('noti::created', rnMentionNoti);
                }

                //make sure not to send to own
                if (user_id === String(post.user) && (user_id !== commentor)) {
                    rnNoti && each_noti_socket.emit('noti::created', rnNoti);
                }
            }

            const post_owner = await User.findById(post.user);

            if (post_owner !== null && (String(post.user) !== commentor)) {
                const playerIds = post_owner.playerIds;

                for (let j of playerIds) {
                    const { playerId, status } = j;
                    if (status === 'background' || status === 'inactive') {
                        background_playerIds.push(playerId);
                    }
                }

                post_owner.notiLists.push(noti._id);

                try {
                    const rnPostOwner = await post_owner.save();
                } catch (error) {
                    console.log("Can't save post_owner.");
                }
            }

            if (background_playerIds.length >= 1) {

                if (rnNoti) {
                    const description = rnNoti.createdBy.name + ' commented on your post.';
                    let pic_path = '';
                    if (rnNoti.media) {
                        if (rnNoti.media.contentType.startsWith('video/')) {
                            pic_path = SERVER_URL + 'governments/media/' + rnNoti.media._id + '/thumbnail';
                        } else {
                            pic_path = SERVER_URL + 'governments/media/' + rnNoti.media._id;
                        }
                    }

                    const fn = new OneSignal.Notification({
                        headings: {
                            en: 'Awlam'
                        },
                        contents: {
                            en: description
                        },
                        priority: 10,
                        large_icon: SERVER_URL + 'users/' + rnNoti.createdBy._id + '/profile_pic',
                        big_picture: pic_path,
                        include_player_ids: background_playerIds
                    });

                    try {
                        const push_response = await onesignal_client.sendNotification(fn);
                        console.log(push_response.data);
                    } catch (error) {
                        console.log(error);
                    }
                }
            }

            return res.status(201).send(cmt);
        }

        return res.status(404).json(
            {
                message: "No valid entry found for provided gov id"
            }
        );

    } catch (err) {
        return res.status(500).send(err);
    }
}

exports.get_comments = async (req, res, next) => {
    const page = req.query.page || 1;
    const govId = req.params.govId;

    // limit is 10 as default  in mongoose pagination
    const options = {
        sort: { createdAt: 1 },
        select: '-__v ',
        populate: [
            { path: 'commentor', select: 'name role' }
        ],
        page: page
    };

    try {
        const result = await Comment.paginate({ type: 'GOVERNMENT', cmt_owner: govId }, options);
        return res.status(200).send(result);
    } catch (error) {
        return res.status(500).send(error);
    }
}


exports.get_post_reactions = async (req, res, next) => {
    const govId = req.params.govId;
    const userId = req.body.userId;

    let post_likers = [];
    let post_dislikers = [];

    const user_id = new mongoose.Types.ObjectId(userId);

    // let options = {
    //     sort: { createdAt: -1 },
    //     select: '-__v -isAvailable -isUserLoggedIn -email -password -country -city -job -dob -phno -description -playerId -favourites -followingLists -profile',
    //     page: page
    // };

    try {
        const post = await Government.findById(govId);

        if (post) {
            //for post likers
            const likers = await User.find({ _id: { $in: post.likes } });
            //very performant way to iterate in js
            //source :: https://stackoverflow.com/questions/5349425/whats-the-fastest-way-to-loop-through-an-array-in-javascript
            for (let i = 0, len = likers.length; i < len; i++) {
                const usr = await User.findById(likers[i]);

                if (usr) {
                    if (String(usr._id) === userId) {
                        post_likers.push({ userId: usr._id, status: 'You', name: usr.name, role: usr.role });
                    } else if (usr.followerLists.indexOf(user_id) !== -1) {
                        post_likers.push({ userId: usr._id, status: 'Unfollow', name: usr.name, role: usr.role });
                    } else if (usr.followerLists.indexOf(user_id) === -1) {
                        post_likers.push({ userId: usr._id, status: 'Follow', name: usr.name, role: usr.role });
                    }
                }
            }

            //for post dislikers
            const dislikers = await User.find({ _id: { $in: post.dislikes } });

            for (let i = 0, len = dislikers.length; i < len; i++) {
                const usr = await User.findById(dislikers[i]);

                if (usr) {
                    if (String(usr._id) === userId) {
                        post_dislikers.push({ userId: usr._id, status: 'You', name: usr.name, role: usr.role });
                    } else if (usr.followerLists.indexOf(user_id) !== -1) {
                        post_dislikers.push({ userId: usr._id, status: 'Unfollow', name: usr.name, role: usr.role });
                    } else if (usr.followerLists.indexOf(user_id) === -1) {
                        post_dislikers.push({ userId: usr._id, status: 'Follow', name: usr.name, role: usr.role });
                    }
                }
            }

            return res.status(200).json(
                {
                    post_likers,
                    post_dislikers
                }
            );
        }

        return res.status(404).json({
            message: 'No valid entry found for provided gov id.'
        });

    } catch (err) {
        return res.status(500).send(err);
    }
}

exports.create_post = async (req, res, next) => {
    const files = req.files || [];

    const userId = req.body.userId;
    const json_status = req.body.status;
    const raw_hash_tags = req.body.hashtag;

    //init post model
    const post_model = new Government({ _id: new mongoose.Types.ObjectId() });
    post_model.user = userId;

    //for hash tag
    if (raw_hash_tags) {
        const hash_tags = raw_hash_tags.split(',');
        if (hash_tags && hash_tags.length > 0) {
            post_model.hashTags = hash_tags;
        }
    }

    //for status
    if (json_status) {
        const object_status = JSON.parse(json_status);
        post_model.status_type = object_status.type;
        post_model.status = object_status.data.msg;
        post_model.status_media_name = object_status.data.mediaName;
    }

    //for post media
    if (files && files.length > 0) {
        for (let f of files) {
            //init media model
            const media_model = new Media(
                {
                    _id: new mongoose.Types.ObjectId(),
                    type: 'GOVERNMENT'
                }
            );
            //check if it is image
            if (f.mimetype.startsWith('image/')) {
                if (f.mimetype === 'image/gif') {
                    const gif = await sharp(f.path).metadata();
                    //get gif metadata 
                    media_model.width = gif.width;
                    media_model.height = gif.height;
                    media_model.contentType = f.mimetype;
                    media_model.mediaUrl = f.filename;
                } else {
                    const imageName = Date.now() + '_compressed_' + f.originalname.split('.')[0] + '.jpeg';
                    const absolutePath = GOVERNMENT_URL + imageName;
                    const pic = await sharp(f.path).resize().jpeg({ quality: getPhotoQuality(f.size) }).toFile(absolutePath);
                    //get image metadata 
                    media_model.width = pic.width;
                    media_model.height = pic.height;
                    media_model.contentType = f.mimetype;
                    media_model.mediaUrl = imageName;
                    //finally delete original file
                    fs.unlink(f.path, (err) => {
                        if (err) console.log("Can't delete original file.");
                    });
                }

            } else if (f.mimetype.startsWith('video/')) {
                const videoName = Date.now() + '_compressed_' + f.originalname.split('.')[0] + '.mp4';
                const absolutePath = GOVERNMENT_URL + videoName;
                const thumbName = Date.now() + '_thumbnail_' + f.originalname.split('.')[0] + '.jpg';
                const videoProcess = await resizeVideo(f.path, 360, absolutePath);
                console.log(videoProcess);
                const thumbProcess = await getThumbnail(absolutePath, thumbName);
                //get video metadata and all videos are in 640x360 format 
                media_model.width = 640;
                media_model.height = 360;
                media_model.type = 'GOVERNMENT';
                media_model.contentType = f.mimetype;
                media_model.mediaUrl = videoName;
                media_model.thumbnailUrl = thumbName;
                //finally delete original file
                fs.unlink(f.path, (err) => {
                    if (err) console.log("Can't delete original file.");
                });
            }

            //finally save media model and push media id to post model
            const rnMedia = await media_model.save();
            post_model.media.push(rnMedia._id);
        }
    }

    try {
        const rnPost = await post_model.save();
        //get populated post by gov id
        const final_post = await Government.findById(rnPost._id)
            .populate('user', 'name role')
            .populate('media', 'width height contentType')
            .exec();

        if (final_post) {
            return res.status(201).send(final_post);
        }

        return res.status(404).json({
            message: "No valid entry found for provided gov id"
        });

    } catch (e) {
        return res.status(500).json({
            error: e
        });
    }
}

exports.get_photo = async (req, res, next) => {
    const mediaId = req.params.mediaId;

    try {
        const media = await Media.findById(mediaId);

        if (media) {
            const mediaUrl = GOVERNMENT_URL + media.mediaUrl;

            try {
                const file = await readFilePromise(mediaUrl);
                return res.status(200).send(file);
            } catch (error) {
                return res.status(404).json({
                    message: 'No such file'
                });
            }
        } else {
            return res.status(404).json({
                message: 'No valid entry found for provided ID'
            });
        }
    } catch (error) {
        return res.status(500).json({
            message: 'Internal server error'
        });
    }
}

exports.stream_video = async (req, res, next) => {
    const mediaId = req.params.mediaId;

    try {
        const media = await Media.findById(mediaId);
        if (media) {
            const mediaUrl = GOVERNMENT_URL + media.mediaUrl;
            fs.stat(mediaUrl, function (err, stats) {
                if (err) {
                    if (err.code === 'ENOENT') {
                        return res.status(404).send();
                    }
                }

                let start;
                let end;
                let total = 0;
                let contentRange = false;
                let contentLength = 0;

                let range = req.headers.range;
                if (range) {
                    let positions = range.replace(/bytes=/, "").split("-");
                    start = parseInt(positions[0], 10);
                    total = stats.size;
                    end = positions[1] ? parseInt(positions[1], 10) : total - 1;
                    let chunksize = (end - start) + 1;
                    contentRange = true;
                    contentLength = chunksize;
                } else {
                    start = 0;
                    end = stats.size;
                    contentLength = stats.size;
                }

                if (start <= end) {
                    let responseCode = 200;
                    res.setHeader('Accept-Ranges', 'bytes');
                    res.setHeader('Content-Length', contentLength);
                    res.setHeader('Content-Type', 'video/mp4');
                    if (contentRange) {
                        responseCode = 206;
                        res.setHeader('Content-Range', "bytes " + start + "-" + end + "/" + total);
                    }

                    res.statusCode = responseCode;

                    let stream = fs.createReadStream(mediaUrl, { start: start, end: end })
                        .on("readable", function () {
                            let chunk;
                            while (null !== (chunk = stream.read(1024))) {
                                res.write(chunk);
                            }
                        }).on("error", function (err) {
                            res.end(err);
                        }).on("end", function (err) {
                            res.end();
                        });
                } else {
                    res.statusCode = 403;
                    res.end();
                }
            });
        } else {
            res.statusCode = 404;
            res.end("No valid entry found for provided ID");
        }

    } catch (err) {
        res.statusCode = 500;
        res.end('Internal server error');
    }
}

exports.get_video_thumbnail = async (req, res, next) => {
    // media id of post
    const mediaId = req.params.mediaId;

    try {
        const media = await Media.findById(mediaId);
        if (media && media.contentType.startsWith('video/')) {
            const thumbUrl = THUMBNAIL_URL + media.thumbnailUrl;
            try {
                const file = await readFilePromise(thumbUrl);
                return res.status(200).send(file);
            } catch (error) {
                return res.status(404).json({
                    message: "No such file"
                });
            }
        }
        return res.status(404).json({
            message: "No valid entry found for provided ID"
        });

    } catch (err) {
        return res.status(500).json({
            error: err
        });
    }
}

exports.search_posts = async (req, res, next) => {
    const query = req.query.query;
    const page = req.query.page || 1;

    const match_query = {
        "multi_match": {
            "query": query,
            "fields": ["hashTags", "status"],
            "analyzer": "standard"
        }
    };

    const options = {
        sort: { createdAt: -1 },
        select: '-__v',
        populate: [
            { path: 'user', select: 'name role' },
            { path: 'media', select: 'width height contentType' }
        ],
        page: page
    };

    try {
        const searched_posts = await Government.esSearch({ query: match_query });

        if (searched_posts) {
            //pick only _id field from searched_posts
            const all_posts = _.map(searched_posts.hits.hits, '_id');
            //make sure not to overlap
            const all_posts_uniq = _.uniq(all_posts);
            //paginate posts
            const posts = await Government.paginate({ _id: { $in: all_posts_uniq } }, options);
            return res.status(200).send(posts);
        }
        return res.status(200).send([]);
    } catch (err) {
        return res.status(500).json({
            error: err
        });
    }
}

exports.update_post = (req, res, next) => {

}