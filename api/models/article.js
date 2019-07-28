const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const articleSchema = new Schema(
    {
        _id: Schema.Types.ObjectId,
        user: { type: Schema.Types.ObjectId, ref: 'User' },
        isAvailable: { type: Boolean, default: true }, // is available to users or not
        title: String,
        description: String,
        media: { type: Schema.Types.ObjectId, ref: 'Media' },
        likes: [{ type: Schema.Types.ObjectId, ref: 'User' }],
        comments: [{ type: Schema.Types.ObjectId, ref: 'Comment' }],
    },
    {
        timestamps: true
    }
)

module.exports = mongoose.model('Status', articleSchema);