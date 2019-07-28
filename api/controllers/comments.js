const mongoose = require("mongoose");

const Comment = require("../models/comment");

exports.like_comment = async (req, res, next) => {
    const cmtId = req.params.cmtId;
    const userId = req.body.userId;

    try {
        const cmt = await Comment.findById(cmtId);
        if (cmt) {
            const liker = new mongoose.Types.ObjectId(userId);
            if (cmt.likes.indexOf(liker) == -1) {
                cmt.likes.push(liker);
                const rnCmt = await cmt.save();

                return res.status(200).json(
                    {
                        message: "Successfully liked !",
                    }
                );

            } else {
                return res.status(409).json(
                    {
                        message: "You have already liked this comment !"
                    }
                );
            }
        } else {
            return res.status(404).json(
                {
                    message: "No valid entry found for provided comment id"
                }
            );
        }
    } catch (error) {
        return res.status(500).send(error);
    }
}

exports.unlike_comment = async (req, res, next) => {
    const cmtId = req.params.cmtId;
    const userId = req.body.userId;

    try {
        const cmt = await Comment.findById(cmtId);
        if (cmt) {
            const unliker = new mongoose.Types.ObjectId(userId);
            const index = cmt.likes.indexOf(unliker);
            if (index >= 0) {
                cmt.likes.splice(index, 1);
                const rnCmt = await cmt.save();

                return res.status(200).json(
                    {
                        message: "Successfully unliked !",
                    }
                );
            } else {
                return res.status(404).json(
                    {
                        message: "You have not liked this comment !"
                    }
                );
            }
        } else {
            return res.status(404).json(
                {
                    message: "No valid entry found for provided comment id"
                }
            );
        }
    } catch (error) {
        return res.status(500).send(error);
    }
}


exports.get_replies = async (req, res, next) => {
    const cmtId = req.params.cmtId;
    const page = req.query.page || 1;

    try {

        const options = {
            sort: { createdAt: 1 },
            select: '-__v ',
            populate: [
                { path: 'commentor', select: 'name role' }
            ],
            page: page
        };

        const rnReplies = await Comment.paginate({ cmt_owner: cmtId }, options);

        return res.status(200).send(rnReplies);

    } catch (err) {
        return res.status(500).send(err);
    }
}

exports.reply_to_comment = async (req, res, next) => {

    const {
        type,
        cmt_owner,
        commentor,
        comment_type,
        message,
        mentions
    } = req.body;

    const cmtId = req.params.cmtId;

    //create new comment object
    const newCmt = new Comment(
        {
            _id: new mongoose.Types.ObjectId(),
            type,
            cmt_owner,
            commentor,
            comment_type,
            message
        }
    );
    newCmt.mentions = mentions;

    try {
        const rnCmt = await newCmt.save();

        const comment = await Comment.findById(cmtId);

        if (comment) {
            comment.replies.push(rnCmt._id);
            const newCmt = await comment.save();
        } else {
            return res.status(404).json(
                {
                    message: "No valid entry found for provided comment id"
                }
            );
        }

        const cmt = await Comment.findById(rnCmt._id)
            .populate('commentor', 'name role')
            .exec();

        return res.status(201).send(cmt);

    } catch (err) {
        return res.status(500).send(err);
    }
}