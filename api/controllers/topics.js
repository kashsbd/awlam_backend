const mongoose = require('mongoose');
const sharp = require('sharp');
const fs = require('fs');
const OneSignal = require('onesignal-node');
const readFilePromise = require('fs-readfile-promise');

const Topic = require("../models/topic");
const SubTopic = require("../models/topicpost");
const User = require("../models/user");
const Media = require("../models/media");
const Comment = require("../models/comment");
const Notification = require('../models/notification');

const { TOPIC_URL, THUMBNAIL_URL, SERVER_URL } = require('../config/config');
const { resizeVideo, getThumbnail } = require('../utils/convert-video');
const { getPhotoQuality } = require('../utils/calculate-photo-quality');
const { getNotiSubscriber } = require('../utils/get-noti-subscriber');

const _ = require('lodash');

exports.subscribe_topic = async (req, res, next) => {
    const { tid, userId } = req.params;

    try {
        const topic = await Topic.findById(tid);

        if (topic) {
            //check the topic is public
            if (topic.isPublic) {
                const user_id = new mongoose.Types.ObjectId(userId);
                if (topic.subscribed_users.indexOf(user_id) === -1) {
                    topic.subscribed_users.push(user_id);
                }
            }

            return res.status(200).send({
                msg: 'OK'
            });
        }

        return res.status(404).json({
            message: "No valid entry found for provided ID"
        });

    } catch (error) {
        return res.status(500).json({
            error: error
        });
    }
}

exports.get_subscribed_posts = async (req, res, next) => {
    const page = req.query.page || 1;
    const userId = req.params.userId;

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
        const topics = await Topic.paginate({ isAvailable: true, subscribed_users: { $in: [userId] }, isPublic: true }, options);
        return res.status(200).send(topics);
    } catch (error) {
        return res.status(500).send(error);
    }
}

//get private and invited topics by userId
exports.get_private_and_invited = async (req, res, next) => {
    const page = req.query.page || 1;
    const userId = req.params.userId;

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

    let final_data = {};
    let user_private_topics = [];

    const topics = await Topic.find({ isAvailable: true, user: userId, isPublic: false })
        .populate('user', 'name role')
        .populate('media', 'width height contentType')
        .sort({ createdAt: -1 })
        .exec();

    if (topics && topics.length > 0) {
        user_private_topics = topics;
    }

    final_data['userPrivateTopic'] = user_private_topics;

    try {
        const posts = await Topic.paginate({ isAvailable: true, permitted_users: { $in: [userId] }, isPublic: false }, options);
        final_data['posts'] = posts;
        return res.status(200).send(final_data);
    } catch (error) {
        return res.status(500).send(error);
    }
}

//get all private topics by userId
exports.get_private = async (req, res, next) => {
    const page = req.query.page || 1;
    const userId = req.params.userId;

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
        const posts = await Topic.paginate({ isAvailable: true, user: userId, isPublic: false }, options);
        return res.status(200).send(posts);
    } catch (error) {
        return res.status(500).send(error);
    }
}

//search private topic post only
exports.search_private_post = async (req, res, next) => {
    const query = req.query.query;
    const userId = req.params.userId;

    const search_quary = {
        isAvailable: true,
        user: userId,
        isPublic: false,
        description: { '$regex': query, '$options': 'i' }
    }

    try {
        const topics = await Topic.find(search_quary)
            .populate('user', 'name role')
            .populate('media', 'width height contentType')
            .sort({ createdAt: -1 })
            .exec();
        return res.status(200).send(topics);
    } catch (error) {
        return res.status(500).send(error);
    }
}

exports.get_all_posts = async (req, res, next) => {
    const page = req.query.page || 1;

    // limit is 10 as default in mongoose pagination
    const options = {
        sort: { createdAt: -1 },
        select: '-__v',
        populate: [
            { path: 'user', select: 'name role' },
            { path: 'media', select: 'width height contentType' },
        ],
        page: page
    };

    try {
        const result = await Topic.paginate({ isAvailable: true, isPublic: true }, options);
        return res.status(200).send(result);
    } catch (error) {
        return res.status(500).send(error);
    }
}

