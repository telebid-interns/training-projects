var express = require('express');
var router = express.Router();
const pg = require('pg');
var passwordHash = require('password-hash');
var sqlFormatter = require('pg-format');

//login, data

var isAdmin = false;
var isLoggedIn = false;
var loggedInUserId = '';
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
    let number = 0;
    prods.rows.forEach((prod)=>{
      prod.number = ++number;
      products.push(prod);
    });
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
  isAdmin = false;
  username = 'Guest';  
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
        let newUserId = generateId();
        client.query(sqlFormatter("insert into accounts (id, email, name, pass, role) values(%L, %L, %L, %L, '1');", newUserId, email, name, hashedPass))
        .then(()=>{
          client.query(sqlFormatter("insert into shopping_carts (id, userId) values(%L, %L)", generateId(), newUserId))
          .then(()=>{
            res.redirect(303, '/login');
          });
        })
        .catch(e => console.error(e.stack));
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
            loggedInUserId = account.id;
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

/* GET check page. */
router.get('/check', function(req, res, next) {
  if(!isAdmin){
    res.redirect(303, '/');
  }
  let purchases = [];
  let count = 1;
  client.query(sqlFormatter("select p.date, p.id, a.name, st.name as state from accounts as a join purchases as p on a.id = p.userid join states as st on st.id = p.state order by state asc, p.date asc"))
  .then((data)=>{
    data.rows.forEach((row)=>{
      row.number = count++;
      purchases.push(row);
    });
    res.render('check', {data:{'isLoggedIn': isLoggedIn,'user': username, 'isAdmin': isAdmin, 'purchases': purchases}});  
  });
});

/* GET check:id page. */
router.get('/check/:id', function(req, res, next) {
  if(!isAdmin){
    res.redirect(303, '/');
  }
  let purchId = req.params.id;
  
  let currentCart = [];

  client.query(sqlFormatter('select pr.name, sum(pi.quantity) as quantity, pr.price, pr.id from purchase_items as pi join purchases as pur on pi.purchaseId = pur.id join products as pr on pr.id = pi.prodid where pur.id = %L group by pr.name, pr.price, pr.id order by pr.name asc', purchId))
  .then((data)=>{
    let totalPrice = 0;
    let count = 1;
    data.rows.forEach((row)=>{
      totalPrice += (Number(row.price) * Number(row.quantity)); 
      row.number = count++;
      currentCart.push(row);
    });
    res.render('purchases', {data:{'isLoggedIn': isLoggedIn,'user': username, 'isAdmin': isAdmin, 'cart': currentCart, 'total': totalPrice}});
  });
});

