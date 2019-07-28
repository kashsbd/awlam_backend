const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate');
const mexp = require('mongoose-elasticsearch-xp');
const Schema = mongoose.Schema;

const User = require('./user');
const Media = require('./media');
const Comment = require('./comment');

const topicSchema = new Schema(
    {
        _id: Schema.Types.ObjectId,
        isAvailable: { type: Boolean, default: true }, // is available to users or not
        isPublic: { type: Boolean, default: true },// public or private
        user: { type: Schema.Types.ObjectId, ref: 'User' },
        media: [{ type: Schema.Types.ObjectId, ref: 'Media' }],
        description: { type: String, es_indexed: true, es_boost: 2.0 },
        likes: [{ type: Schema.Types.ObjectId, ref: 'User' }],
        dislikes: [{ type: Schema.Types.ObjectId, ref: 'User' }],
        comments: [{ type: Schema.Types.ObjectId, ref: 'Comment' }],
        permitted_users: [{ type: Schema.Types.ObjectId, ref: 'User' }], //if the post is private, post owner can set whome to show 
        subscribed_users: [{ type: Schema.Types.ObjectId, ref: 'User' }]
    },
    {
        timestamps: true,
    }
);

topicSchema.plugin(mongoosePaginate);
topicSchema.plugin(mexp);

let Topic = mongoose.model('Topic', topicSchema);

Topic
    .esCreateMapping({
        "settings": {
            "number_of_shards": 1,
            "analysis": {
                "filter": {
                    "autocomplete_filter": {
                        "type": "edge_ngram",
                        "min_gram": 1,
                        "max_gram": 15
                    }
                },
                "analyzer": {
                    "autocomplete": {
                        "type": "custom",
                        "tokenizer": "standard",
                        "filter": [
                            "lowercase",
                            "autocomplete_filter"
                        ]
                    }
                }
            }
        },
        "mappings": {
            "topic": {
                "properties": {
                    "description": {
                        "type": "text",
                        "analyzer": "autocomplete",
                        "search_analyzer": "autocomplete"
                    }
                }
            }
        }
    })
    .then(mappings => console.log('topic mapping done.'))
    .catch(err => console.log('error creating mapping (you can safely ignore this)'));

module.exports = Topic;