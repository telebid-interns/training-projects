const fs = require('fs');

function trace (msg) {
	fs.appendFile('./src/debug/trace.log', msg + '\n', function (err) {
    if (err) {
      return console.log(err);
    }
	});
}

function renewLog (msg) {
	fs.writeFile('./src/debug/trace.log', '', function (err) {
    if (err) {
      return console.log(err);
    }
	});
}

module.exports = { trace, renewLog };
