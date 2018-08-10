const pg = require('pg');
const client = new pg.Client({
  user: 'postgres',
  host: 'localhost',
  database: 'forecast',
  password: '1234',
  port: 5432,
});

client.connect();

const query = async (sql, ...values) => {
  return (await client.query(sql, values)).rows;
};

const select = async (table, where, { one, like, count, or }) => {
  if (or == null) or = false;
  if (one == null) one = false;
  if (like == null) like = false;
  if (count == null) count = false;

  const operator = like ? 'LIKE' : '=';
  let whereStatement = '';

  let first = true;
  let index = 0;
  for (const col of Object.keys(where)) {
    if (first) {
      whereStatement += `WHERE ${col} ${operator} $${++index}`;
      first = false;
    } else {
      whereStatement += ` ${or ? 'OR' : 'AND'} ${col} ${operator} $${++index}`;
    }
  }

  const wholeStatement = `
      SELECT ${ count ? 'COUNT(*) as count' : '*' }
      FROM ${table}
      ${whereStatement}
    `;

  if (one) {
    return (await client.query(wholeStatement, Object.values(where))).rows[0];
  }

  return (await client.query(wholeStatement, Object.values(where))).rows;
};

const insert = async (table, data) => {
  const wholeStatement = `
      INSERT INTO ${table} (${Object.keys(data).join(', ')})
      VALUES (${Object.values(data).map((v, index) => `$${index + 1}`).join(', ')})
    `;

  return client.query(wholeStatement, Object.values(data));
};

const del = async (table, where) => {
  const whereStatement = buildWhereStatement(Object.keys(where));
  const wholeStatement = `DELETE FROM ${table} ${whereStatement}`;

  return client.query(wholeStatement, Object.values(where));
};

const update = async (table, updateData, where) => {
  let index = 0;

  const updateStatement = Object.keys(updateData).map((key) => `${key} = $${++index}`).join(', ');
  const whereStatement = buildWhereStatement(Object.keys(where), '=', index);
  const wholeStatement = `
      UPDATE ${table}
      SET ${updateStatement}
      ${whereStatement}
    `;

  return client.query(wholeStatement, Object.values(updateData).concat(Object.values(where)));
};

const close = async () => {
  await client.end();
};

const buildWhereStatement = (whereKeys, operator = '=', index = 0) => {
  let whereStatement = '';
  let first = true;
  for (const key of whereKeys) {
    if (first) {
      whereStatement += `WHERE ${key} ${operator} $${++index}`;
      first = false;
    } else {
      whereStatement += ` AND ${key} ${operator} $${++index}`;
    }
  }
  return whereStatement;
}

module.exports = {
  select,
  update,
  insert,
  del,
  query,
  close,
  client
};
