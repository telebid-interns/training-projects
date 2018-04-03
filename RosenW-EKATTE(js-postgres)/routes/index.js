var express = require('express');
var router = express.Router();
const pg = require('pg');
var areas = require('../jsons/areas.json');
var munic = require('../jsons/municipalities.json');
var settlements = require('../jsons/settlements.json');

// Database connection
const connectionString = 'postgresql://postgres:1234@localhost:5432/ekatte_db';

const client = new pg.Client({
  user: 'postgres',
  host: 'localhost',
  database: 'ekatte_db',
  password: '1234',
  port: 5432,
});
client.connect();

/* GET home page. */
router.get('/', function(req, res, next) {
  var settlements = [];
  client.query('select * from selishta')
  .then(data => {
    data.rows.forEach((row)=>{
      settlements.push(row.name);
    });
    res.render('index', { 'settlements': settlements});
  })
  .catch(e => console.error(e.stack));
});

router.get('/insert', function(req, res, next) {
  insertDataIntoDB();
  res.render('index', { 'settlements': 'done'});
});

function insertDataIntoDB(){
  console.log(munic);
  console.log(settlements);
}

module.exports = router;
