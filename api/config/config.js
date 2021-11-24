const os = require('os');

const local_mongo_path = 'mongodb://localhost:27017/Awlam';

const ELASTIC_HOST = 'localhost:9200';

const MONGO_PATH = local_mongo_path;

const local = 'http://192.168.1.2:3000/';

const server = 'https://api.awlam.com/';

const SERVER_URL = local;

const JWT_KEY = 'secure_marter_key';

const ONE_SIGNAL_USER_AUTH_KEY = 'ZjhhODAyMGEtOWU5ZC00N2JhLWIyY2MtM2VkZjY5OWJhYzlj';

const ONE_SIGNAL_REST_KEY = 'YTk4ZmZiNGUtZjBkYy00ZWYzLThlYTctOTMyNTY4Zjk2MWM5';

const ONE_SIGNAL_APP_ID = 'd92f7cdb-f715-430b-8fe0-3dc1b900f863';

const FFMPEG_PATH = os.homedir() + '/ffmpeg/ffmpeg';

const BASE_PATH = os.homedir() + '/Awlam/Upload/';

const FEED_PIC_URL = BASE_PATH + 'FeedPics/';

const CITIZEN_PIC_URL = BASE_PATH + 'CitizenPics/';

const THUMBNAIL_URL = BASE_PATH + 'Thumbnails/';

const PROPIC_URL = BASE_PATH + 'UserProPics/';

const TOPIC_URL = BASE_PATH + 'TopicPics/';

const EVENT_URL = BASE_PATH + 'EventPics/';

const GOVERNMENT_URL = BASE_PATH + 'GovernmentPics/';

module.exports = {
    MONGO_PATH,
    SERVER_URL,
    JWT_KEY,
    ONE_SIGNAL_APP_ID,
    ONE_SIGNAL_REST_KEY,
    ONE_SIGNAL_USER_AUTH_KEY,
    FFMPEG_PATH,
    FEED_PIC_URL,
    THUMBNAIL_URL,
    PROPIC_URL,
    CITIZEN_PIC_URL,
    ELASTIC_HOST,
    TOPIC_URL,
    EVENT_URL,
    GOVERNMENT_URL
};