// the actual web worker

var worker = require("worker").worker;
 
worker.onmessage = function (msg) {
  worker.postMessage({
    hello: "mother"
  });
};