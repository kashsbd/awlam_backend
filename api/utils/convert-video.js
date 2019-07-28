const spawn = require('child_process').spawn;
const fluent_ffmpeg = require('fluent-ffmpeg');

const { FFMPEG_PATH, THUMBNAIL_URL } = require('../config/config');

fluent_ffmpeg.setFfmpegPath(FFMPEG_PATH);

exports.resizeVideo = (video, quality, dir_to_save) => {
    const p = new Promise((resolve, reject) => {
        const ffmpeg = spawn(FFMPEG_PATH, ['-i', video, '-codec:v', 'libx264', '-profile:v', 'main', '-preset', 'medium', '-b:v', '400k', '-maxrate', '400k', '-bufsize', '800k', '-vf', `scale=-2:${quality}`, '-threads', '0', '-b:a', '128k', dir_to_save]);
        ffmpeg.stderr.on('data', (data) => {
            //console.log(data);
        });
        ffmpeg.on('close', (code) => {
            resolve('Successfully converted.');
        });
        ffmpeg.on('error', (err) => {
            reject('an error happened: ' + err.message);
        })
    });
    return p;
}

exports.getThumbnail = (video, thumb_name) => {
    const p = new Promise((resolve, reject) => {
        const proc = fluent_ffmpeg(video);
        proc.on('filenames', (filenames) => {
            console.log(filenames);
        });
        proc.on('end', () => {
            resolve('screenshots were saved');
        });
        proc.on('error', (err) => {
            reject('an error happened: ' + err.message);
        });
        // take 1 screenshots at predefined timemarks
        proc.takeScreenshots({ count: 1, timemarks: ['00:00:03.000'], filename: thumb_name }, THUMBNAIL_URL);

    });
    return p;
}

