const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate');
// const mexp = require('mongoose-elasticsearch-xp');
const Schema = mongoose.Schema;

const userSchema = new Schema(
    {
        _id: Schema.Types.ObjectId,
        //crendential info
        email: {
            type: String,
            required: true,
            unique: true,
            match: /[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?/
        },
        password: {
            type: String,
            required: true
        },
        //detail info
        // name: {
        //     type: String,
        //     required: [true, 'User name is required.'],
        //     es_indexed: true,
        //     es_boost: 2.0
        // },
        name: {
            type: String,
            required: [true, 'User name is required.']
        },
        country: String,
        city: String,
        job: String,
        dob: String,
        phno: String,
        gender: String,
        description: String,
        //profile pic info
        profile: { type: Schema.Types.ObjectId, ref: 'Media' },
        //external info
        playerIds: [{ playerId: String, status: String }], // ids of one-signal
        isUserActive: { type: Boolean, default: true }, // to check if this account exists or not
        //
        followerLists: [{ type: Schema.Types.ObjectId, ref: 'User' }],
        followingLists: [{ type: Schema.Types.ObjectId, ref: 'User' }],
        notiLists: [{ type: Schema.Types.ObjectId, ref: 'Notification' }],
        favourites: [{ date: Date, type: String, id: String }],
        role: { type: String, default: 'NORMAL' },
        createdBy: { type: Schema.Types.ObjectId, ref: 'User' }
    },
    {
        timestamps: true
    }
);

userSchema.plugin(mongoosePaginate);
// userSchema.plugin(mexp);

let User = mongoose.model('User', userSchema);

// User
//     .esCreateMapping({
//         "settings": {
//             "number_of_shards": 1,
//             "analysis": {
//                 "filter": {
//                     "autocomplete_filter": {
//                         "type": "edge_ngram",
//                         "min_gram": 1,
//                         "max_gram": 15
//                     }
//                 },
//                 "analyzer": {
//                     "autocomplete": {
//                         "type": "custom",
//                         "tokenizer": "standard",
//                         "filter": [
//                             "lowercase",
//                             "autocomplete_filter"
//                         ]
//                     }
//                 }
//             }
//         },
//         "mappings": {
//             "user": {
//                 "properties": {
//                     "name": {
//                         "type": "text",
//                         "analyzer": "autocomplete",
//                         "search_analyzer": "autocomplete"
//                     },
//                 }
//             }
//         }
//     })
//     .then(mappings => console.log('user mapping done.'))
//     .catch(err => console.log('error creating mapping (you can safely ignore this)'));

module.exports = User;
