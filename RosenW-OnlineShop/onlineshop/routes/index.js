var express = require('express');
var router = express.Router();
const pg = require('pg');
var passwordHash = require('password-hash');
// Database connection

const client = new pg.Client({
  user: 'postgres',
  host: 'localhost',
  database: 'online_shop_db',
  password: '1234',
  port: 5432
});
client.connect();

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', {});
});

/* GET registration page. */
router.get('/registration', function(req, res, next) {
  res.render('registration', {});
});

/* GET login page. */
router.get('/login', function(req, res, next) {
  res.render('login', {});
});

/* POST registration page */
router.post('/registration', function(req, res) {
  client.query("insert into accounts (id, email, name, pass, role) values('" + generateId() + "', '" + req.body.demail + "', '"+ req.body.dname + "', '"+passwordHash.generate(req.body.password)+"', '1');")
            .catch(e => console.error(e.stack));
  res.redirect(303, '/login');
});

/* POST login page */
router.post('/login', function(req, res) {
  console.log(res.name);
  console.log(res.password);
  res.redirect(303, '/');
});

function generateId() {
  var S4 = function() {
     return (((1+Math.random())*0x10000)|0).toString(16).substring(1);
  };
  return (S4()+S4()+"-"+S4()+"-"+S4()+"-"+S4()+"-"+S4()+S4()+S4());
}

module.exports = router;
