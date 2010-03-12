var path = require("path");
 
exports.testDir = path.dirname(__filename);
exports.fixturesDir = path.join(exports.testDir, "fixtures");
exports.libDir = path.join(exports.testDir, "../../lib");
 
require.paths.unshift(exports.libDir);
 
var assert = require('assert');
var sys = require("sys");
 
process.mixin(exports, sys);
exports.assert = require('assert');
exports.path = path;

var ok = assert.ok;
assert.ok = function (bool, msg) {
  if(bool) {
    sys.print("OK ")
  } else {
    sys.print("NOT OK ")
  }
  sys.puts(msg);
}