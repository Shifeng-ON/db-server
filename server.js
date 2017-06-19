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

getClientWs = (id,index)=>{
   if (clientsWSs[id] != undefined) {
    if (clientsWSs[id].application_instances[index] != undefined) {
          return  clientsWSs[id].application_instances[index]
    }
  }
  return undefined
}
getClientIdentifier = (ws)=>{
  var msg = "unable to get client"
  var id = undefined
  var index = undefined
  var name = undefined

var clients = {}
    var msgMap = { "init": "init", "heartbeat": "heartbeat", "updating": "updating", "updated": "updated","updateError":"updateError" }
// send msg through websocket 
app.ws('/notify',function(ws,req){
      ws.on('message',  function(msg){
        // get obejct, extract index and id of the application instance
          let data = JSON.parse(msg)
          let index = data.identifier.instance_index
          let id = data.identifier.application_id
          // determine datatype
          switch(data.type){
            case msgMap['init']:
                  // create a entry for this application 
                   if(clients[id] == undefined){
                      clients[id] = {}
    
                   }
                   // adding application name and urls
                   clients[id].application_name = data.identifier.application_name
                   clients[id].application_urls = data.identifier.application_urls
                   // adding application instances detail
                   if( clients[id].application_instances == undefined){
                        clients[id].application_instances = {}
                   }
                   // get index, and if this instance is not registared, register it, with status unknown
        
                   if(clients[id].application_instances[index] == undefined){
                      clients[id].application_instances[index] = {}
                   }
                   clients[id].application_instances[index].status = 'Unknown' 
                   clients[id].application_instances[index].ws =  ws
                   clients[id].application_instances[index].updating = false
                   clients[id].application_instances[index].updatingError = false
                   clients[id].application_instances[index].ws.send(JSON.stringify({"type":msgMap['init'],"identifier":identifier,"detail":''}))
                  logger.log(processType,clients[id].application_name +' with id ' + id + ', instance ' + index + ' connected.' )    
                  
            break
            // status update
            case msgMap['heartbeat']:
                   clients[id].application_instances[index].status = data.detail
                   logger.debug(processType,clients[id].application_name +' with id ' + id + ', instance ' + index + ' giving heartbeat.')
            break
            case msgMap['updating']:
                  clients[id].application_instances[index].updating = data.detail 
                  clients[id].application_instances[index].updatingError = false
                  logger.debug(processType,clients[id].application_name +' with id ' + id + ', instance ' + index + ' is updating virus database.')
            break 
            case msgMap['updated']:
                clients[id].application_instances[index].updating = data.detail
                 clients[id].application_instances[index].updatingError = false
                 logger.debug(processType,clients[id].application_name +' with id ' + id + ', instance ' + index + ' updated virus database.')
            break
            case msgMap['updateError']:
                clients[id].application_instances[index].updating = data.detail
                clients[id].application_instances[index].updatingError = true
                logger.debug(processType,clients[id].application_name +' with id ' + id + ', instance ' + index + ' virus databased updating process error.')
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
   res.status(200).send("Current client count: " + JSON.stringify(count) + ', and cluster count: ' + Object.keys(clients).length)
})

app.get('/notify',function(req,res){
    wss.getWss().clients.forEach(function (client) {
      if(client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({"type":msgMap['updating'],"identifier":identifier,"detail":true}))
      }
    });
  res.status(200).send('Successfully notify all connected clamav daemon to update their virus databases')
})


app.get('/notify/:clientID/:clientINDEX', function (req, res) {
  let id = req.params.clientID
  let index = req.params.clientINDEX
  let ws = getClientWs(id,index)
  if(ws != undefined){
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ "type": msgMap['update'], "identifier": identifier, "detail": '' }))
        res.status(200).send('Successfully notify virus database update: ' + clients[id].application_name + '/' + index)
      } else {
        res.status(503).send('Failed to notify application: ' + clients[id].application_name + '/' + index + ', communication tunnel closed.')
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