/* POST check page. */
router.post('/check/:id', function(req, res, next) {
  if(!isAdmin){
    res.redirect(303, '/');
  }

  let purchID = req.params.id;
  let newState = req.body.state;

  client.query(sqlFormatter("update purchases set state = %L where id = %L", newState, purchID))
  .then(res.redirect(303, '/check'));
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

/* GET cart page. */
router.get('/cart', function(req, res, next) {
  if(!isLoggedIn){
    res.redirect(303, '/');
  }
  let currentCart = [];

  client.query(sqlFormatter('select pr.name, sum(ci.quantity) as quantity, pr.price, pr.id from cart_items as ci join shopping_carts as sc on ci.cartId = sc.id join accounts as a on a.id = sc.userId join products as pr on pr.id = ci.prodId where a.id = %L group by pr.name, pr.price, pr.id order by pr.name asc', loggedInUserId))
  .then((data)=>{
    let totalPrice = 0;
    let count = 1;
    data.rows.forEach((row)=>{
      totalPrice += (Number(row.price) * Number(row.quantity)); 
      row.number = count++;
      row.price = parseFloat(Math.round(row.quantity * row.price * 100) / 100).toFixed(2);;
      currentCart.push(row);
    });
    let fixedPrice = parseFloat(Math.round(totalPrice * 100) / 100).toFixed(2);
    res.render('cart', {data:{'isLoggedIn': isLoggedIn,'user': username, 'isAdmin': isAdmin, 'cart': currentCart, 'total': fixedPrice}});
  });
});

/* GET edit page. */
router.get('/edit/:id', function(req, res, next) {
  if(!isAdmin){
    res.redirect(303, '/');
  }
  let productId = req.params.id;
  client.query(sqlFormatter("select p.name, p.price, p.quantity from products as p where p.id = %L", productId))
  .then((data)=>{
    let row = data.rows[0];
    let name = row.name;
    let price = row.price;
    let quantity = row.quantity;

    res.render('edit', {data:{'isLoggedIn': isLoggedIn,'user': username, 'isAdmin': isAdmin, 'name': name, 'price': price, 'quantity': quantity}});
  });
});

//get delete product
router.get('/delete/:id', function(req,res){
  if(!isAdmin){
    res.redirect(303, '/');
  }
  let id = req.params.id;
  client.query(sqlFormatter("delete from products as p where p.id = %L", id));
  res.redirect(303, '/');
});

//get remove product from cart
router.get('/remove/cart/:id', function(req,res){
  if(!isLoggedIn){
    res.redirect(303, '/');
  }
  let id = req.params.id;
  client.query(sqlFormatter("delete from cart_items as ci using shopping_carts as sc where ci.cartid = sc.id and ci.prodid = %L and sc.userid = %L", id, loggedInUserId))
  .then(res.redirect(303, '/cart'));
});


/* POST edit page. */
router.post('/edit/:id', function(req, res, next) {
  if(!isAdmin){
    res.redirect(303, '/');
  }
  let productId = req.params.id;
  let name = req.body.name;
  let price = req.body.price;
  let quant = req.body.quant;

  client.query(sqlFormatter("update products set name = %L, price = %L, quantity = %L where id = %L;", name, price, quant, productId))
  .then(res.redirect(303, '/'));
});

/* POST add to cart. */
router.post('/addtocart', function(req, res) {
  let id = req.body.id;
  let quant = req.body.quant;

  client.query(sqlFormatter("select id from shopping_carts where userid = %L;",  loggedInUserId)).then((data)=>{
    let cartId = data.rows[0].id;
    client.query(sqlFormatter("insert into cart_items values(%L, %L, %L, %L);", generateId(), id, quant, cartId))
    .catch(e => console.error(e.stack));
  });
});

/* POST remove from cart. */
router.post('/remove', function(req, res) {
  let itemId = req.body.id;

  client.query(sqlFormatter("delete from cart_items as ci using shopping_carts as sc where ci.cartid = sc.id and ci.prodId = %L and sc.userid = %L",  itemId, loggedInUserId));
});

/* POST cart (buy). */
router.post('/cart', function(req, res) {
  let pass = true;
  //get user prods
  client
  .query(sqlFormatter("select pr.id, ci.quantity, pr.quantity as max from cart_items as ci join products as pr on ci.prodid = pr.id join shopping_carts as sc on ci.cartid = sc.id where sc.userid = %L;", loggedInUserId))
  .then((data)=>{
    //check if cart empty todo
    if(data.rows.length === 0){
      pass = false;
    }
    data.rows.forEach((row)=>{
      if(row.quantity > row.max){
        pass = false;
      }
    });

    if(pass){
      data.rows.forEach((row)=>{
        //row.max = row.max - row.quant
        let newQuantity = row.max - row.quantity;
        client.query(sqlFormatter("update products set quantity = %L where id = %L", newQuantity, row.id));
      });
      //make a purchase
      let currentPurchaseId = generateId();
      client.query(sqlFormatter("insert into purchases values(%L, %L, 0, %L)", currentPurchaseId, loggedInUserId, getDate()));

      data.rows.forEach((row)=>{
        //add products to purchase
        client.query(sqlFormatter("insert into purchase_items values(%L, %L, %L, %L)", generateId(), row.id, currentPurchaseId, row.quantity));
      });
    }
  })
  .then(()=>{
    if(pass){
      //cart clean up
      client.query(sqlFormatter("delete from cart_items as ci using shopping_carts as sc where ci.cartid = sc.id and sc.userid = %L", loggedInUserId))
      .then(res.redirect(303, '/'));  
    }else{
      res.redirect(303, '/cart');
    }
  });
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

function getDate(){
  var today = new Date();
  var dd = today.getDate();
  var mm = today.getMonth()+1; //January is 0!
  var yyyy = today.getFullYear();

  if(dd<10) {
      dd = '0'+dd
  } 

  if(mm<10) {
      mm = '0'+mm
  } 

  today = dd + '-' + mm + '-' + yyyy;
  return today;
}

module.exports = router;
