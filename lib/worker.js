// An implementation of the web worker API for node.js

var sys = require('sys');
 
var workerIndex = 0;
var MESSAGE_SPLITTER = "\r\n";
var WORKER_PARAS = ["-mode", "worker"];
var HANDSHAKE = "HANDSHAKE";
var workerImplementation = WorkerChild;
var workerProcessImplementation = WorkerProcess;
 
function debug(msg) {
  //sys.error("WorkerDebug "+process.pid+" - "+msg)
}

exports.importScripts = function () {
  for (var i = 0, len = arguments.length; i < len; ++i) {
    require(arguments[i]);
  }
};
 
var Worker = function (filename) {
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
  
  this.impl = new workerImplementation(this, filename);
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
  this.child = process.createChildProcess("node", [this.filename].concat(WORKER_PARAS));
  this.child.addListener("output", function (data) {
    debug("From worker " + data);
    self.handleData(data);
  });
  
  this.child.addListener("error", function (data) {
    if(data !== null) {
      debug(self.child.pid + ": "+ data);
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
      this.child.write(message+MESSAGE_SPLITTER, "utf8");
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
            setTimeout(function () {
              self.child.write(MESSAGE_SPLITTER, "utf8")
            }, 10)
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
    this.child.close();
  }
};
 
var workerProcess;
var i = 0;
function WorkerProcess(eventDest) {
  sys.print(HANDSHAKE+MESSAGE_SPLITTER);
  var self = this;
  this.eventDest = eventDest;
  process.stdio.open();
  process.stdio.addListener("data", function (data) {
    debug("Process receiving data "+data);
    self.handleData(data);
  });
  this.buffer = "";
}
 
WorkerProcess.prototype = {
  postMessage: function (message) {
    debug("Process posting message "+message);
    sys.print(message+MESSAGE_SPLITTER);
  },
  
  handleData:    WorkerChild.prototype.handleData,
  handleMessage: WorkerChild.prototype.handleMessage
};
 
function WorkerNode () {
  var self = this;
  this.impl = new workerProcessImplementation(this);
  
  process.EventEmitter.call(this);
  this.addListener("message", function (message) {
    if (self.onmessage) {
      self.onmessage(message);
    }
  });
  
  process.addListener("uncaughtException", function (exception) {
    self.postMessage({
      __exception__: exception
    })
  })
}
sys.inherits(WorkerNode, process.EventEmitter);
 
WorkerNode.prototype.postMessage = function (payload) {
  this.impl.postMessage(JSON.stringify(payload));
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