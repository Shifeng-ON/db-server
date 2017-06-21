var http = require('http');
var WebSocket = require('ws');
var express = require('express');
var path = require('path');
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
}

// variable init
var clients = {}
var msgMap = { "init": "init", "reset": "reset", "heartbeat": "heartbeat", "update": "update" }


// send heart beat request to all clients
sendHeartBeat = () => {
  wss.clients.forEach((ws) =>{
    if (ws.isAlive === false){
      let clientID = getClientIdentifier(ws)
       logger.debug(processType,"Terminating broken connection for :" + clients[clientID.id].application_name + '(' + clientID.id + ')/' + clientID.index)
       return ws.terminate();
    } 
   
    ws.isAlive = false;
    ws.ping('', false, true);
  }); 
  logger.debug(processType, "Request heartbeat")
  for (var id of Object.keys(clients)){
    for (var index of Object.keys(clients[id].application_instances)){
      let clientWS = getClientWs(id,index)
      if(clientWS.readyState === WebSocket.OPEN){
         clientWS.send(JSON.stringify({ "type": msgMap['heartbeat'], "identifier": identifier, "detail": '' }))
      }else{
         clients[id].application_instances[index].status = 'Unknown'
         clients[id].application_instances[index].updating = false
         clients[id].application_instances[index].updatingError = false
         logger.debug(processType, "Communication tunnel does not exist for : " + clients[id].application_name + '(' + id + ')/' + index)
      }
    }
  }
  
}

// requesting heart beat every defined seconds, can excced 100 seconds
let maxHeartBeatInterval = 100
let minHeartBeatInterval = 10
var heartbeatInterval = Math.min(maxHeartBeatInterval,config.server.heartbeatInterval)
    heartbeatInterval = Math.max(minHeartBeatInterval,heartbeatInterval)
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
        client = {"id":innerID,"index":innerIndex,"name":clients[innerID].application_name }
      }
    }
  }
  return client
}
// send msg through websocket 
app.ws('/notify', function (ws, req) {
  let heartbeat= ()=> {
    this.isAlive = true;
  }
  
  ws.isAlive = true;
  ws.on('pong', heartbeat);

  ws.on('error', (err) => {
    var msg = "Disconnected client is not registered"
    var client = getClientIdentifier(ws)
    if(client != undefined){
          msg = client.name + '(' + client.id + ')/' + client.index
          clients[client.id].application_instances[client.index].status = 'Unknown'
          clients[client.id].application_instances[client.index].updating = false
          clients[client.id].application_instances[client.index].updatingError = false
    }
    logger.error(processType, 'client connection errr: ' + err + ', client: ' + msg)
  })
  ws.on('close', () => {
    var msg = "Disconnected client is not registered"
    var client = getClientIdentifier(ws)
    if(client != undefined){
          msg = client.name + '(' + client.id + ')/' + client.index
          clients[client.id].application_instances[client.index].status = 'Unknown'
          clients[client.id].application_instances[client.index].updating = false
          clients[client.id].application_instances[client.index].updatingError = false
    }
    logger.log(processType, "Client disconnected: " + msg)
  })
  ws.on('message', function (msg) {
    // get obejct, extract index and id of the application instance
    let data = JSON.parse(msg)
    let index = data.identifier.instance_index
    let id = data.identifier.application_id
    // determine datatype
    switch (data.type) {
      // registration
      case msgMap['init']:
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
          clients[id].application_instances[index].status = 'Unknown'
          clients[id].application_instances[index].updating = false
          clients[id].application_instances[index].updatingError = false
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

// display clients controll interface
app.get('/', function (req, res) {
  let count = 0
  wss.getWss().clients.forEach((client) => {
       if(client.readyState === WebSocket.OPEN){
      count++
    }
    
  })
  let replacer = (key,value)=>{
    if(key == "ws"){
      return undefined
    }
    return value
  }
  res.status(200).send("Current active client count: " + JSON.stringify(count) + ', and Application count: ' + Object.keys(clients).length + '\nsee clients obejct below\n ' + JSON.stringify(clients,replacer))
})



//notify update endpoint
app.get('/notify', function (req, res) {
  wss.getWss().clients.forEach(function (client) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ "type": msgMap['update'], "identifier": identifier, "detail": '' }))
    }
  });
  res.status(200).send('Successfully notify all connected clamav daemon to update their virus databases')
})

// notify update  endpoint for individual
app.get('/notify/:clientID/:clientINDEX', function (req, res) {
  let id = req.params.clientID
  let index = req.params.clientINDEX
  let ws = getClientWs(id, index)
  if (ws != undefined) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ "type": msgMap['update'], "identifier": identifier, "detail": '' }))
      res.status(200).send('Successfully notify virus database update: ' + clients[id].application_name + '/' + index)
    } else {
      res.status(503).send('Failed to notify application: ' + clients[id].application_name + '/' + index + ', communication tunnel is not established.')
    }
  } else {
    res.status(404).send('Application does not exist: ' + clients[id].application_name + '/' + index)
  }
})

/*everything below comes from node express, except server.listen*/

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());


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