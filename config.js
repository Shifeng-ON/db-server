module.exports = {
    server:{
        heartbeatInterval: process.env.HEART_BEAT_INTERVAL || 30, // in second, do not go less 
        debug: process.env.DEBUG|| 1 // 1 for enable, 0 for disable
}
}