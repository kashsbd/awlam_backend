const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate');
const Schema = mongoose.Schema;

const User = require('./user');
const Media = require('./media');
const Comment = require('./comment');

const citizenSchema = new Schema(
    {
        _id: Schema.Types.ObjectId,
        isAvailable: { type: Boolean, default: true }, // is available to users or not
        isPublic: { type: Boolean, default: true },
        user: { type: Schema.Types.ObjectId, ref: 'User' },
        media: [{ type: Schema.Types.ObjectId, ref: 'Media' }],
        location: { name: String, address: String, lat: String, lon: String },
        description: String,
        likes: [{ type: Schema.Types.ObjectId, ref: 'User' }],
        dislikes: [{ type: Schema.Types.ObjectId, ref: 'User' }],
        comments: [{ type: Schema.Types.ObjectId, ref: 'Comment' }],
        isApproved: { type: Boolean, default: false },
        approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
        approvedDate: Date
    },
    {
        timestamps: true,
    }
);

citizenSchema.plugin(mongoosePaginate);
module.exports = mongoose.model('Citizen', citizenSchema);