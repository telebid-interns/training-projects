var express = require('express');
var router = express.Router();
const pg = require('pg');
var passwordHash = require('password-hash');

//login, data

var isLoggedIn = false;
var username = 'Guest';

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
  res.render('index', {data:{'isLoggedIn': isLoggedIn,'user': username}});
});

/* GET registration page. */
router.get('/registration', function(req, res, next) {
  res.render('registration', {data:{'isLoggedIn': isLoggedIn,'user': username}});
});

/* GET login page. */
router.get('/login', function(req, res, next) {
  res.render('login', {data:{'isLoggedIn': isLoggedIn,'user': username}});
});

/* POST registration page */
router.post('/registration', function(req, res) {
  let email = req.body.demail;
  let name = req.body.dname;
  let pass = req.body.password;
  let cpass = req.body.cpassword;
  let hashedPass = passwordHash.generate(pass);
  if(validateEmail(email) && validateName(name) && validatePass(pass) && pass === cpass){
    client.query("insert into accounts (id, email, name, pass, role) values('" + generateId() + "', '" + email + "', '"+ name + "', '"+hashedPass+"', '1');")
    .catch(e => console.error(e.stack));
    res.redirect(303, '/login');
  }else{
    res.redirect(303, '/registration');
  }
});

/* POST login page */
router.post('/login', function(req, res) {
  let name = req.body.dname;
  let pass = req.body.password;
  let foundUser = false;

  client
    .query("select * from accounts")
    .then((accounts)=>{
      accounts.rows.forEach((account)=>{
        if(account.name === name){
          foundUser = true;
          if(passwordHash.verify(pass, account.pass)){
            isLoggedIn = true;
            username = account.name;
            res.redirect(303, '/');
          }else{
            //req.flash("error", "Wrong Password"); TODO 
            return res.render('login');
          }
        }
      });
      if(!foundUser){
        //req.flash("error", "No such user"); TODO
            return res.render('login');
      }
    })
    .catch(e => console.error(e.stack));
    
});

function generateId() {
  var S4 = function() {
     return (((1+Math.random())*0x10000)|0).toString(16).substring(1);
  };
  return (S4()+S4()+"-"+S4()+"-"+S4()+"-"+S4()+"-"+S4()+S4()+S4());
}

function validateEmail(email) {
  var reg = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return reg.test(String(email).toLowerCase());
}

function validateName(name){
  var reg = /^(\w{6,})$/;
  return reg.test(String(name).toLowerCase());
}

function validatePass(pass){
  var reg = /^(\w{6,})$/;
  return reg.test(String(pass).toLowerCase());
}

module.exports = router;
