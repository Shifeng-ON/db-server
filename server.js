var http = require('http');
var WebSocket = require('ws');
var express = require('express');
var path = require('path');
var fs = require('fs');
var favicon = require('serve-favicon');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var app = express();
var cfenv = require('cfenv'),
  appEnv = cfenv.getAppEnv();
var server = http.createServer(app);
var wss = require('express-ws')(app, server);
var logger = require('./logger.js');
var processType = "Server";
var config = require('./config.js')
let identifier = {
  application_id: appEnv.app.application_id, application_name: appEnv.app.application_name,
  application_urls: appEnv.app.application_urls, instance_index: appEnv.app.instance_index,
  instance_id: appEnv.app.instance_id
};

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());

var auth = require('basic-auth')
 
// Create server 
var vertify = (req,res,next)=>{
    var credentials = auth(req)
  if (!credentials || credentials.name !== 'admin' || credentials.pass !== 'admin') {
    res.setHeader('WWW-Authenticate', 'Basic realm="example"')
    res.status(401).send('Access denied')
  }else{
    next()
  } 
}
app.use('*',vertify )
// variable init
var clients = {}
var msgMap = { "init": "init", "reset": "reset", "heartbeat": "heartbeat", "update": "update" }


// send heart beat request to all clients
sendHeartBeat = () => {
  logger.debug(processType, "Request heartbeat")
  for (var id of Object.keys(clients)) {
    for (var index of Object.keys(clients[id].application_instances)) {
      let clientWS = getClientWs(id, index)
      if (clientWS.readyState === WebSocket.OPEN) {
        clientWS.send(JSON.stringify({ "type": msgMap['heartbeat'], "identifier": identifier, "detail": '' }))
      } else {
        clients[id].application_instances[index].status = 'unknown'
        clients[id].application_instances[index].updating = false
        clients[id].application_instances[index].updatingError = false
        clients[id].application_instances[index].errorMsg = undefined
        logger.debug(processType, "Communication tunnel does not exist for : " + clients[id].application_name + '(' + id + ')/' + index)
      }
    }
  }

}

// requesting heart beat every defined seconds, can excced 100 seconds
let maxHeartBeatInterval = 100
let minHeartBeatInterval = 10
var heartbeatInterval = Math.min(maxHeartBeatInterval, config.server.heartbeatInterval)
heartbeatInterval = Math.max(minHeartBeatInterval, heartbeatInterval)
setInterval(() => {
  sendHeartBeat()

}, heartbeatInterval * 1000)

