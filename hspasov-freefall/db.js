module.exports = (async () => {
  const sqlite = require('sqlite');
  const { assertApp } = require('./error-handling');

  const db = await sqlite.open('./freefall.db');

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
      table instanceof 'string',
      'Expected string for a name of table'
    );
    return db.all(`SELECT ${stringifyColumns(columns)} FROM ${table};`);
  }

  return {
    select
  };
})();
