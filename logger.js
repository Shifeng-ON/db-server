
var config = require("./config.js");
module.exports = {
    log: (typeProcess, message) => {
        if (message != undefined) {
            for (var piece of message.split('\n')) {
                if (piece.length > 0) {
                    console.log(JSON.stringify({'Severity': "Info", 'Process type': typeProcess, 'Log': piece,  'TimeStamp': (new Date()).toISOString() }))
                }
            }
        }


    },
    error: (typeProcess, message) => {
        if (message != undefined) {
            for (var piece of message.split('\n')) {
                if (piece.length > 0) {
                    console.error(JSON.stringify({ 'Severity': "Error", 'Process type': typeProcess, 'Log': piece, 'TimeStamp': (new Date()).toISOString() }))
                }
            }
        }

    },
    debug: (typeProcess, message) => {
        if ( config.server.debug && message != undefined) {
            for (var piece of message.split('\n')) {
                if (piece.length > 0) {
                    console.error(JSON.stringify({'Severity': "Debug", 'Process type': typeProcess, 'Log': piece,  'TimeStamp': (new Date()).toISOString() }))
                }
            }
        }

    }
}



