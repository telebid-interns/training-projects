const db = require('./../database/pg_db.js');

resetAPIKeys();

function resetAPIKeys () {
  db.sql(`UPDATE api_keys SET use_count = 0`);
}
