// An implementation of the web worker API for node.js

var sys = require('sys');
var child_process = require('child_process');
 
var workerIndex = 0;
var MESSAGE_SPLITTER = "\r\n";
var WORKER_PARAS = ["-mode", "worker"];
var HANDSHAKE = "HANDSHAKE";
 
function debug(msg) {
  //sys.error("Workerdebug "+process.pid+" - "+msg)
}

exports.importScripts = function () {
  for (var i = 0, len = arguments.length; i < len; ++i) {
    require(arguments[i]);
  }
};
 
var Worker = function (filename, impl, options) {
  var self = this;
  process.EventEmitter.call(this);
  this.addListener("message", function (message) {
    if (self.onmessage) {
      self.onmessage(message);
    }
  });
  this.addListener("error", function (message) {
    if (self.onerror) {
      self.onerror(message);
    } else {
      if(self.listeners("error").length === 1) {
        throw new Error(message)
      }
    }
  });
  
  if(!impl) impl = WorkerChild;
  this.impl = new impl(this, filename, options);
  this.workerIndex = workerIndex++;
};
 
sys.inherits(Worker, process.EventEmitter);
Worker.prototype.postMessage =  function (payload) {
  var message = JSON.stringify(payload);
  this.impl.postMessage(message);
};
  
Worker.prototype.terminate = function () {
  this.impl.terminate();
};
 
exports.Worker = Worker;
 
function WorkerChild (eventDest, filename) {
  var self = this;
  this.eventDest  = eventDest;
  this.filename = filename;
  this.child = child_process.spawn("node", [this.filename].concat(WORKER_PARAS));
  this.child.stdout.addListener("data", function (data) {
    debug("From worker " + data);
    self.handleData(data);
  });
  
  this.child.stderr.addListener("data", function (data) {
    if(data !== null) {
      if((data+"").match("SyntaxError")) { // highly depends on node's error reporting behavior
        self.eventDest.emit("error", new SyntaxError(data));
      }
    }
  });
  
  this.child.addListener("exit", function (code) {
    debug(self.child.pid + ": exit "+code);
  });
  
  this.buffer = "";
  this.active = false;
  this.queue  = [];
}
 
WorkerChild.prototype = {
  
  postMessage: function (message) {
    if(this.active) {
      debug("Sending data "+message);
      this.write(message+MESSAGE_SPLITTER);
    } else {
      this.queue.push(message);
    }
  },
  
  postQueue: function () {
    for(var i = 0, len = this.queue.length; i < len; ++i) {
      this.postMessage(this.queue[i]);
    }
    this.queue = [];
  },
  
  handleData: function (data) {
    var self = this;
    this.buffer += (data || "");
    debug("Received data "+this.buffer);
    
    if(this.buffer !== "") {
      var parts = this.buffer.split(MESSAGE_SPLITTER);
      while (parts.length > 1) {
        var message = parts.shift();
        if (message !== "") {
          if(message === HANDSHAKE) {
            this.active = true;
            this.postQueue();
            self.write(MESSAGE_SPLITTER);
          } else {
            this.handleMessage(message);
          }
      
          this.buffer = parts.join(MESSAGE_SPLITTER);
          if(this.buffer !== "") {
            this.handleData("");
            return;
          }
        }
      }
    }
  },
  
  write: function (msg) {
    this.child.stdin.write(msg, "utf8")
  },
  
  handleMessage: function (message) {
    debug("Emit event "+message);
    var obj = JSON.parse(message);
    if (obj.__exception__) {
      this.eventDest.emit("error", obj)
    } else {
      this.eventDest.emit("message", obj)
    }
  },
  
  terminate: function () {
    this.child.stdin.end();
  }
};
 
var workerProcess;
var i = 0;
function WorkerProcess(eventDest) {
  sys.print(HANDSHAKE+MESSAGE_SPLITTER);
  var self = this;
  this.eventDest = eventDest;
  var stdin = process.openStdin();
  stdin.addListener("data", function (data) {
    debug("Process receiving data "+data);
    self.handleData(data);
  });
  this.buffer = "";
}
 
WorkerProcess.prototype = {
  postMessage: function (message) {
    //debug("Process posting message "+message);
    sys.print(message+MESSAGE_SPLITTER);
  },
  
  handleData:    WorkerChild.prototype.handleData,
  handleMessage: WorkerChild.prototype.handleMessage
};
 
function WorkerNode (impl, options) {
  var self = this;
  if(!impl) impl = WorkerProcess; 
  this.impl = new impl(this, options);
  
  process.EventEmitter.call(this);
  this.addListener("message", function (message) {
    if (self.onmessage) {
      self.onmessage(message);
    }
  });
  
  process.addListener("uncaughtException", function (exception) {
    debug("Exception in Worker "+exception)
    self.postMessage({
      __exception__: exception
    });
  })
}
sys.inherits(WorkerNode, process.EventEmitter);
 
WorkerNode.prototype.postMessage = function (payload) {
  this.impl.postMessage(JSON.stringify(payload));
};

// only for inheritance
exports._WorkerChild   = WorkerChild;
exports._WorkerProcess = WorkerProcess;
exports.startWorker    = function (impl, options) {
  exports.worker = new WorkerNode(impl, options);
  return exports.worker;
};
 
(function () {
  if (len = process.ARGV.length < 4) return;
  for (var i = 2, len = process.ARGV.length; i < len; ++i) {
    var arg = process.ARGV[i];
    if (arg != WORKER_PARAS[i-2]) {
      return;
    }
  }
  // if we are here, we are a worker
  exports.worker = new WorkerNode();
})();