module.exports = (() => {
  const sqlite = require('sqlite');
  const { assertApp } = require('./error-handling');
  const isObject = require('./is-object');
  let db;

  async function dbConnect () {
    db = await sqlite.open('./freefall.db');
  }

  function assertDB () {
    assertApp(
      isObject(db) &&
      isObject(db.driver) &&
      db.driver.open,
      'No database connection.'
    );
  }

  function stringifyColumns (columns) {
    assertApp(
      columns instanceof Array &&
      columns.length > 0,
      'Invalid argument columns.'
    );

    return columns.join(', ');
  }

  async function select (table, columns) {
    assertDB();
    assertApp(
      typeof table === 'string',
      'Expected string for a name of table'
    );

    return db.all(`SELECT ${stringifyColumns(columns)} FROM ${table};`);
  }

  async function insert (table, columns, rows) {
    assertDB();
    assertApp(
      typeof table === 'string' &&
      Array.isArray(columns) &&
      columns.length > 0 &&
      columns.every((col) => typeof col === 'string') &&
      Array.isArray(rows) &&
      rows.length > 0 &&
      rows.every((row) => Array.isArray(row) && row.length === columns.length),
      'Invalid insert data.'
    );

    const columnsStringified = columns.join(', ');
    const rowStringified = Array(columns.length).fill('?').join(', ');
    const rowsStringified = Array(rows.length).fill(rowStringified).join('), (');

    return db.run(`INSERT INTO ${table} (${columnsStringified}) VALUES (${rowsStringified});`, [].concat(...rows));
  }

  async function createNewDataFetch () {
    assertDB();

    return db.run('INSERT INTO data_fetches(timestamp) VALUES (strftime(\'%Y-%m-%dT%H:%M:%SZ\' ,\'now\'));');
  }

  return {
    select,
    insert,
    createNewDataFetch,
    dbConnect
  };
})();
