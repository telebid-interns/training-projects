var express = require('express');
var router = express.Router();
const pg = require('pg');
var passwordHash = require('password-hash');
var sqlFormatter = require('pg-format');

//login, data

var isAdmin = false;
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
  let products = [];
  client.query("select * from products as p order by p.name").then((prods)=>{
    prods.rows.forEach((prod)=>{
      products.push(prod);
    });
    console.log(products);
    res.render('index', {data:{'isLoggedIn': isLoggedIn,'user': username, 'isAdmin': isAdmin, 'prods': products}});
  })
});

/* GET registration page. */
router.get('/register', function(req, res, next) {
  if(isLoggedIn){
    res.redirect(303, '/');
  }
  res.render('registration', {data:{'isLoggedIn': isLoggedIn,'user': username, 'isAdmin': isAdmin}});
});

/* GET login page. */
router.get('/login', function(req, res, next) {
  if(isLoggedIn){
    res.redirect(303, '/');
  }
  res.render('login', {data:{'isLoggedIn': isLoggedIn,'user': username, 'isAdmin': isAdmin}});
});

/* GET logout. */
router.get('/logout', function(req, res, next) {
  isLoggedIn = false;
  username = 'Guest';  
  isAdmin = false;
  res.redirect(303, '/');
});

/* POST registration page */
router.post('/register', function(req, res) {
  let email = req.body.demail;
  let name = req.body.dname;
  let pass = req.body.password;
  let cpass = req.body.cpassword;
  let stop = false;

  //check if username/email exist
  client.query("select * from accounts").then((accs)=>{
    accs.rows.forEach((acc)=>{
      if(acc.name.toLowerCase() == name.toLowerCase() || acc.email.toLowerCase() == email.toLowerCase()){
        //todo show error message ?
        console.log('err');
        res.redirect(303, '/register');
        stop = true;
      }
    });
  }).then(()=>{
    if(!stop){
      let hashedPass = passwordHash.generate(pass);
      if(validateEmail(email) && validateName(name) && validatePass(pass) && pass === cpass){
        client.query(sqlFormatter("insert into accounts (id, email, name, pass, role) values(%L, %L, %L, %L, '1');", generateId(), email, name, hashedPass))
        .catch(e => console.error(e.stack));
        res.redirect(303, '/login');
      }else{
        res.redirect(303, '/register');
      }
    }
  })
  .catch(e => console.error(e.stack));
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
            console.log(account.role);
            if(account.role == 2){
              isAdmin = true;
            }
            res.redirect(303, '/');
          }else{
            //req.flash("error", "Wrong Password"); TODO 
            return res.render('login', {data:{'isLoggedIn': isLoggedIn,'user': username, 'isAdmin': isAdmin}});
          }
        }
      });
      if(!foundUser){
        //req.flash("error", "No such user"); TODO
            return res.render('login', {data:{'isLoggedIn': isLoggedIn,'user': username, 'isAdmin': isAdmin}});
      }
    })
    .catch(e => console.error(e.stack));
});

/* GET add prod page. */
router.get('/add', function(req, res, next) {
  if(!isAdmin){
    res.redirect(303, '/');
  }
  res.render('add', {data:{'isLoggedIn': isLoggedIn,'user': username, 'isAdmin': isAdmin}});
});

/* POST add prod page. */
router.post('/add', function(req, res) {
  let name = req.body.name;
  let price = req.body.price;
  let quant = req.body.quant;

  client.query(sqlFormatter("insert into products values(%L, %L, %L, %L);", generateId(), name, price, quant))
        .catch(e => console.error(e.stack));

  res.redirect(303, '/');
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