exports.get_post_by_id = async (req, res, next) => {
    const id = req.params.tid;

    try {
        let doc = await Topic.findById(id)
            .populate('user', 'name role')
            .populate('media', 'width height contentType')
            .exec();

        if (doc) {
            //append type to show correctly in noti view
            let rnDoc = JSON.parse(JSON.stringify(doc));
            rnDoc['type'] = 'TOPIC';
            return res.status(200).send(rnDoc);
        }

        return res.status(404).json({
            message: "No valid entry found for provided ID"
        });

    } catch (error) {
        return res.status(500).send(error);
    }
}

exports.get_all_subposts = async (req, res, next) => {
    const page = req.query.page || 1;
    const tid = req.params.tid;
    // limit is 10 as default  in mongoose pagination
    const options = {
        sort: { createdAt: -1 },
        select: '-__v',
        populate: [
            { path: 'user', select: 'name role' },
            { path: 'media', select: 'width height contentType' },
        ],
        page: page
    };

    let posts = {};

    try {
        const headerData = await Topic.find({ _id: tid, isAvailable: true })
            .populate('user', 'name role')
            .populate('media', 'width height contentType')
            .exec();

        if (headerData && headerData[0]) {
            posts['headerData'] = headerData[0];
        } else {
            return res.status(404).json({
                message: 'No valid data found for provided id'
            });
        }
        const result = await SubTopic.paginate({ isAvailable: true, post_owner: tid }, options);
        posts['posts'] = result;
        return res.status(200).send(posts);
    } catch (error) {
        return res.status(500).send(error);
    }
}

exports.like_post = async (req, res, next) => {
    const tid = req.params.tid;
    const userId = req.body.userId;

    const likes_socket = req.likes_socket;
    const noties_socket = req.noties_socket;
    const onesignal_client = req.onesignal_client;

    let background_playerIds = [];

    try {
        const post = await Topic.findById(tid);

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
                    likes_socket.emit('topic::reacted', likes);
                }

                //create notification model
                //noti type is LIKE-TOPIC, so we put tid in dataId
                const newNoti = new Notification(
                    {
                        _id: new mongoose.Types.ObjectId(),
                        type: 'LIKE-TOPIC',
                        createdBy: userId,
                        dataId: tid
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
                        const description = rnNoti.createdBy.name + ' liked  your topic post.';
                        let pic_path = '';
                        if (rnNoti.media) {
                            if (rnNoti.media.contentType.startsWith('video/')) {
                                pic_path = SERVER_URL + 'topics/media/' + rnNoti.media._id + '/thumbnail';
                            } else {
                                pic_path = SERVER_URL + 'topics/media/' + rnNoti.media._id + '/1.jpg';
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
            message: "No valid entry found for provided topic id"
        });

    } catch (error) {
        return res.status(500).send(error);
    }
}

exports.like_subpost = async (req, res, next) => {
    const stid = req.params.stid;
    const userId = req.body.userId;

    const likes_socket = req.likes_socket;
    const noties_socket = req.noties_socket;
    const onesignal_client = req.onesignal_client;

    let background_playerIds = [];

    try {
        const post = await SubTopic.findById(stid);

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
                    likes_socket.emit('subtopic::reacted', likes);
                }

                //create notification model
                //noti type is LIKE-SUBTOPIC, so we put tid in dataId
                const newNoti = new Notification(
                    {
                        _id: new mongoose.Types.ObjectId(),
                        type: 'LIKE-SUBTOPIC',
                        createdBy: userId,
                        dataId: post.post_owner
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
                        const description = rnNoti.createdBy.name + ' liked  your topic post.';
                        let pic_path = '';
                        if (rnNoti.media) {
                            if (rnNoti.media.contentType.startsWith('video/')) {
                                pic_path = SERVER_URL + 'topics/media/' + rnNoti.media._id + '/thumbnail';
                            } else {
                                pic_path = SERVER_URL + 'topics/media/' + rnNoti.media._id + '/1.jpg';
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
            message: "No valid entry found for provided topic id"
        });

    } catch (error) {
        return res.status(500).send(error);
    }
}

exports.unlike_post = async (req, res, next) => {
    const tid = req.params.tid;
    const userId = req.body.userId;

    const likes_socket = req.likes_socket;

    try {
        const post = await Topic.findById(tid);

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
                    likes_socket.emit('topic::reacted', likes);
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
            message: 'No valid entry found for provided topic id.'
        });

    } catch (error) {
        return res.status(500).send(error);
    }
}

