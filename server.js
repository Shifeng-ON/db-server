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
var wss = require('express-ws')(app,server);
var logger = require('./logger.js');
var processType ="Server";
let identifier = { application_id:appEnv.app.application_id,application_name:appEnv.app.application_name,
                    application_urls:appEnv.app.application_urls,instance_index:appEnv.app.instance_index,
                    instance_id:appEnv.app.instance_id}


getClientIdentifier = (ws)=>{
  var msg = "unable to get client"
  var id = undefined
  var index = undefined
  var name = undefined

  for (var innerID of  Object.keys(clientsWSs)){
      for (var innerIndex of Object.keys(clientsWSs[innerID].application_instances)){
          if(ws === clientsWSs[innerID].application_instances[innerIndex]){
            id = innerID
            index = innerIndex
            name = clients[id].application_name
          }
      }
  }

  if(name != undefined && id != undefined && index != undefined){
    msg = name  +'(' + id + ')/' + index 
  }
  return msg
}
var clients = {}
var clientsWSs = {}
var msgMap = { "init": "init", "reset": "reset", "heartbeat": "heartbeat", "update": "update" }
// send msg through websocket 
app.ws('/notify',function(ws,req){
    ws.on('error',(err)=>{
        let msg = getClientIdentifier(ws)
        logger.error(processType,'client connection errr: '+ err + ', client: ' + msg)
    })
    ws.on('close',()=>{
      let msg  = getClientIdentifier(ws)
      logger.log(processType,"Client disconnected: " + msg)
    })
      ws.on('message',  function(msg){
        // get obejct, extract index and id of the application instance
          let data = JSON.parse(msg)
          let index = data.identifier.instance_index
          let id = data.identifier.application_id
          // determine datatype
          switch(data.type){
            // registration
            case msgMap['init']:
                 var firstTime = true
                 var type = msgMap['init']
                 var msg = "Connection established"
                  // create a entry for this application 
                   if(clients[id] == undefined){
                      clients[id] = {application_instances:{}}
                      clientsWSs[id] = {application_instances:{}}
                   }
                   // get index, and if this instance is not registared, register it
                   if(clients[id].application_instances[index] == undefined){
                      clients[id].application_instances[index] = {}
                   }else{
                     firstTime = false
                   }

                   if(firstTime){
                     // adding application name and urls and other instance status
                    clients[id].application_name = data.identifier.application_name
                    clients[id].application_urls = data.identifier.application_urls
                    clients[id].application_instances[index].status = 'Unknown' 
                    clients[id].application_instances[index].updating = false
                    clients[id].application_instances[index].updatingError = false
                    clientsWSs[id].application_instances[index] =  ws
                   }else{
                     // only need to change websocket
                    clientsWSs[id].application_instances[index] =  ws
                    type = msgMap['reset']
                    msg = 'Conection reset'
                   }
                  logger.log(processType,msg +": " +clients[id].application_name +'(' + id + ')/' + index  )  
                  if (clientsWSs[id].application_instances[index].readyState === WebSocket.OPEN) {
                    clientsWSs[id].application_instances[index].send(JSON.stringify({"type":type,"identifier":identifier,"detail":''}))
                  }else{
                    logger.error("client websockt hang up immediately after connected." + clients[id].application_name +'(' + id + ')/' + index  ) 
                  }
                   
                  
            break
            // status update
            case msgMap['heartbeat']:
                   clients[id].application_instances[index].status = data.detail
                   logger.debug(processType,"giving heartbeat: " + clients[id].application_name +'(' + id + ')/' + index)
            break
            // virus database update
            case msgMap['update']:
                  var msg = ''
                  clients[id].application_instances[index].updating = data.detail.updating
                  clients[id].application_instances[index].updatingError = data.detail.updatingError
                  if(data.detail.updating){
                    msg =  "updating virus database"
                  }else{
                    if(data.detail.updatingError){
                      msg = "Error updating virus database"
                    }else{
                      msg =" Successfully updated virus database"
                    }
                  }
                  logger.debug(processType,msg + ": " + clients[id].application_name +'(' + id + ')/' + index)
            break 
            default:break
          }
      })
});

app.get('/',function(req,res){
       let count = 0
      wss.getWss().clients.forEach((client)=>{
        if(client.readyState == WebSocket.OPEN){ 
          count ++
        }
      })
   res.status(200).send("Current client count: " + JSON.stringify(count) + ', and cluster count: ' + Object.keys(clients).length +'\nsee clients obejct below\n '+ JSON.stringify(clients))
})

app.get('/notify',function(req,res){
    wss.getWss().clients.forEach(function (client) {
      if(client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({"type":msgMap['update'],"identifier":identifier,"detail":''}))
      }
    });
  res.status(200).send('Successfully notify all connected clamav daemon to update their virus databases')
})


app.get('/notify/:clientID/:clientINDEX', function (req, res) {
  let id = req.params.clientID
  let index = req.params.clientINDEX
  if (clientsWSs[id] != undefined) {
    if (clientsWSs[id].application_instances[index] != undefined) {
      if (clientsWSs[id].application_instances[index].readyState === WebSocket.OPEN) {
        clientsWSs[id].application_instances[index].send(JSON.stringify({ "type": msgMap['update'], "identifier": identifier, "detail": '' }))
        res.status(200).send('Successfully notify virus database update: ' + clients[id].application_name + '/' + index)
      } else {
        res.status(503).send('Failed to notify application: ' + clients[id].application_name + '/' + index + ', communication tunnel closed.')
      }
    }else{
      res.status(404).send('Application does not exist: ' + clients[id].application_name + '/' + index )
    }
  }else{
    res.status(404).send('Application does not exist: ' + clients[id].application_name + '/' + index )
  }
})

/*everything below comes from node express, except server.listen*/

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());


// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handlers


// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use(function(err, req, res, next) {
   
    res.status(err.status || 500).send("<h1>Resource not found</h1>");
    
  });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
    
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
