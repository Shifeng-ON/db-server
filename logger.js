

module.exports = {
    log: (typeProcess, message) => {
        if (message != undefined) {
            for (var piece of message.split('\n')) {
                if (piece.length > 0) {
                    console.log(JSON.stringify({ 'Process type': typeProcess, 'Log': piece, 'Severity': "Info", 'TimeStamp': (new Date()).toISOString() }))
                }
            }
        }


    },
    error: (typeProcess, message) => {
        if (message != undefined) {
            for (var piece of message.split('\n')) {
                if (piece.length > 0) {
                    console.error(JSON.stringify({ 'Process type': typeProcess, 'Log': piece, 'Severity': "Error", 'TimeStamp': (new Date()).toISOString() }))
                }
            }
        }

    },
    debug: (typeProcess, message) => {
        if (message != undefined) {
            for (var piece of message.split('\n')) {
                if (piece.length > 0) {
                    console.error(JSON.stringify({ 'Process type': typeProcess, 'Log': piece, 'Severity': "Debug", 'TimeStamp': (new Date()).toISOString() }))
                }
            }
        }

    }
}



