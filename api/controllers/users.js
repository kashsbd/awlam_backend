const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const sharp = require('sharp');
const _ = require('lodash');
const readFilePromise = require('fs-readfile-promise');

const { JWT_KEY, PROPIC_URL } = require('../config/config');

const User = require("../models/user");
const Media = require("../models/media");
const Notification = require("../models/notification");
const Post = require("../models/post");

exports.test = (req, res, next) => {
    res.status(200).json({
        message: 'Hello World!'
    });
}

exports.create_new_user = async (req, res, next) => {
    const propic_file = req.file;
    const users = await User.find({ email: req.body.email }).exec();

    if (users && users.length >= 1) {
        return res.status(409).json({
            message: "Mail exists"
        });
    } else {
        // init user model 
        const user = new User(
            {
                _id: new mongoose.Types.ObjectId(),
                email: req.body.email,
                password: req.body.password,
                name: req.body.name,
                role: req.body.role,
                createdBy: req.body.userId
            }
        );

        //check propic_file is not falsely 
        if (propic_file) {
            //init media model
            const media_model = new Media(
                {
                    _id: new mongoose.Types.ObjectId(),
                    type: 'PROFILE'
                }
            );
            //get metadata of propic
            const pic = await sharp(propic_file.path).metadata();
            //get image metadata 
            media_model.width = pic.width;
            media_model.height = pic.height;
            media_model.contentType = propic_file.mimetype;
            media_model.mediaUrl = propic_file.filename;

            //finally save media model and push media id to user model
            const rnMedia = await media_model.save();
            user.profile = rnMedia._id;
        }

        try {
            await user.save();

            return res.status(201).json({
                message: 'OK'
            });

        } catch (err) {
            return res.status(500).json({
                error: err
            })
        }
    }
}

exports.user_signup = async (req, res, next) => {
    const propic_file = req.file;
    const users = await User.find({ email: req.body.email }).exec();

    if (users && users.length >= 1) {
        return res.status(409).json({
            message: "Mail exists"
        });
    } else {
        // init user model 
        const user = new User(
            {
                _id: new mongoose.Types.ObjectId(),
                email: req.body.email,
                password: req.body.password,
                name: req.body.name,
                role: req.body.role,
                playerIds: [{ playerId: req.body.playerId, status: 'active' }]
            }
        );

        //check propic_file is not falsely 
        if (propic_file) {
            //init media model
            const media_model = new Media(
                {
                    _id: new mongoose.Types.ObjectId(),
                    type: 'PROFILE'
                }
            );
            //get metadata of propic
            const pic = await sharp(propic_file.path).metadata();
            //get image metadata 
            media_model.width = pic.width;
            media_model.height = pic.height;
            media_model.contentType = propic_file.mimetype;
            media_model.mediaUrl = propic_file.filename;

            //finally save media model and push media id to user model
            const rnMedia = await media_model.save();
            user.profile = rnMedia._id;
        }

        try {
            const result = await user.save();
            //generate token for new user
            const token = jwt.sign(
                {
                    email: result.email,
                    userId: result._id
                },
                JWT_KEY
            );

            return res.status(201).json({
                token: token,
                userId: result._id,
                role: result.role
            });
        } catch (err) {
            return res.status(500).json({
                error: err
            })
        }
    }
}

exports.user_login = async (req, res, next) => {
    const playerId = req.body.playerId;

    try {
        let users = await User.find({ email: req.body.email, password: req.body.password }).exec();

        if (users && users.length < 1) {
            return res.status(401).json({
                message: "Auth failed"
            });
        }

        //check playerId not to duplicate
        let ids = Object.assign([], users[0].playerIds);
        const index = _.findIndex(ids, { playerId });
        if (index > -1) {
            ids[index] = { playerId, status: 'active' };
        } else {
            ids.push({ playerId, status: 'active' });
        }

        users[0].playerIds = ids;

        await users[0].save();


        // generate token for logged user
        const token = jwt.sign(
            {
                email: users[0].email,
                userId: users[0]._id
            },
            JWT_KEY
        );

        return res.status(200).json(
            {
                token: token,
                userName: users[0].name,
                userId: users[0]._id,
                role: users[0].role
            }
        );

    } catch (err) {
        res.status(500).json({
            error: err
        });
    }
}

