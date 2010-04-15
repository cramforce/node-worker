var tcp = require("net");
var sys = require("sys");
var worker = require("./worker");
 
var MESSAGE_SPLITTER = "\r\n";
var HANDSHAKE = "HANDSHAKE"; 

function debug(msg) {
  //sys.error("Workerdebug "+process.pid+" - "+msg)
}

var WorkerServer = {};

exports.makeWorker = function (filename, port, hostname, callback) {
  
  var dest = port+":"+hostname;
  
  var server = WorkerServer[dest];
  
  var paras = {
    port: null, // not yet known
    hostname: hostname
  };
  
  var w = new worker.Worker(filename, WorkerChild, paras);
  
  if(!server) {
    var server = new worker.Worker("server", WorkerChild, {
      port: port,
      hostname: hostname
    });
    WorkerServer[dest] = server;

    server.onmessage = function (port) {
      paras.port = port;
      w.impl.connect(paras);
    };
  }
  server.postMessage(filename);
  
  w.terminateServer = function () {
    WorkerServer[dest] = null;
    server.terminate();
  };
  
  return w;
}

exports.startWorker = function (port, hostname) {
  var w = worker.startWorker(WorkerProcess, {
    port: port,
    hostname: hostname
  });
  sys.puts("System up");
  return w;
}

exports.WorkerChild = WorkerChild;
exports.WorkerProcess = WorkerProcess;

function WorkerChild (eventDest, filename, paras) {
  var self = this;
  this.eventDest = eventDest;
  this.filename = filename;

  if(paras.port) {
    this.connect(paras)
  }
  
  this.buffer = "";
  this.active = false;
  this.queue  = [];
}

sys.inherits(WorkerChild, worker._WorkerChild);

WorkerChild.prototype.connect = function (paras) {
  var self = this;
  var socket = tcp.createConnection(paras.port, paras.hostname || "localhost");
  this.socket = socket;

  socket.setEncoding("utf8");
  socket.addListener("connect", function () {
    self.active = true;
  });
  socket.addListener("data", function (data) {
    debug("From worker " + data);
    self.handleData(data);
  });
  socket.addListener("timeout", function (data) {
    debug("timeout "+paras.port);
  });
  socket.addListener("end", function () {
    socket.close();
  });
  
  socket.addListener("close", function (hadError) {
    debug("Closing socket "+paras.port);
    self.stopKeepAlive();
    if(hadError) {
      debug("Socket closed due to error");
    }
  });
  
  this.keepAliveInterval = setInterval(function () {
    self.write(MESSAGE_SPLITTER);
  }, 5 * 1000)
}

WorkerChild.prototype.write = function (msg) {
  this.socket.write(msg, "utf8")
};

WorkerChild.prototype.stopKeepAlive = function () {
  if(this.keepAliveInterval) {
    clearInterval(this.keepAliveInterval);
    this.keepAliveInterval = null;
  }
}
  
WorkerChild.prototype.terminate = function () {
  this.stopKeepAlive();
  this.socket.close();
}

function WorkerProcess(eventDest, paras) {
  var self = this;
  this.eventDest = eventDest;
  
  this.socket = null;
  
  var server = tcp.createServer(function (socket) {
    if(self.socket) {
      throw("Only one socket may be open at any given time (I can only have one parent).")
    }
    self.socket = socket;
    socket.setEncoding("utf8");
    socket.addListener("connect", function () {
      socket.write(HANDSHAKE+MESSAGE_SPLITTER);
    });
    socket.addListener("data", function (data) {
      debug("Process receiving data "+data);
      self.handleData(data);
    });
    socket.addListener("timeout", function (data) {
      debug("timeout "+paras.port);
    });
    socket.addListener("end", function () {
      self.socket = null;
      socket.close();
    });
  });
  server.listen(paras.port, paras.hostname || "localhost");
  this.buffer = "";
  debug("Listening on "+paras.port);
}
 
WorkerProcess.prototype = {
  postMessage: function (message) {
    debug("Process posting message "+message);
    this.socket.write(message+MESSAGE_SPLITTER);
  },
  
  handleData:    WorkerChild.prototype.handleData,
  handleMessage: WorkerChild.prototype.handleMessage
};