const sqlite = require('sqlite');

let db;

async function connect () {
  db = await sqlite.open('./src/database/forecast.db');
  console.log('connected');
}

const select = (table, where, { one, like, count }) => {
  if (one == null) one = false;
  if (like == null) like = false;
  if (count == null) count = false;

  console.log(one);
  console.log(like);
  console.log(count);

  let selectValue = count ? 'COUNT(*) as count' : '*';
  let operator = like ? 'LIKE' : '=';

  const whereKeys = Object.keys(where);
  const whereValues = Object.values(where);

  let whereStatement = '';


  let first = true;
  for (const key of whereKeys) {
    if (first) {
      whereStatement += `WHERE ${key} ${operator} ?`;
      first = false;
    } else {
      whereStatement += ` AND ${key} ${operator} ?`;
    }
  }

  const wholeStatement = `SELECT ${selectValue} FROM ${table} ${whereStatement}`;

  console.log(selectValue);
  console.log(wholeStatement);

  if (one) {
    return db.get(wholeStatement, whereValues);
  }

  return db.all(wholeStatement, whereValues);
}

const insert = (table, data) => {
  const columns = Object.keys(data);
  const values = Object.values(data);

  const wholeStatement = `
    INSERT INTO ${table} (${columns.join(', ')})
    VALUES (${values.map((v) => '?').join(', ')})`;

  return db.run(wholeStatement, values);
}

// TODO FINISH UPDATE

// const update = (table, data, where) => {
// //   const columns = Object.keys(data);
// //   const values = Object.values(data);

// }

// const update = (table, data, where) => {
//   const whereKeys = Object.keys(where);
//   const whereValues = Object.values(where);

//   let whereStatement = '';

//   let first = true;
//   for (const key of whereKeys) {
//     if (first) {
//       whereStatement += `WHERE ${key} = ?`;
//       first = false;
//     } else {
//       whereStatement += ` AND ${key} = ?`;
//     }
//   }

//   const wholeStatement = `DELETE FROM ${table} ${whereStatement}`;

//   return db.run(wholeStatement, whereValues);
// }


const del = (table, where) => {
  const whereKeys = Object.keys(where);
  const whereValues = Object.values(where);

  let whereStatement = '';

  let first = true;
  for (const key of whereKeys) {
    if (first) {
      whereStatement += `WHERE ${key} = ?`;
      first = false;
    } else {
      whereStatement += ` AND ${key} = ?`;
    }
  }

  const wholeStatement = `DELETE FROM ${table} ${whereStatement}`;

  return db.run(wholeStatement, whereValues);
}

module.exports = { connect, update, select, insert, del };
