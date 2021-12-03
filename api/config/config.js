const os = require('os');

const local_mongo_path = 'mongodb://127.0.0.1:3500/Awlam';

const MONGO_PATH = local_mongo_path;

const local = 'http://192.168.1.2:3000/';

const server = 'http://172.104.33.119:3000/';

const SERVER_URL = local;

const JWT_KEY = 'secure_marter_key';

const ONE_SIGNAL_USER_AUTH_KEY = 'MjczNjgyNzgtNmExNi00ODFkLWFkMjMtNjA0MzcyZjkzOTA2';

const ONE_SIGNAL_REST_KEY = 'NzQ3YzA5MWQtYTg1Ny00NTUzLWE5MzMtNTg2YTU5MWUxZGE3';

const ONE_SIGNAL_APP_ID = '94c2b2eb-f114-45ec-835a-f0c03b45e894';

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
    TOPIC_URL,
    EVENT_URL,
    GOVERNMENT_URL
};