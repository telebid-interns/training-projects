module.exports = (() => {
  const sqlite = require('sqlite');
  const { assertApp } = require('./error-handling');
  let db;

  async function dbConnect () {
    db = await sqlite.open('./freefall.db');
  }

  function stringifyColumns (columns) {
    assertApp(
      columns instanceof Array &&
      columns.length > 0,
      'Invalid argument columns.'
    );

    return columns.join(', ');
  }

  function select (columns, table) {
    assertApp(
      typeof table === 'string',
      'Expected string for a name of table'
    );

    return db.all(`SELECT ${stringifyColumns(columns)} FROM ${table};`);
  }

  return {
    select,
    dbConnect
  };
})();
