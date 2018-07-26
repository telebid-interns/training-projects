let pg = require('pg');
// Database connection
const client = new pg.Client({
    user: 'postgres',
    host: 'localhost',
    database: 'forecast',
    password: '1234',
    port: 5432
});
client.connect();

const select = async (table, where, { one, like, count, or }) => {
  // if (db == null) {
  //   await init();
  // }

  if (or == null) or = false;
  if (one == null) one = false;
  if (like == null) like = false;
  if (count == null) count = false;

  const whereKeys = Object.keys(where);
  const whereValues = Object.values(where);

  const selectValue = count ? 'COUNT(*) as count' : '*';
  const operator = like ? 'LIKE' : '=';
  // TODO choose a name
  // const operator = or ? 'OR' : 'AND';

  let whereStatement = '';

  let first = true;
  let index = 0;
  for (const key of whereKeys) {
    if (first) {
      whereStatement += `WHERE ${key} ${operator} $${++index}`;
      first = false;
    } else {
      whereStatement += ` ${ or ? 'OR' : 'AND' } ${key} ${operator} $${++index}`;
    }
  }

  const wholeStatement = `SELECT ${selectValue} FROM ${table} ${whereStatement}`;

  console.log(wholeStatement);

  if (one) {
    return (await client.query(wholeStatement, whereValues)).rows[0];
  }

  return (await client.query(wholeStatement, whereValues)).rows;
}

const insert = async (table, data) => {
  const columns = Object.keys(data);
  const values = Object.values(data);

  const wholeStatement = `
    INSERT INTO ${table} (${columns.join(', ')})
    VALUES (${values.map((v, index) => `$${++index}`).join(', ')})`;

  console.log(wholeStatement);

  return client.query(wholeStatement, values);
}

const del = async (table, where) => {
  const whereKeys = Object.keys(where);
  const whereValues = Object.values(where);

  let whereStatement = '';

  let first = true;
  let index = 0;
  for (const key of whereKeys) {
    if (first) {
      whereStatement += `WHERE ${key} = $${++index}`;
      first = false;
    } else {
      whereStatement += ` AND ${key} = $${++index}`;
    }
  }

  const wholeStatement = `DELETE FROM ${table} ${whereStatement}`;

  console.log(wholeStatement);

  return client.query(wholeStatement, whereValues);
}

const update = async (table, updateData, where) => {
  const updateKeys = Object.keys(updateData);
  const updateValues = Object.values(updateData);

  const whereKeys = Object.keys(where);
  const whereValues = Object.values(where);

  let index = 0;
  const updateStatement = updateKeys.map((key) => `${key} = $${++index}`).join(', ');

  let whereStatement = '';

  let first = true;
  for (const key of whereKeys) {
    if (first) {
      whereStatement += `WHERE ${key} = $${++index}`;
      first = false;
    } else {
      whereStatement += ` AND ${key} = $${++index}`;
    }
  }

  const wholeStatement = `UPDATE ${table} SET ${updateStatement} ${whereStatement}`;

  console.log(wholeStatement);

  return client.query(wholeStatement, updateValues.concat(whereValues));
}

const query = async (sql, values) => {
  return client.query(sql, values);
}

module.exports = {
    select,
    update,
    insert,
    del,
    query
  };