exports.unlike_subpost = async (req, res, next) => {
    const stid = req.params.stid;
    const userId = req.body.userId;

    const likes_socket = req.likes_socket;

    try {
        const post = await SubTopic.findById(stid);

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
                    likes_socket.emit('subtopic::reacted', likes);
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
            message: 'No valid entry found for provided topic id.'
        });

    } catch (error) {
        return res.status(500).send(error);
    }
}

exports.dislike_post = async (req, res, next) => {
    const tid = req.params.tid;
    const userId = req.body.userId;

    const likes_socket = req.likes_socket;

    try {
        const post = await Topic.findById(tid);

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
                    likes_socket.emit('topic::reacted', dislikes);
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
            message: "No valid entry found for provided topic id"
        });

    } catch (error) {
        return res.status(500).send(error);
    }
}

exports.dislike_subpost = async (req, res, next) => {
    const stid = req.params.stid;
    const userId = req.body.userId;

    const likes_socket = req.likes_socket;

    try {
        const post = await SubTopic.findById(stid);

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
                    likes_socket.emit('subtopic::reacted', dislikes);
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
            message: "No valid entry found for provided topic id"
        });

    } catch (error) {
        return res.status(500).send(error);
    }
}

exports.undislike_post = async (req, res, next) => {
    const tid = req.params.tid;
    const userId = req.body.userId;

    const likes_socket = req.likes_socket;

    try {
        const post = await Topic.findById(tid);

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
                    likes_socket.emit('topic::reacted', dislikes);
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
            message: 'No valid entry found for provided topic id.'
        });

    } catch (error) {
        return res.status(500).send(error);
    }
}

