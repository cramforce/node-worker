/* TODO: Take this code duplication out when NODE_PATH in env works */
var path = require("path");
 
exports.testDir = path.dirname(__filename);
exports.libDir = path.join(exports.testDir, "../../lib");
 
require.paths.unshift(exports.libDir);
 
var worker = require("worker").worker;
 
worker.addListener("message", function (msg) {
    if(msg.fib >= 0) {
      worker.postMessage(fib(msg.fib*1));
      return;
    }
    throw(msg)
});
 
 
function fib(n) {
  return n < 2 ? n : fib(n-1)+fib(n-2);
}