const sqlite = require('sqlite');
let db;

// TODO error handling
async function connect () {
	db = await sqlite.open('./src/database/forecast.db');
};

function insert () {
	// TODO implement
};

async function query (query) {
	return await db.get(query);
};

function update () {
	// TODO implement
};

function select () {
	// TODO implement
};

module.exports = {
	connect,
	insert,
	select,
	query,
	update
};