//get client WS
getClientWs = (id, index) => {
  if (clients[id] != undefined) {
    if (clients[id].application_instances[index] != undefined) {
      return clients[id].application_instances[index].ws
    }
  }
  return undefined
}
// get clientID
getClientIdentifier = (ws) => {
  var client = undefined

  for (var innerID of Object.keys(clients)) {
    for (var innerIndex of Object.keys(clients[innerID].application_instances)) {
      if (ws === clients[innerID].application_instances[innerIndex].ws) {
        client = { "id": innerID, "index": innerIndex, "name": clients[innerID].application_name }
      }
    }
  }
  return client
}
// websocket endpoint 
app.ws('/notify', function (ws, req) {

  ws.on('error', (err) => {
    var msg = "Disconnected client is not registered"
    var client = getClientIdentifier(ws)
    if (client != undefined) {
      msg = client.name + '(' + client.id + ')/' + client.index
      clients[client.id].application_instances[client.index].status = 'unknown'
      clients[client.id].application_instances[client.index].updating = false
      clients[client.id].application_instances[client.index].updatingError = false
    }
    logger.error(processType, 'client connection errr: ' + err + ', client: ' + msg)
  })
  ws.on('close', () => {
    var msg = "Disconnected client is not registered"
    var client = getClientIdentifier(ws)
    if (client != undefined) {
      msg = client.name + '(' + client.id + ')/' + client.index
      clients[client.id].application_instances[client.index].status = 'unknown'
      clients[client.id].application_instances[client.index].updating = false
      clients[client.id].application_instances[client.index].updatingError = false
    }
    logger.log(processType, "Client disconnected: " + msg)
  })
  ws.on('message', function (msg) {
    // get obejct, extract index and id of the application instance
    let data = JSON.parse(msg)
    if(data == undefined){
      return
    }
    let index = data.identifier.instance_index
    let id = data.identifier.application_id
    // determine datatype
    switch (data.type) {
      // registration
      case msgMap['init']:
        if(id==undefined || index==undefined){
          return
        }
        var firstTime = true
        var type = msgMap['init']
        var msg = "Connection established"
        // create a entry for this application 
        if (clients[id] == undefined) {
          clients[id] = { application_instances: {} }
        }
        // get index, and if this instance is not registared, register it
        if (clients[id].application_instances[index] == undefined) {
          clients[id].application_instances[index] = {}
        } else {
          firstTime = false
        }

        if (firstTime) {
          // adding application name and urls and other instance status
          clients[id].application_name = data.identifier.application_name
          clients[id].application_urls = data.identifier.application_urls
          clients[id].application_instances[index].status = 'unknown'
          clients[id].application_instances[index].updating = false
          clients[id].application_instances[index].updatingError = false
          clients[id].application_instances[index].errorMsg = undefined
          clients[id].application_instances[index].ws = ws
        } else {
          // only need to change websocket
          clients[id].application_instances[index].ws = ws
          type = msgMap['reset']
          msg = 'Conection reset'
        }
        logger.log(processType, msg + ": " + clients[id].application_name + '(' + id + ')/' + index)
        if (clients[id].application_instances[index].ws.readyState === WebSocket.OPEN) {
          clients[id].application_instances[index].ws.send(JSON.stringify({ "type": type, "identifier": identifier, "detail": '' }))
        } else {
          logger.error("client websockt hang up immediately after connected." + clients[id].application_name + '(' + id + ')/' + index)
        }


        break
      // status update
      case msgMap['heartbeat']:
        clients[id].application_instances[index].status = data.detail
        logger.debug(processType, "Receiving heartbeat: " + clients[id].application_name + '(' + id + ')/' + index)
        break
      // virus database update
      case msgMap['update']:
        var msg = ''
        clients[id].application_instances[index].updating = data.detail.updating
        clients[id].application_instances[index].updatingError = data.detail.updatingError
        clients[id].application_instances[index].errorMsg = data.detail.errorMsg
        if (data.detail.updating) {
          msg = "updating virus database"
        } else {
          if (data.detail.updatingError) {
            msg = "Error updating virus database"
          } else {
            msg = " Successfully updated virus database"
          }
        }
        logger.debug(processType, msg + ": " + clients[id].application_name + '(' + id + ')/' + index)
        break
      default: break
    }
  })
});

// main endpoint
app.get('/',function(req,res){
  res.status(200).send("<h2>server is alive</h2>")
})
// monitor endpoint
app.use('/utility', express.static(path.join(__dirname, 'public')))


// JSONstringify replacer to avoid showing ws object
let replacer = (key, value) => {
  if (key == "ws") {
    return undefined
  }
  return value
}


// will retrieve all application infomation
app.get('/info', function (req, res) {
  res.status(200).send(JSON.stringify(clients, replacer))
})

// will retrieve all instance of this application id
app.get('/info/:clientID', function (req, res) {
  let id = req.params.clientID
  var selectedClients = clients[id]
  if (selectedClients == undefined) {
    res.status(404).send("application with id: " + id+" can no be found.")
  } else {
    res.status(200).send(JSON.stringify(selectedClients, replacer))
  }
})
// will retrieve only this instance with this application id
app.get('/info/:clientID/:clientINDEX', function (req, res) {
  let id = req.params.clientID
  let index = req.params.clientINDEX
  var selectedClients = clients[id]
  if (selectedClients != undefined) {
    if (selectedClients.application_instances[index] != undefined) {
      res.status(200).send(JSON.stringify(selectedClients.application_instances[index], replacer))
    } else {
      res.status(404).send("application with id: " + id + ' at index: ' + index + ' can not be found')
    }

  } else {
    res.status(404).send("application with id: " + id + ' at index: ' + index + ' can not be found')
  }
})



