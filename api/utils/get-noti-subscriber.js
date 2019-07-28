exports.getNotiSubscriber = (noti_socket) => {
    let data = [];
    //all socket ids who subscribe to /all_noties
    const all_noti_clients = Object.keys(noti_socket.connected);
    for (let each_socket_id of all_noti_clients) {
        //get socket obj from socket id
        const each_noti_socket = noti_socket.connected[each_socket_id];
        //get user id from socket.io query
        const user_id = each_noti_socket.handshake.query.userId;
        data.push({ each_noti_socket, user_id });
    }
    return data;
}