const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate');
const mexp = require('mongoose-elasticsearch-xp');
const Schema = mongoose.Schema;

const User = require('./user');
const Media = require('./media');
const Comment = require('./comment');

const postSchema = new Schema(
    {
        _id: { type: Schema.Types.ObjectId },
        postType: String,//may be one of PUBLIC,ONLY_ME,FOLLOWER
        postOwnerType: String,
        user: { type: Schema.Types.ObjectId, ref: 'User' },
        isAvailable: { type: Boolean, default: true }, // is available to users or not
        //for status
        status_type: String,// may be one of GIF,TEXT,STICKER,..
        status_media_name: { type: String, default: null },// name of Gif or Sticker
        status: { type: String, es_indexed: true, es_boost: 2.0 },
        //for hashtag
        hashTags: {
            type: [String],
            es_indexed: true,
            es_boost: 2.0
        },
        media: [{ type: Schema.Types.ObjectId, ref: 'Media' }],
        likes: [{ type: Schema.Types.ObjectId, ref: 'User' }],
        dislikes: [{ type: Schema.Types.ObjectId, ref: 'User' }],
        comments: [{ type: Schema.Types.ObjectId, ref: 'Comment' }],
    },
    {
        timestamps: true,
    }
);

postSchema.plugin(mongoosePaginate);
postSchema.plugin(mexp);

let Post = mongoose.model('Post', postSchema);

Post
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
            "post": {
                "properties": {
                    "status": {
                        "type": "text",
                        "analyzer": "autocomplete",
                        "search_analyzer": "autocomplete"
                    },
                    "hashTags": {
                        "type": "text",
                        "analyzer": "autocomplete",
                        "search_analyzer": "autocomplete"
                    }
                }
            }
        }
    })
    .then(mappings => console.log('post mapping done.'))
    .catch(err => console.log('error creating post mapping (you can safely ignore this)'));

module.exports = Post;
