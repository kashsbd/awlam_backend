exports.streamVideo = function (req, res, filePath) {
    if (!filePath)
        return res.status(404).send();

    fs.stat(filePath, function (err, stats) {
        if (err) {
            if (err.code === 'ENOENT') {
                return res.status(404).send();
            }
        }

        var start;
        var end;
        var total = 0;
        var contentRange = false;
        var contentLength = 0;

        var range = req.headers.range;
        if (range) {
            var positions = range.replace(/bytes=/, "").split("-");
            start = parseInt(positions[0], 10);
            total = stats.size;
            end = positions[1] ? parseInt(positions[1], 10) : total - 1;
            var chunksize = (end - start) + 1;
            contentRange = true;
            contentLength = chunksize;
        }
        else {
            start = 0;
            end = stats.size;
            contentLength = stats.size;
        }

        if (start <= end) {
            var responseCode = 200;
            var responseHeader =
            {
                "Accept-Ranges": "bytes",
                "Content-Length": contentLength,
                "Content-Type": "video/mp4"
            };
            if (contentRange) {
                responseCode = 206;
                responseHeader["Content-Range"] = "bytes " + start + "-" + end + "/" + total;
            }
            res.writeHead(responseCode, responseHeader);

            var stream = fs.createReadStream(file, { start: start, end: end })
                .on("readable", function () {
                    var chunk;
                    while (null !== (chunk = stream.read(1024))) {
                        res.write(chunk);
                    }
                }).on("error", function (err) {
                    res.end(err);
                }).on("end", function (err) {
                    res.end();
                });
        }
        else {
            return res.status(403).send();
        }
    });
};