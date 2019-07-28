const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate');
const Schema = mongoose.Schema;

const commentSchema = new Schema(
    {
        _id: Schema.Types.ObjectId,
        type: String, // may be one of POST,ARTICLE,EVENT
        cmt_owner: String,
        commentor: { type: Schema.Types.ObjectId, ref: 'User' },
        comment_type: String, // may be one of TEXT,GIF,STICKER,..
        message: String,
        mentions: [],
        likes: [{ type: Schema.Types.ObjectId, ref: 'User' }],
        replies: [{ type: Schema.Types.ObjectId, ref: 'Comment' }],
    },
    {
        timestamps: true
    }
)

commentSchema.plugin(mongoosePaginate);
module.exports = mongoose.model('Comment', commentSchema);