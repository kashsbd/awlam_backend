const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');
const mongoose = require("mongoose");
const OneSignal = require('onesignal-node');
const elasticsearch = require('elasticsearch');

const config = require('./api/config/config');
const userRouter = require('./api/routes/users');
const postRouter = require('./api/routes/posts');
const citizenRouter = require('./api/routes/citizens');
const topicRouter = require('./api/routes/topics');
const eventRouter = require('./api/routes/events');
const governmentRouter = require('./api/routes/governments');
const commentRouter = require('./api/routes/comments');
const notiRouter = require('./api/routes/notifications');

const webRouter = require('./api/routes/web');

//db config
mongoose.Promise = global.Promise;
mongoose.connect(config.MONGO_PATH, { useNewUrlParser: true, autoIndex: false, useCreateIndex: true, }, (err) => {
    if (err) {
        console.log("Can't connect to db.");
    }
    console.log('Connected to db.')
});

//elasticsearch config
const elastic_client = new elasticsearch.Client({
    host: config.ELASTIC_HOST
});

elastic_client.ping({ requestTimeout: 1000 }, function (error) {
    if (error) {
        console.log('elasticsearch cluster is down!');
    } else {
        console.log('Connected to elasticsearch');
    }
});

// create a new Client for a single app    
const myClient = new OneSignal.Client({
    userAuthKey: config.ONE_SIGNAL_USER_AUTH_KEY,
    // note that "app" must have "appAuthKey" and "appId" keys    
    app: { appAuthKey: config.ONE_SIGNAL_REST_KEY, appId: config.ONE_SIGNAL_APP_ID }
});

let app = express();
let server = require('http').Server(app);
let io = require('socket.io')(server);

const all_posts_socket = io.of('/all_posts').on('connection', () => { });

const likes_socket = io.of('/all_likes').on('connection', () => { });

const follower_posts_socket = io.of('/follower_posts').on('connection', () => { });

const noties_socket = io.of('/all_noties').on('connection', () => { });

app.set('view engine', 'ejs');
app.use(cors());
//put socket io to every response object
app.use((req, res, next) => {
    //for onesignal
    req.onesignal_client = myClient;
    req.io = io;
    //for posts
    req.all_posts_socket = all_posts_socket;
    req.follower_posts_socket = follower_posts_socket;
    //to track likes,dislikes and comments count
    req.likes_socket = likes_socket;
    //for noti
    req.noties_socket = noties_socket;
    next();
});

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

//app routes
app.use('/users', userRouter);
app.use('/posts', postRouter);
app.use('/citizens', citizenRouter);
app.use('/topics', topicRouter);
app.use('/events', eventRouter);
app.use('/governments', governmentRouter);
app.use('/comments', commentRouter);
app.use('/notifications', notiRouter);
app.use('/web', webRouter);

app.use((req, res, next) => {
    const error = new Error("Not found");
    error.status = 404;
    next(error);
});

app.use((error, req, res, next) => {
    res.status(error.status || 500);
    res.json({
        error: {
            message: error.message
        }
    });
});

module.exports = { app, server };