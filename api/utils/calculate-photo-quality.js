const pretty = require('prettysize');

exports.getPhotoQuality = (size_in_bytes = 0) => {

    if (size_in_bytes === 0) {
        return 80;
    }

    const data = pretty(size_in_bytes, false).split(' ');

    if (data[1] === 'MB') {
        // if photo size is greater than 2 MB, the quality size is 17
        const q = data[0] > 2.0 ? 17 : 40;
        return q;
    } else if (data[1] === 'kB') {
        // if photo size is greater than 500 KB, the quality size is 20
        const q = data[0] > 500.0 ? 20 : 40;
        return q;
    }
}