exports.user_logout = async (req, res, next) => {
    const userId = req.params.userId;
    const playerId = req.body.playerId;

    try {
        let user = await User.findById(userId);
        if (user) {
            let playerIds = Object.assign([], user.playerIds);
            const index = _.findIndex(playerIds, { playerId });
            if (index !== -1) {
                playerIds.splice(index, 1);
                //set new playerIds
                user.playerIds = playerIds;
            }

            //finally save user model
            await user.save();

            return res.status(200).json({
                message: 'User is logged out !'
            });
        } else {
            return res.status(404).json({
                message: "No valid entry found for provided user id"
            });
        }
    } catch (err) {
        return res.status(500).json({
            error: err
        });
    }
}


exports.get_profile_pic = async (req, res, next) => {
    const userId = req.params.userId;

    try {
        const user = await User.findById(userId);
        if (user) {
            try {
                const propic = await Media.findById(user.profile);
                if (propic) {
                    const propicUrl = PROPIC_URL + propic.mediaUrl;
                    try {
                        const file = await readFilePromise(propicUrl);
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
                return res.status(404).json({
                    message: 'No such file'
                });
            }
        }
    } catch (err) {
        return res.status(500).json({
            error: err
        });
    }
}

exports.follow_user = async (req, res, next) => {
    const userId = req.params.userId;
    const { followerId } = req.body;

    try {
        let user = await User.findById(userId);
        if (user) {
            const follower_id = new mongoose.Types.ObjectId(followerId);
            const user_index = user.followerLists.indexOf(follower_id);

            //if we could not find , we will add to followerLists
            if (user_index === -1) {
                user.followerLists.push(followerId);
                const rnUser = await user.save();
            }

            let follower = await User.findById(followerId);
            if (follower) {
                const user_id = new mongoose.Types.ObjectId(userId);
                const follower_index = follower.followingLists.indexOf(user_id);

                //if we could not find , we will add to followingLists
                if (follower_index === -1) {
                    follower.followingLists.push(userId);
                    const rnFollower = await follower.save();
                }
            }

            return res.status(200).json({
                message: 'OK'
            });
        }
        return res.status(404).json({
            message: 'No valid entry found for provided user id.'
        });
    } catch (err) {
        return res.status(500).json({
            error: err
        });
    }

}

exports.unfollow_user = async (req, res, next) => {
    const userId = req.params.userId;
    const { followerId } = req.body;

    try {
        let user = await User.findById(userId);

        if (user) {
            const follower_id = new mongoose.Types.ObjectId(followerId);
            const index = user.followerLists.indexOf(follower_id);
            //we will remove followerId if we found it in followerLists
            if (index >= 0) {
                user.followerLists.splice(index, 1);
                const rnUser = await user.save();
            }

            let follower = await User.findById(followerId);

            if (follower) {
                const user_id = new mongoose.Types.ObjectId(userId);
                const follower_index = follower.followingLists.indexOf(user_id);
                //we will remove followerId if we found it in followingLists
                if (follower_index >= 0) {
                    follower.followingLists.splice(follower_index, 1);
                    const rnFollower = await follower.save();
                }
            }

            return res.status(200).json({
                message: 'OK'
            });
        }
        return res.status(404).json({
            message: 'No valid entry found for provided user id.'
        });
    } catch (err) {
        return res.status(500).json({
            error: err
        });
    }
}

exports.get_unsaved_notis = async (req, res, next) => {
    const userId = req.params.userId;
    const user = await User.findById(userId);
    const MAX_NOTI_COUNT = 10;
    let count = 0;
    let all_notis = [];

    if (user) {
        const notis = user.notiLists;
        for (let i = notis.length; i--;) {
            const myNoti = await Notification.find({ _id: notis[i], isSavedInClient: false })
                .populate('createdBy', 'name role')
                .populate('media', 'contentType')
                .exec();

            if (myNoti && myNoti[0]) {
                all_notis.push(myNoti[0]);
            }

            if (count === MAX_NOTI_COUNT) break;
            count++;
        }

        return res.status(200).send(all_notis);
    }

    return res.status(404).json({
        message: 'No valid user found for provided user id.'
    })
}

exports.notify_state_change = async (req, res, next) => {
    const userId = req.params.userId;
    const { playerId, status } = req.body;

    // console.log(playerId + ' is  on ' + status + ' state');

    let user = await User.findById(userId);
    if (user) {
        let playerIds = Object.assign([], user.playerIds);
        const index = _.findIndex(playerIds, { playerId });
        if (index > -1) {
            playerIds[index] = { playerId, status };
            user.playerIds = playerIds;
            await user.save();

            return res.status(200).json({
                message: 'OK'
            });
        }

        return res.status(200).json({
            message: 'OK'
        });
    }

    return res.status(404).json({
        message: 'No valid user found for provided user id.'
    });
}

//get all posts by userId
exports.get_all_posts = async (req, res, next) => {
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

    const user = await User.findById(userId);

    if (user) {
        let user_data = {
            name: user.name,
            role: user.role,
            followers: user.followerLists,
            followings: user.followingLists
        };

        final_data['user'] = user_data;
    }

    try {
        const posts = await Post.paginate({ isAvailable: true, user: userId }, options);
        final_data['posts'] = posts;
        return res.status(200).send(final_data);
    } catch (error) {
        return res.status(500).send(error);
    }
}

exports.get_all_followers = async (req, res, next) => {
    const userId = req.params.userId;
    const visitor_id = req.body.visitorId;
    let datas = [];

    const visitorId = new mongoose.Types.ObjectId(visitor_id);

    try {
        const user = await User.findById(userId);

        if (user) {
            let followerLists = user.followerLists;
            for (let i = 0, len = followerLists.length; i < len; i++) {
                const eachUser = await User.findById(followerLists[i]);
                if (eachUser) {
                    if (String(eachUser._id) === visitor_id) {
                        datas.push({ userId: eachUser._id, status: 'You', name: eachUser.name });
                    } else if (eachUser.followerLists.indexOf(visitorId) !== -1) {
                        datas.push({ userId: eachUser._id, status: 'Unfollow', name: eachUser.name });
                    } else if (eachUser.followerLists.indexOf(visitorId) === -1) {
                        datas.push({ userId: eachUser._id, status: 'Follow', name: eachUser.name });
                    }
                }
            }

            return res.status(200).json({
                datas
            });
        }

        return res.status(404).json({
            message: 'No valid entry found for provided user id.'
        });

    } catch (err) {
        return res.status(500).send(err);
    }
}

exports.get_all_followings = async (req, res, next) => {
    const userId = req.params.userId;
    const visitor_id = req.body.visitorId;
    let datas = [];

    const visitorId = new mongoose.Types.ObjectId(visitor_id);

    try {
        const user = await User.findById(userId);

        if (user) {
            let followingLists = user.followingLists;

            for (let i = 0, len = followingLists.length; i < len; i++) {
                const eachUser = await User.findById(followingLists[i]);
                if (eachUser) {
                    if (String(eachUser._id) === visitor_id) {
                        datas.push({ userId: eachUser._id, status: 'You', name: eachUser.name });
                    } else if (eachUser.followerLists.indexOf(visitorId) !== -1) {
                        datas.push({ userId: eachUser._id, status: 'Unfollow', name: eachUser.name });
                    } else if (eachUser.followerLists.indexOf(visitorId) === -1) {
                        datas.push({ userId: eachUser._id, status: 'Follow', name: eachUser.name });
                    }
                }
            }

            return res.status(200).json(
                {
                    datas
                }
            );
        }

        return res.status(404).json({
            message: 'No valid entry found for provided user id'
        });

    } catch (err) {
        return res.status(500).send(err);
    }
}

exports.get_all_followers_and_followings = async (req, res, next) => {
    const userId = req.params.userId;
    const page = req.query.page || 1;

    const options = {
        select: '-__v -email -password -country -city -job -dob -phno -description -profile -playerIds -notiLists -favourites ',
        page: page
    };

    try {
        const user = await User.findById(userId);
        if (user) {
            const followerLists = JSON.parse(JSON.stringify(user.followerLists));
            const followingLists = JSON.parse(JSON.stringify(user.followingLists));

            let temp_users = [...followerLists, ...followingLists];
            let temp_users_uniq = _.uniq(temp_users);

            const users = await User.paginate({ _id: { $in: temp_users_uniq }, isUserActive: true }, options);
            return res.status(200).send(users);
        }

        return res.status(404).json({
            message: 'No valid entry found for provided user id'
        });
    } catch (err) {
        return res.status(500).json({
            error: err
        });
    }
}

exports.get_all_suggestions = async (req, res, next) => {
    const userId = req.params.userId;
    const page = req.query.page || 1;
    let all_users = [];

    const options = {
        select: '-__v -email -password -country -city -job -dob -phno -description -profile -playerIds -notiLists -favourites ',
        page: page
    };

    const options_two = {
        sort: { followerLists: -1 },
        select: '-__v -email -password -country -city -job -dob -phno -description -profile -playerIds -notiLists -favourites ',
        page: page
    }

    try {
        const user = await User.findById(userId);

        if (user) {
            const followerLists = JSON.parse(JSON.stringify(user.followerLists));
            const followingLists = JSON.parse(JSON.stringify(user.followingLists));

            let temp_users = [...followerLists, ...followingLists];
            let temp_users_uniq = _.uniq(temp_users);

            for (let i = 0, len = temp_users_uniq.length; i < len; i++) {
                const eachUser = await User.findById(temp_users_uniq[i]);

                if (eachUser) {
                    all_users = [...all_users, ...eachUser.followerLists, ...eachUser.followingLists];
                }
            }

            all_users = JSON.parse(JSON.stringify(all_users));
            //remove all duplicates from all_users_uniq array
            let all_users_uniq = _.uniq(all_users);

            //if length is >= 20 ,we will paginate and show to users
            //if not, we will paginate and show most followed users
            if (all_users_uniq.length >= 20) {
                const users = await User.paginate({ _id: { $in: all_users_uniq }, isUserActive: true }, options);
                return res.status(200).send(users);
            } else {
                const popular_users = await User.paginate({ _id: { $nin: [...followingLists, userId] }, isUserActive: true }, options_two);
                return res.status(200).send(popular_users);
            }
        }

        return res.status(404).json({
            message: 'No valid entry found for provided user id'
        });

    } catch (err) {
        return res.status(500).json({
            error: err
        });
    }
}

exports.search = async (req, res, next) => {
    const query = req.query.query;
    const page = req.query.page || 1;

    const match_query = {
        "match": {
            "name": {
                "query": query,
                "analyzer": "standard"
            }
        }
    };

    const options = {
        select: '-__v -email -password -country -city -job -dob -phno -description -profile -playerIds -notiLists -favourites ',
        page: page
    };

    try {
        const searched_users = await User.esSearch({ query: match_query }, { hydrate: true });
        if (searched_users) {
            //pick only _id field from searched_users
            const all_users = _.map(searched_users.hits.hits, '_id');
            //make sure not to overlap
            const all_users_uniq = _.uniq(all_users);
            //paginate users
            const users = await User.paginate({ _id: { $in: all_users_uniq }, isUserActive: true }, options);
            return res.status(200).send(users);
        }
        return res.status(200).send([]);
    } catch (err) {
        return res.status(500).json({
            error: err
        });
    }
}

exports.search_name_of_user = async (req, res, next) => {
    const userId = req.params.userId;
    const query = req.query.query;

    const isQueryEmpty = query.trim().length === 0;

    let users = [];

    try {
        const user = await User.findById(userId);
        if (user) {
            const followerLists = JSON.parse(JSON.stringify(user.followerLists));
            const followingLists = JSON.parse(JSON.stringify(user.followingLists));

            let temp_users = [...followerLists, ...followingLists];
            let temp_users_uniq = _.uniq(temp_users);

            if (isQueryEmpty) {
                users = await User.find({ _id: { $in: temp_users_uniq }, isUserActive: true });
            } else {
                users = await User.find({ _id: { $in: temp_users_uniq }, isUserActive: true, name: { '$regex': query, '$options': 'i' } });
            }

            return res.status(200).send(users);
        }

        return res.status(404).json({
            message: 'No valid entry found for provided user id'
        });

    } catch (err) {
        return res.status(500).json({
            error: err
        });
    }
}

