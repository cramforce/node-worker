var common = require("./common");
var sys    = require("sys");
var assert = require('assert');
 
var Worker = require("../lib/worker").Worker;
 
process.ENV["NODE_PATH"] = common.libDir;
 
function makeWorker (filename) {
  return new Worker(__dirname+"/fixtures/"+filename);
}

// basic test
var worker = makeWorker("worker.js");
 
worker.onmessage = function (msg) {
  if (msg.input) {
    assert.ok(msg.output == msg.input * 3, "We can multiply asyncly");
    if(msg.input * 3 == 12) {
      worker.terminate();
    }
  }
};
 
worker.postMessage({
  input: 1
});
worker.postMessage({
  input: 2
});
worker.postMessage({
  input: 3
});
worker.postMessage({
  input: 4
});

// error handling
setTimeout(function () {
  setTimeout(function () {
    
    var w2 = makeWorker("worker.js");
    w2.postMessage({
      error: true
    });
    w2.addListener("error", function () {
      assert.ok(true, "Received expected error via event");
      w2.terminate();
    });
    w2.addListener("message", function () {
      assert.ok(false, "Wanted an error, but got a message");
      w2.terminate();
    });
    
    var w3 = makeWorker("worker.js");
    w3.postMessage({
      error: true
    });
    w3.onerror = function () {
      assert.ok(true, "Received expected error with onerror");
      w3.terminate();
    };
    w3.addListener("message", function () {
      assert.ok(false, "Wanted an error, but got a message");
      w3.terminate();
    });
    
  }, 10);
}, 10);

// syntax error handling
var syntaxError = makeWorker("syntax-error-worker.js");
var hadSyntaxError = false;
syntaxError.onerror = function (err) {
  if(err instanceof SyntaxError) {
    hadSyntaxError = true;
  }
}
process.addListener("exit", function () {
  assert.ok(hadSyntaxError, "detected syntax error");
})

// long running processes
var fibWorker = makeWorker("fib-worker.js");
sys.puts("Giving hard work to worker")
fibWorker.postMessage({
  fib: 41
});
var longRunningReturned = false;
var interval = setInterval(function () {
  sys.puts("# working in the background")
}, 500);
fibWorker.addListener("message", function (fib) {
  sys.error("Fib "+fib);
  longRunningReturned = true;
  assert.ok(fib === 165580141, "Worker can do long running stuff.")
  fibWorker.terminate();
  clearInterval(interval);
});
for(var i = 0; i < 100; ++i) {
  // counting;
}
assert.ok(!longRunningReturned, "Can do work while background spins");
process.addListener("exit", function () {
  assert.ok(longRunningReturned, "Did long running calculation")
})

var waitWorker = makeWorker("worker.js");
waitWorker.postMessage({
  wait: true
});
waitWorker.addListener("message", function () {
  assert.ok(true, "Worker response can be async.")
  waitWorker.terminate();
});