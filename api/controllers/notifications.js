const mongoose = require('mongoose');

const Notification = require("../models/notification");

exports.notify_saved = async (req, res, next) => {
    const notiId = req.params.notiId;

    const noti = await Notification.findById(notiId);

    if (noti) {
        noti.isSavedInClient = true;
        await noti.save();

        return res.status(200).json({
            message: 'OK.'
        });
    }

    return res.status(404).json({
        message: 'No valid entry found for provided user id.'
    })
}