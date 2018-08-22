const { Pool } = require('pg');
const { AppError } = require('./../asserts/exceptions.js');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'forecast',
  password: '1234',
  port: 5432,
});

pool.on('error', (err, client) => {
  throw new AppError(`Unexpected error on idle client: ${err}`, 17);
});

const sql = async (sql, ...values) => {
  assert(typeof sql === 'string', `sql expected to be string but was: ${typeof sql}`);
  const client = await pool.connect();
  try {
    return (await client.query(sql, values)).rows;
  } catch (err) {
    throw new AppError(`Error while querying: ${err}`, 18);
  } finally {
    client.release();
  }
};

async function makeTransaction (func) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log('BEGIN');
    await func(client);
    await client.query('COMMIT');
    console.log('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    console.log('ROLLBACK');
    throw new AppError(`Error while making a transaction: ${err}`, 19);
  } finally {
    client.release();
  }
}

module.exports = {
  sql,
  makeTransaction
};
