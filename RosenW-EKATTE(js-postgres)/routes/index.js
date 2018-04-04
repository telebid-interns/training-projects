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
  var municipalities = [];
  var areas = [];
  client.query('select * from selishta')
  .then(data => {
    data.rows.forEach((row)=>{
      var curSettlement = {}
      curSettlement['name'] = row.name;
      curSettlement['municipality'] = row.municipality_id;
      settlements.push(curSettlement);
    });
    client.query('select * from obshtini').then(data => {
      data.rows.forEach((row)=>{
        var curMunic = {}
        curMunic['id'] = row.id;
        curMunic['name'] = row.name;
        curMunic['area'] = row.area_id;
        municipalities.push(curMunic);
      });
      client.query('select * from oblasti')
      .then(data => {
        data.rows.forEach((row)=>{
          var curArea = {}
          curArea['id'] = row.id;
          curArea['name'] = row.name;
          areas.push(curArea);
        });
        res.render('index', { data: {settlements, municipalities, areas}});
      });
    });
  })
  .catch(e => console.error(e.stack));
});

router.get('/insert', function(req, res, next) {
  insertDataIntoDB();
  res.render('index', { 'data': 'done'});
});

function insertDataIntoDB(){
  areas.Ek_obl.forEach((area)=>{
    var areaId = area[0];
    var areaName = area[2];
    if(areaId.length === 3){
    client.query("insert into oblasti (id, name) values('" + areaId + "', '"+ areaName + "');")
    .then(()=>{
      munic.Ek_obst.forEach((munic)=>{
        if(areaId === getAreaByMunicipId(munic[0])){
        var municId = munic[0];
        var municName = munic[2];
        client.query("insert into obshtini (id, name, area_id) values('" + municId + "', '"+ municName + "', '"+getAreaByMunicipId(municId)+"');")
        .then(()=>{
          settlements.Ek_atte.forEach((settlement)=>{
          if(municId === settlement[4]){
            var settlementId = settlement[0];
            var settlementName = settlement[2];
            var curMunicId = settlement[4];
            client.query("insert into selishta (id, name, municipality_id) values('" + settlementId + "', '"+ settlementName + "', '"+curMunicId+"');")
            .catch(e => console.error(e.stack));
            }
          });
        })
        .catch(e => console.error(e.stack));
      }
      });
    })
    .catch(e => console.error(e.stack));
    }
  });
}

function getAreaByMunicipId(id){
  return id.substr(0,3);
}
function getMunicipById (id){
  client.query("select name from obshtini where id = "+id)
  .then((selectedId) => {
    console.log(selectedId);
    res.render('index', { 'data': settlements});
  })
  .catch(e => console.error(e.stack));
}

module.exports = router;
