const assert = require('assert');
const xlsx = require('xlsx');
const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  port: 5432,
  user: 'ekatte',
  password: 'ekatte',
  database: 'ekatte'
});

const provincesFile = xlsx.readFile('ekatte_xls/Ek_obl.xls');
assert.strictEqual(provincesFile instanceof Object, true, 'File is not read as a Workbook');
assert.strictEqual(provincesFile.Sheets instanceof Object, true, 'Object \'provincesFile\' does not have an object property \'Sheets\'');
assert.strictEqual(provincesFile.Sheets.Ek_obl instanceof Object, true, 'Object \'Sheets\' does not have an object property \'Ek_obl\'');
const provincesFileParsed = xlsx.utils.sheet_to_json(provincesFile.Sheets.Ek_obl);

const municipalitiesFile = xlsx.readFile('ekatte_xls/Ek_obst.xls');
assert.strictEqual(municipalitiesFile instanceof Object, true, 'File is not read as a Workbook');
assert.strictEqual(municipalitiesFile.Sheets instanceof Object, true, 'Object \'municipalitiesFile\' does not have an object property \'Sheets\'');
assert.strictEqual(municipalitiesFile.Sheets.Ek_obst instanceof Object, true, 'Object \'Sheets\' does not have an object property \'Ek_obst\'');
const municipalitiesFileParsed = xlsx.utils.sheet_to_json(municipalitiesFile.Sheets.Ek_obst);

const ekattesFile = xlsx.readFile('ekatte_xls/Ek_atte.xls');
assert.strictEqual(ekattesFile instanceof Object, true, 'File is not read as a Workbook');
assert.strictEqual(ekattesFile.Sheets instanceof Object, true, 'Object \'ekattesFile\' does not have an object property \'Sheets\'');
assert.strictEqual(ekattesFile.Sheets.Ek_atte instanceof Object, true, 'Object \'Sheets\' does not have an object property \'Ek_atte\'');
const ekattesFileParsed = xlsx.utils.sheet_to_json(ekattesFile.Sheets.Ek_atte);
ekattesFileParsed.shift(); // first row is not valid data

client.connect().then(() => {
  console.log('Successfully connected to database');
  return client.query(`INSERT INTO municipalities
    (id, category, document)
  SELECT * FROM UNNEST ($1::TEXT[], $2::INT[], $3::TEXT[]);`,
  [
    municipalitiesFileParsed.map(row => row.obstina),
    municipalitiesFileParsed.map(row => parseInt(row.category)),
    municipalitiesFileParsed.map(row => row.document)
  ]
  );
}).then(() => {
  console.log('Inserted municipalities');
  return client.query(`INSERT INTO provinces
    (id, region, document)
  SELECT * FROM UNNEST ($1::TEXT[], $2::TEXT[], $3::TEXT[]);`,
  [
    provincesFileParsed.map(row => row.oblast),
    provincesFileParsed.map(row => row.region),
    provincesFileParsed.map(row => row.document)
  ]
  );
}).then(() => {
  console.log('Inserted provinces');
  return client.query(`INSERT INTO ekattes
      (id, kind, name, province_id, municipality_id, municipal_gov_id, category, altitude_code, tsb, document)
    SELECT * FROM UNNEST ($1::TEXT[], $2::INT[], $3::TEXT[], $4::TEXT[], $5::TEXT[], $6::TEXT[], $7::INT[], $8::INT[], $9::TEXT[], $10::TEXT[]);`,
  [
    ekattesFileParsed.map(row => row.ekatte),
    ekattesFileParsed.map(row => parseInt(row.kind)),
    ekattesFileParsed.map(row => row.name),
    ekattesFileParsed.map(row => row.oblast),
    ekattesFileParsed.map(row => row.obstina),
    ekattesFileParsed.map(row => row.kmetstvo),
    ekattesFileParsed.map(row => parseInt(row.category)),
    ekattesFileParsed.map(row => parseInt(row.altitude)),
    ekattesFileParsed.map(row => row.tsb),
    ekattesFileParsed.map(row => row.document)
  ]
  );
}).then(() => {
  console.log('Inserted ekattes');
  return client.query(`INSERT INTO municipality_ekattes
    (ekatte_id, municipality_id)
  SELECT * FROM UNNEST ($1::TEXT[], $2::TEXT[]);`,
  [
    municipalitiesFileParsed.map(row => row.ekatte),
    municipalitiesFileParsed.map(row => row.obstina)
  ]
  );
}).then(() => {
  console.log('Inserted municipality_ekattes');
  return client.query(`INSERT INTO province_ekattes
    (ekatte_id, province_id)
  SELECT * FROM UNNEST ($1::TEXT[], $2::TEXT[]);`,
  [
    provincesFileParsed.map(row => row.ekatte),
    provincesFileParsed.map(row => row.oblast)
  ]
  );
}).then(() => {
  console.log('Success!');
  process.exit();
}).catch(error => {
  console.error(error);
});