//notify update endpoint()
app.post('/notify', function (req, res) {
  let options = req.body
  wss.getWss().clients.forEach(function (client) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ "type": msgMap['update'], "identifier": identifier, "detail":options }))
    }
  });
  res.status(200).send('Successfully notify all connected clamav daemon to update their virus databases')
})

// notify update  endpoint for individual
app.post('/notify/:clientID/:clientINDEX', function (req, res) {
  let id = req.params.clientID
  let index = req.params.clientINDEX
  let ws = getClientWs(id, index)
  let options = req.body

  if (ws != undefined) {
    if (ws.readyState === WebSocket.OPEN){
      
      if(!clients[id].application_instances[index].updating) {
      clients[id].application_instances[index].updating = true
      let messageHandler = (msg)=>{
       let data = JSON.parse(msg)
      switch (data.type){
         case msgMap['update']:
          if(!data.detail.updating){
            if(data.detail.updatingError){
              res.status(500).send('Update failed: ' + clients[id].application_name + '/' + index)
            }else{

              res.status(200).send('Update successed: ' + clients[id].application_name + '/' + index)
            }
            removal('normal')
          }
         break;
         default: break;
      }
    }

    let removal = (type)=>{
      if(type!='normal'){
           res.status(503).send('Failed to receive update response: ' + clients[id].application_name + '/' + index +' '+ err||"")
      }
      ws.removeListener('message',messageHandler)
      ws.removeListener('error',removal)
      ws.removeListener('close',removal)
    }

      ws.on('message',messageHandler)
      ws.once('close',removal)
      ws.once('error',removal )
      ws.send(JSON.stringify({ "type": msgMap['update'], "identifier": identifier, "detail": options }))
      }else{
         res.status(400).send('Updating is progress: ' + clients[id].application_name + '/' + index)
      }

    } else {
      res.status(503).send('Failed to notify application: ' + clients[id].application_name + '/' + index + ', communication tunnel is not established.')
    }
  } else {
    res.status(404).send('Application does not exist: ' + clients[id].application_name + '/' + index)
  }
})




// catch 404 and forward to error handler
app.use(function (req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handlers


// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use(function (err, req, res, next) {

    res.status(err.status || 500).send("<h1>Resource not found</h1>");

  });
}

// production error handler
// no stacktraces leaked to user
app.use(function (err, req, res, next) {

  res.status(err.status || 500).send("<h1>Resource not found</h1>");

});


/**
 * Get port from environment and store in Express.
 */

app.set('port', appEnv.port);



/**
 * Listen on provided port, on all network interfaces.
 */

server.on('error', onError);
server.on('listening', onListening);
server.listen(appEnv.port, appEnv.bind, function () {
  logger.log(processType, 'Server started on port ' + appEnv.port)

})


/**
 * Event listener for HTTP server "error" event.
 */

function onError(error) {
  if (error.syscall !== 'listen') {
    throw error;
  }

  var bind = typeof port === 'string'
    ? 'Pipe ' + port
    : 'Port ' + port;

  // handle specific listen errors with friendly messages
  switch (error.code) {
    case 'EACCES':
      console.error(bind + ' requires elevated privileges');
      process.exit(1);
      break;
    case 'EADDRINUSE':
      console.error(bind + ' is already in use');
      process.exit(1);
      break;
    default:
      throw error;
  }
}

/**
 * Event listener for HTTP server "listening" event.
 */

function onListening() {
  var addr = server.address();
  var bind = typeof addr === 'string'
    ? 'pipe ' + addr
    : 'port ' + addr.port;
}