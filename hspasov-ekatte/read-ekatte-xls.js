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

if (provincesFileParsed === municipalitiesFileParsed && municipalitiesFileParsed === ekattesFileParsed) {
  console.log('done');
}

client.connect().then(() => {
  console.log(ekattesFileParsed);
  console.log('successfully connected');
  
}).catch(error => {
  console.error(error);
});
