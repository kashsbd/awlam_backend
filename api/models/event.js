const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate');
const mexp = require('mongoose-elasticsearch-xp');
const Schema = mongoose.Schema;

const User = require('./user');
const Media = require('./media');

const eventSchema = new Schema(
    {
        _id: Schema.Types.ObjectId,
        isAvailable: { type: Boolean, default: true }, // is available to users or not
        isPublic: { type: Boolean, default: true },
        user: { type: Schema.Types.ObjectId, ref: 'User' },
        media: [{ type: Schema.Types.ObjectId, ref: 'Media' }],
        location: { name: String, address: String, lat: String, lon: String },
        event_name: { type: String, es_indexed: true, es_boost: 2.0 },
        description: { type: String, es_indexed: true, es_boost: 2.0 },
        start_date_time: Date,
        end_date_time: Date,
        invited_users: [{ type: Schema.Types.ObjectId, ref: 'User' }],
        interested: [{ type: Schema.Types.ObjectId, ref: 'User' }],
        going: [{ type: Schema.Types.ObjectId, ref: 'User' }]
    },
    {
        timestamps: true,
    }
);

eventSchema.plugin(mongoosePaginate);
eventSchema.plugin(mexp);

let Event = mongoose.model('Event', eventSchema);

Event
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
            "event": {
                "properties": {
                    "description": {
                        "type": "text",
                        "analyzer": "autocomplete",
                        "search_analyzer": "autocomplete"
                    },
                    "event_name": {
                        "type": "text",
                        "analyzer": "autocomplete",
                        "search_analyzer": "autocomplete"
                    }
                }
            }
        }
    })
    .then(mappings => console.log('event mapping done.'))
    .catch(err => console.log('error creating event mapping (you can safely ignore this)'));

module.exports = Event;
