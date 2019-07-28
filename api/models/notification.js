const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const notiSchema = new Schema(
    {
        _id: Schema.Types.ObjectId,
        createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
        type: String, // CREATE-POST,LIKE-POST,COMMENT-POST,FOLLOW-USER
        media: { type: Schema.Types.ObjectId, ref: 'Media' },
        dataId: String,
        isSavedInClient: { type: Boolean, default: false }
    },
    {
        timestamps: true
    }
)

module.exports = mongoose.model('Notification', notiSchema);