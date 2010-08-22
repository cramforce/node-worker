var common = require("./common");
var sys    = require("sys");
var assert = require('assert');

var Worker = require("../lib/worker").Worker;
 
process.ENV["NODE_PATH"] = common.libDir;
 
function makeWorker (filename) {
  return new Worker(__dirname+"/fixtures/"+filename);
}

var results = [0,1,1,2,3,5,8,13,21,34,55,89,144,233,377,610,987,1597,2584,4181,6765,10946,17711,28657,46368,75025,121393,196418,317811,514229,832040,1346269,2178309,3524578,5702887,9227465,14930352,24157817,39088169,63245986,102334155,165580141];
var all = [];

var count = 0;
var place = 0;
function startAndExpect(count) {
  sys.puts("Starting worker "+count)
  var worker = makeWorker("fib-worker.js");
  setTimeout(function () { // let everybody spawn
    worker.postMessage({
      fib: count
    });
    worker.addListener("message", function (result) {
      assert.ok(result === results[count], count + "Result is correct: "+result);
      all[count] = result;
      sys.puts(count +"th worker came in "+place);
      place++;
      worker.terminate();
    })
    worker.onerror = function (err) {
      sys.error(JSON.stringify(err));
    }
  }, 1000);
}

/*
// gather results
process.addListener("exit", function () {
  sys.puts(JSON.stringify(all));
})*/

for(var i = 40; i >= 0; i--) { // start with the hardest
  startAndExpect(i);
}