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

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());

var clients = {}
var msgMap=['init','status','action']
// send msg through websocket 
app.ws('/notify',function(ws,req){
      let count = 0
      wss.getWss().clients.forEach((client)=>{
        if(client.readyState == WebSocket.OPEN){ 
          count ++
        }
      })
    logger.log(processType,"new client connected\ncurrent client count: " + count)
      ws.on('message',  function(msg){
          let data = JSON.parse(msg)
          let index = data.identifier.instance_index
          let id = data.identifier.application_id
          switch(data.type){
            case msgMap[0]:
      
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
            break
            case msgMap[1]:
                   clients[id].application_instances[index].status = data.detail
                   console.log(data.detail)
            break
            case msgMap[2]:

            break 
          }
       
        
      })
});

app.get('/',function(req,res){
    wss.getWss().clients.forEach(function (client) {
         if(client.readyState === WebSocket.OPEN) {
        client.send('get status')
      }
    })
   res.status(200).send(JSON.stringify(clients))
})

app.get('/notify',function(req,res){
    wss.getWss().clients.forEach(function (client) {
      if(client.readyState === WebSocket.OPEN) {
        client.send('update freshclam')
      }
    });
  res.status(200).send('done')
})


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
