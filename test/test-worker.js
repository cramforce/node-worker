process.mixin(require("./common"));
 
var sys = require("sys");
var Worker = require("../lib/worker").Worker;
 
process.ENV["NODE_PATH"] = process.libDir;
 
function makeWorker () {
  return new Worker(__filename.replace("test-", "fixtures/"));
}
 
var worker = makeWorker();
 
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
 
setTimeout(function () {
  setTimeout(function () {
    var w2 = makeWorker();
    w2.postMessage({
      error: true
    });
    w2.addListener("error", function () {
      assert.ok(true, "Received expected error");
      w2.terminate();
    });
    w2.addListener("message", function () {
      assert.ok(false, "Wanted an error, but got a message");
      w2.terminate();
    });
  }, 10);
}, 10);


var fibWorker = makeWorker();
sys.puts("Giving hard work to worker")
fibWorker.postMessage({
  fib: 41
});
var ret = false;
fibWorker.addListener("message", function (fib) {
  sys.error("Fib "+fib);
  ret = true;
  assert.ok(fib === 165580141, "Worker can do long running stuff.")
  fibWorker.terminate();
});
for(var i = 0; i < 100; ++i) {
  // counting;
}
assert.ok(!ret, "Can do work while background spins");
 
var waitWorker = makeWorker();
waitWorker.postMessage({
  wait: true
});
waitWorker.addListener("message", function () {
  assert.ok(true, "Worker response can be async.")
  waitWorker.terminate();
});