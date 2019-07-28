const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const mediaSchema = new Schema(
    {
        _id: Schema.Types.ObjectId,
        type: String, // may be one of PROFILE,POST,ARTICLE
        width: Number,
        height: Number,
        mediaUrl: String,
        thumbnailUrl: String,
        contentType: String
    },
    {
        timestamps: true
    }
)


module.exports = mongoose.model('Media', mediaSchema);