exports.undislike_subpost = async (req, res, next) => {
    const stid = req.params.stid;
    const userId = req.body.userId;

    const likes_socket = req.likes_socket;

    try {
        const post = await SubTopic.findById(stid);

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
                    likes_socket.emit('subtopic::reacted', dislikes);
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
            message: 'No valid entry found for provided topic id.'
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
    let newCmt = new Comment(
        {
            _id: new mongoose.Types.ObjectId(),
            cmt_owner,
            commentor,
            comment_type,
            message
        }
    );
    newCmt.type = 'TOPIC';
    newCmt.mentions = mentions;

    try {
        const rnCmt = await newCmt.save();
        const post = await Topic.findById(cmt_owner);

        if (post) {
            post.comments.push(rnCmt._id);
            const rnPost = await post.save();
            if (rnPost) {
                const cmt_count = { id: rnPost._id, cmtCount: rnPost.comments.length };
                //emits comment counts to likes_socket subscriber
                likes_socket.emit('topic::commented', cmt_count);
            }

            const cmt = await Comment.findById(rnCmt._id)
                .populate('commentor', 'name role')
                .exec();

            //create notification model
            //noti type is COMMENT-TOPIC, so we put cmt_owner in dataId
            const newNoti = new Notification(
                {
                    _id: new mongoose.Types.ObjectId(),
                    type: 'COMMENT-TOPIC',
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
                        type: 'MENTION-TOPIC',
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

                let index = _.findIndex(mentions, { user_id });

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
                    const description = rnNoti.createdBy.name + ' commented on your topic post.';
                    let pic_path = '';
                    if (rnNoti.media) {
                        if (rnNoti.media.contentType.startsWith('video/')) {
                            pic_path = SERVER_URL + 'topics/media/' + rnNoti.media._id + '/thumbnail';
                        } else {
                            pic_path = SERVER_URL + 'topics/media/' + rnNoti.media._id + '/1.jpg';
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

        return res.status(404).json({
            message: "No valid entry found for provided topic id"
        });

    } catch (err) {
        return res.status(500).send(err);
    }
}

exports.comment_subpost = async (req, res, next) => {
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
    let newCmt = new Comment(
        {
            _id: new mongoose.Types.ObjectId(),
            cmt_owner,
            commentor,
            comment_type,
            message
        }
    );
    newCmt.type = 'SUBTOPIC';
    newCmt.mentions = mentions;

    try {
        const rnCmt = await newCmt.save();
        const post = await SubTopic.findById(cmt_owner);

        if (post) {
            post.comments.push(rnCmt._id);
            const rnPost = await post.save();
            if (rnPost) {
                const cmt_count = { id: rnPost._id, cmtCount: rnPost.comments.length };
                //emits comment counts to likes_socket subscriber
                likes_socket.emit('subtopic::commented', cmt_count);
            }

            const cmt = await Comment.findById(rnCmt._id)
                .populate('commentor', 'name role')
                .exec();

            //create notification model
            //noti type is COMMENT-SUBTOPIC, so we put cmt_owner in dataId
            const newNoti = new Notification(
                {
                    _id: new mongoose.Types.ObjectId(),
                    type: 'COMMENT-SUBTOPIC',
                    createdBy: commentor,
                    dataId: post.post_owner
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
                        type: 'MENTION-SUBTOPIC',
                        createdBy: commentor,
                        dataId: post.post_owner
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
                    rnMentionNoti && each_noti_socket.emit('noti::created', rnMentionNoti);
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
                    const description = rnNoti.createdBy.name + ' commented on your topic post.';
                    let pic_path = '';
                    if (rnNoti.media) {
                        if (rnNoti.media.contentType.startsWith('video/')) {
                            pic_path = SERVER_URL + 'topics/media/' + rnNoti.media._id + '/thumbnail';
                        } else {
                            pic_path = SERVER_URL + 'topics/media/' + rnNoti.media._id;
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

        return res.status(404).json({
            message: "No valid entry found for provided topic id"
        });

    } catch (err) {
        return res.status(500).send(err);
    }
}

exports.get_comments = async (req, res, next) => {
    const page = req.query.page || 1;
    const tid = req.params.tid;

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
        const result = await Comment.paginate({ type: 'TOPIC', cmt_owner: tid }, options);
        return res.status(200).send(result);
    } catch (error) {
        return res.status(500).send(error);
    }
}

exports.get_subcomments = async (req, res, next) => {
    const page = req.query.page || 1;
    const stid = req.params.stid;

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
        const result = await Comment.paginate({ type: 'SUBTOPIC', cmt_owner: stid }, options);
        return res.status(200).send(result);
    } catch (error) {
        return res.status(500).send(error);
    }
}


exports.get_post_reactions = async (req, res, next) => {
    const tid = req.params.tid;
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
        const post = await Topic.findById(tid);

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
            message: 'No valid entry found for provided topic id.'
        });

    } catch (err) {
        return res.status(500).send(err);
    }
}

exports.get_subpost_reactions = async (req, res, next) => {
    const stid = req.params.stid;
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
        const post = await SubTopic.findById(stid);

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
            message: 'No valid entry found for provided topic id.'
        });

    } catch (err) {
        return res.status(500).send(err);
    }
}

exports.create_post = async (req, res, next) => {
    const files = req.files || [];
    const onesignal_client = req.onesignal_client;

    const noties_socket = req.noties_socket;

    //playerIds of user whose app are in background state
    let background_playerIds = [];
    //to store permitted user ids of topic
    let permitted_users = [];

    const {
        userId,
        postType,
        description,
        permitted_users_str
    } = req.body;

    const isPublic = postType === 'Public';
    //init topic model
    const topic_model = new Topic({ _id: new mongoose.Types.ObjectId() });
    topic_model.user = userId;
    topic_model.isPublic = isPublic;

    //for topic description
    if (description) {
        topic_model.description = description;
    }

    //if the post is not public, we will let user to add his follower and following users to see the post
    if (!isPublic && permitted_users_str) {
        permitted_users = JSON.parse(permitted_users_str);
        topic_model.permitted_users = permitted_users;
    }

    //for post media
    if (files && files.length > 0) {
        for (let f of files) {
            //init media model
            const media_model = new Media(
                {
                    _id: new mongoose.Types.ObjectId(),
                    type: 'TOPIC'
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
                    const absolutePath = TOPIC_URL + imageName;
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
            }

            //finally save media model and push media id to citizen model
            const rnMedia = await media_model.save();
            topic_model.media.push(rnMedia._id);
        }
    }

    try {
        const rnPost = await topic_model.save();

        const final_post = await Topic.findById(rnPost._id)
            .populate('user', 'name role')
            .populate('media', 'width height contentType')
            .exec();

        if (final_post !== null && !isPublic) {
            //create notification model
            //noti type is CREATE-TOPIC, so we put topic's rnPost._id in dataId
            let newNoti = new Notification(
                {
                    _id: new mongoose.Types.ObjectId(),
                    type: 'INVITE-TOPIC',
                    createdBy: userId,
                    dataId: rnPost._id
                }
            );

            if (rnPost.media.length >= 1) {
                newNoti.media = rnPost.media[0];
            } else {
                newNoti.media = null;
            }

            const noti = await newNoti.save();

            let rnNoti = await Notification.findById(noti._id)
                .populate('createdBy', 'name role')
                .populate('media', 'contentType')
                .exec();

            const noti_subscriber = getNotiSubscriber(noties_socket);

            //send noti via socket 
            for (let i = 0, len = noti_subscriber.length; i < len; i++) {

                const { each_noti_socket, user_id } = noti_subscriber[i];

                try {
                    //convert to mongo object id
                    const userTwo = new mongoose.Types.ObjectId(user_id);
                    //can't use permitted_users.includes(userTwo)
                    //see https://github.com/Automattic/mongoose/issues/6354
                    const index = permitted_users.indexOf(userTwo);
                    if (index > -1) {
                        rnNoti && each_noti_socket.emit('noti::created', rnNoti);
                    }
                } catch (err) {
                    console.log("Can't convert to mongo object id " + user_id);
                }
            }

            //send noti via one signal
            for (let j = 0, len = permitted_users.length; j < len; j++) {
                let follower = await User.findById(permitted_users[j]);

                if (follower) {
                    const playerIds = follower.playerIds;

                    for (let k of playerIds) {
                        const { playerId, status } = k;
                        if (status === 'background' || status === 'inactive') {
                            background_playerIds.push(playerId);
                        }
                    }

                    follower.notiLists.push(noti._id);
                    try {
                        const rnFollower = await follower.save();
                    } catch (error) {
                        console.log("Can't save follower user.");
                    }
                }
            }

            if (background_playerIds.length >= 1) {

                if (rnNoti) {
                    const description = rnNoti.createdBy.name + ' invited you in this topic.';
                    let pic_path = '';
                    if (rnNoti.media) {
                        if (rnNoti.media.contentType.startsWith('video/')) {
                            pic_path = SERVER_URL + 'topics/media/' + rnNoti.media._id + '/thumbnail';
                        } else {
                            pic_path = SERVER_URL + 'topics/media/' + rnNoti.media._id + '/1.jpg';
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

            return res.status(201).send(final_post);
        }

        return res.status(404).json({
            message: "No valid entry found for provided topic id"
        });

    } catch (e) {
        return res.status(500).json({
            error: e
        });
    }
}

exports.create_subpost = async (req, res, next) => {
    const files = req.files || [];
    const tid = req.params.tid;

    const noties_socket = req.noties_socket;
    const onesignal_client = req.onesignal_client;

    let background_playerIds = [];

    const {
        userId,
        description,
        locationData,
        postType
    } = req.body;

    const isPublic = postType === 'Public';

    //init subtopic model
    const subtopic_model = new SubTopic({ _id: new mongoose.Types.ObjectId() });
    subtopic_model.user = userId;
    subtopic_model.post_owner = tid;
    subtopic_model.isPublic = isPublic;

    //for post description
    if (description) {
        subtopic_model.description = description;
    }

    //for post location
    if (locationData) {
        const location = JSON.parse(locationData);
        if (location) {
            const loc_obj = {
                name: location.name,
                address: location.address,
                lat: location.latitude,
                lon: location.longitude
            };
            subtopic_model.location = loc_obj;
        }
    }

    //for post media
    if (files && files.length > 0) {
        for (let f of files) {
            //init media model
            const media_model = new Media(
                {
                    _id: new mongoose.Types.ObjectId(),
                    type: 'TOPIC-SUBPOST'
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
                    const absolutePath = TOPIC_URL + imageName;
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
                const absolutePath = TOPIC_URL + videoName;
                const thumbName = Date.now() + '_thumbnail_' + f.originalname.split('.')[0] + '.jpg';
                const videoProcess = await resizeVideo(f.path, 360, absolutePath);
                console.log(videoProcess);
                const thumbProcess = await getThumbnail(absolutePath, thumbName);
                //get video metadata and all videos are in 640x360 format 
                media_model.width = 640;
                media_model.height = 360;
                media_model.contentType = f.mimetype;
                media_model.mediaUrl = videoName;
                media_model.thumbnailUrl = thumbName;
                //finally delete original file
                fs.unlink(f.path, (err) => {
                    if (err) console.log("Can't delete original file.");
                });
            }

            //finally save media model and push media id to topic model
            const rnMedia = await media_model.save();
            subtopic_model.media.push(rnMedia._id);
        }
    }

    try {
        const rnPost = await subtopic_model.save();
        //get populated post by topic id
        const final_post = await SubTopic.findById(rnPost._id)
            .populate('user', 'name role')
            .populate('media', 'width height contentType')
            .exec();

        if (final_post) {
            //create notification model
            //noti type is CREATE-SUBTOPIC, so we put topic's rnPost._id in dataId
            let newNoti = new Notification(
                {
                    _id: new mongoose.Types.ObjectId(),
                    type: 'CREATE-SUBTOPIC',
                    createdBy: userId,
                    dataId: tid
                }
            );

            if (rnPost.media.length >= 1) {
                newNoti.media = rnPost.media[0];
            } else {
                newNoti.media = null;
            }

            const noti = await newNoti.save();

            let rnNoti = await Notification.findById(noti._id)
                .populate('createdBy', 'name role')
                .populate('media', 'contentType')
                .exec();

            let topic = await Topic.findById(tid);

            const noti_subscriber = getNotiSubscriber(noties_socket);

            for (let i = 0, len = noti_subscriber.length; i < len; i++) {

                const { each_noti_socket, user_id } = noti_subscriber[i];

                //make sure not to send to own
                if (user_id === String(topic.user) && (String(topic.user) !== userId)) {
                    rnNoti && each_noti_socket.emit('noti::created', rnNoti);
                }
            }

            const post_owner = await User.findById(topic.user);

            if (post_owner !== null && String(topic.user) !== userId) {
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
                    const description = rnNoti.createdBy.name + ' followed up on your post.';
                    let pic_path = '';
                    if (rnNoti.media) {
                        if (rnNoti.media.contentType.startsWith('video/')) {
                            pic_path = SERVER_URL + 'topics/media/' + rnNoti.media._id + '/thumbnail';
                        } else {
                            pic_path = SERVER_URL + 'topics/media/' + rnNoti.media._id + '/1.jpg';
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
            //send created post
            return res.status(201).send(final_post);
        }

        return res.status(404).json({
            message: "No valid entry found for provided topic id"
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
            const mediaUrl = TOPIC_URL + media.mediaUrl;
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
            const mediaUrl = TOPIC_URL + media.mediaUrl;
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
        "match": {
            "description": {
                "query": query,
                "analyzer": "standard"
            }
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
        const searched_posts = await Topic.esSearch({ query: match_query });
        if (searched_posts) {
            //pick only _id field from searched_posts
            const all_posts = _.map(searched_posts.hits.hits, '_id');
            //make sure not to overlap
            const all_posts_uniq = _.uniq(all_posts);
            //paginate posts
            const posts = await Topic.paginate({ _id: { $in: all_posts_uniq }, isPublic: true, isAvailable: true }, options);
            return res.status(200).send(posts);
        }
        return res.status(200).send([]);
    } catch (err) {
        return res.status(500).json({
            error: err
        });
    }
}