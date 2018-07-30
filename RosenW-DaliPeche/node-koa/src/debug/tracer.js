const fs = require('fs');
const { assert } = require('./../asserts/asserts.js');

function trace (msg) {
  fs.appendFile('./src/debug/trace.log', `${msg}\n`, (err) => {
  	if (err) console.error(`Error while tracing: ${err.message}`);
  });
}

function clearTraceLog (msg) {
  fs.writeFile('./src/debug/trace.log', '', (err) => {
  	if (err) console.error(`Error while tracing: ${err.message}`);
  });
}

module.exports = { trace, clearTraceLog };
