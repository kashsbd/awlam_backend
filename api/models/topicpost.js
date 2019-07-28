const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate');
const Schema = mongoose.Schema;

const Topic = require('./topic');
const User = require('./user');
const Media = require('./media');
const Comment = require('./comment');

const topicpostSchema = new Schema(
    {
        _id: Schema.Types.ObjectId,
        post_owner: { type: Schema.Types.ObjectId, ref: 'Topic' },
        isAvailable: { type: Boolean, default: true }, // is available to users or not
        isPublic: { type: Boolean, default: true },
        user: { type: Schema.Types.ObjectId, ref: 'User' },
        media: [{ type: Schema.Types.ObjectId, ref: 'Media' }],
        location: { name: String, address: String, lat: String, lon: String },
        description: String,
        likes: [{ type: Schema.Types.ObjectId, ref: 'User' }],
        dislikes: [{ type: Schema.Types.ObjectId, ref: 'User' }],
        comments: [{ type: Schema.Types.ObjectId, ref: 'Comment' }],
    },
    {
        timestamps: true,
    }
);

topicpostSchema.plugin(mongoosePaginate);
module.exports = mongoose.model('TopicPost', topicpostSchema);