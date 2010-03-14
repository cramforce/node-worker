/* TODO: Take this code duplication out when NODE_PATH in env works */
var path = require("path");
 
exports.testDir = path.dirname(__filename);
exports.libDir = path.join(exports.testDir, "../../lib");
 
require.paths.unshift(exports.libDir);
 
var sys    = require("sys");
var worker = require("worker").worker;
 
worker.onmessage = function (msg) {
    if(msg.wait) {
      setTimeout(function () {
        worker.postMessage("Waited")
      }, 1000)
      return;
    }
    
    if(msg.error) {
      throw("ErrorMarker");
    }
    
    msg.output = msg.input * 3;
    setTimeout(function () {
      worker.postMessage(msg);
    }, 100 * msg.output)
};