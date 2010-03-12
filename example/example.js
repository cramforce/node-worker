var sys = require("sys");

var Worker = require("../lib/worker").Worker;

var worker = new Worker("worker.js");

worker.postMessage({
  hello: "world"
});

worker.onmessage = function (msg) {
  sys.puts(msg.hello);
};

worker.addListener("message", function (msg) {
  sys.puts(msg.hello);
  worker.terminate();
});