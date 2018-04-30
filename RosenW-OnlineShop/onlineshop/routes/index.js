let express = require('express');
let nodemailer = require('nodemailer');
let passwordHash = require('password-hash');
let sqlFormatter = require('pg-format');
let pg = require('pg');
let router = express.Router();
let Recaptcha = require('express-recaptcha').Recaptcha;
let $ = require('jquery');
let request = require('request');
let braintree = require('braintree');
let Printer = require('node-printer');
let bixolon = new Printer('BIXOLON-SRP-350II');
let fs = require('fs');
let PDFDocument = require('pdfkit');

//set up printer
// let text = 'Lorem ipsum dolor sit amet, consectetur adipiscing '+
// 'elit. Quisque sagittis euismod quam vitae porta. In porta luctus '+
// 'augue id auctor. Nunc tincidunt, leo at ultricies auctor, lacus est '+
// 'gravida ante, eget porttitor lectus nisl eget felis. In quis turpis tempus,'+
// ' iaculis eros id, mattis elit. Suspendisse et rhoncus libero, a dapibus neque. '+
// 'Fusce dolor est, viverra semper risus dictum, condimentum tincidunt metus.'+
// ' Curabitur sed malesuada leo. Nunc tempor nec metus eget euismod.';
// let textJob = bixolon.printText(text);
// console.log(textJob);
// let doc = new PDFDocument();
// doc.pipe(fs.createWriteStream('/home/rosen/Desktop/repo/RosenW-OnlineShop/onlineshop/public/PDFs/mypdf.pdf')); 
// doc.fontSize(25)
//    .text('Some text with an embedded font!', 100, 100);

// doc.end();
// console.log('done');
// let fileBuffer = fs.readFileSync('/home/rosen/Desktop/repo/RosenW-OnlineShop/onlineshop/public/PDFs/mypdf.pdf');
// let jobFromBuffer = bixolon.printBuffer(fileBuffer);

//credit card payment keys
let merchId = '9mjmz4gm33rrmbd2';
let publicKey = 'yy9fyqg8m8yqdrhs';
let privateKey = '955e3451756ce5f6ab95eb47ce159245';

let gateway = braintree.connect({
  environment: braintree.Environment.Sandbox,
  merchantId: merchId,
  publicKey: publicKey,
  privateKey: privateKey
});

gateway.config.timeout = 10000;

//set up merchant account

merchantAccountParams = {
  individual: {
    firstName: "Jane",
    lastName: "Doe",
    email: "jane@14ladders.com",
    phone: "5553334444",
    dateOfBirth: "1981-11-19",
    ssn: "456-45-4567",
    address: {
      streetAddress: "111 Main St",
      locality: "Chicago",
      region: "IL",
      postalCode: "60622"
    }
  },
  business: {
    legalName: "Jane's Ladders",
    dbaName: "Jane's Ladders",
    taxId: "98-7654321",
    address: {
      streetAddress: "111 Main St",
      locality: "Chicago",
      region: "IL",
      postalCode: "60622"
    }
  },
  funding: {
    descriptor: "Blue Ladders",
    destination: braintree.MerchantAccount.FundingDestination.Bank,
    email: "mailsender6000@gmail.com",
    mobilePhone: "5555555555",
    accountNumber: "1123581321",
    routingNumber: "071101307"
  },
  tosAccepted: true,
  masterMerchantAccountId: "14ladders_marketplace",
  id: "blue_ladders_store"
};

gateway.merchantAccount.create(merchantAccountParams, function (err, result) {
});

// set up email
let transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
         user: 'mailsender6000@gmail.com',
         pass: 'edno!dve@tri#'
     }
 });

//login counter fix?
let failedLoginCounter = 0;

//login, data fix?
let isAdmin = false;
let isLoggedIn = false;
let loggedInUserId = '';
let username = 'Guest';

// Database connection
const client = new pg.Client({
  user: 'postgres',
  host: 'localhost',
  database: 'online_shop_db',
  password: '1234',
  port: 5432
});
client.connect();

/* GET home/categories page. */
router.get('/', function(req, res, next) {
  let categories = [];
  client.query("select * from categories as c order by c.name").then((cats)=>{
    let number = 0;
    cats.rows.forEach((cat)=>{
      cat.number = ++number;
      categories.push(cat);
    });
    res.render('categories', {data:{'isLoggedIn': isLoggedIn,'user': username, 'isAdmin': isAdmin, 'cat': categories}});
  })
});

/* POST home(search) page. */
router.post('/', function(req, res, next) {
  let word = req.body.name;
  let products = [];
  let count = 1;
  if(/^[a-zA-Z]+$/.test(word)){
    client.query(sqlFormatter("select * from products as p"))
    .then((data)=>{
      data.rows.forEach((row)=>{
        row.number = count++;
        if(row.name.toLowerCase().includes(word.toLowerCase())){
          products.push(row);
        }
      });
      res.render('index', {data:{'isLoggedIn': isLoggedIn,'user': username, 'isAdmin': isAdmin, 'prods': products}});
    });
  }else{
    res.redirect(303, '/');
  }
});


/* GET category page. */
router.get('/category/:id', function(req, res, next) {
  let products = [];
  let catId = req.params.id;
  client.query(sqlFormatter("select * from products as p where p.category = %L order by p.name", catId))
  .then((prods)=>{
    let number = 0;
    prods.rows.forEach((prod)=>{
      prod.number = ++number;
      prod.price = addTrailingZeros(prod.price);
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
  if(failedLoginCounter>2){
    res.render('login', {data:{'isLoggedIn': isLoggedIn,'user': username, 'isAdmin': isAdmin, 'r': true}});
  }
  console.log('true');
  res.render('login', {data:{'isLoggedIn': isLoggedIn,'user': username, 'isAdmin': isAdmin, 'r': false}});
});

/* GET logout. */
router.get('/logout', function(req, res, next) {
  isLoggedIn = false;
  isAdmin = false;
  username = 'Guest';  
  res.redirect(303, '/');
});

/* GET verify. */
router.get('/verify/:id', function(req, res, next) {
  //if id exists active = true, delete from email_codes
  let verificationId = req.params.id;
  client.query(sqlFormatter('select * from email_codes as ec where ec.id = %L', verificationId))
  .then((data)=>{
    if(data.rows.length !== 0){
      let row = data.rows[0];
      let id = row.id;
      let userid = row.account;
      client.query(sqlFormatter('update accounts set active = true where id = %L', userid));
      client.query(sqlFormatter('delete from email_codes where id = %L', id));
    }
  });
  res.redirect(303, '/login');
});

/* POST registration page */
router.post('/register', function(req, res) {
  let recaptchaResp = req.body['g-recaptcha-response'];
  let email = req.body.email;
  let fName = req.body.fname;
  let lName = req.body.lname;
  let address = req.body.address;
  let pass = req.body.password;
  let cpass = req.body.cpassword;
  let link;
  let stop = false;

  let verifyURL = 'https://www.google.com/recaptcha/api/siteverify?secret=6LdF9FQUAAAAAJrUDQ7a-KxAtzKslyxhA7KZ-Bwt&response=' + recaptchaResp;
  request(verifyURL, (err, response, body)=>{
    body = JSON.parse(body);

    if(body.success !== undefined && !body.success){ //failed captcha
      res.redirect(303, '/register');
    }else{ //passed captcha
        //check if email exist
    client.query("select * from accounts").then((accs)=>{
      accs.rows.forEach((acc)=>{
        if(acc.email.toLowerCase() == email.toLowerCase()){
          //todo show error message ?
          console.log('err');
          res.redirect(303, '/register');
          stop = true;
        }
      });
    }).then(()=>{
      if(!stop){
        let hashedPass = passwordHash.generate(pass);
        if(validateEmail(email) && validateName(fName) && validateName(lName) && validatePass(pass) && pass === cpass){
          let newUserId = generateId();
          client.query(sqlFormatter("insert into accounts (id, email, first_name, last_name, address, pass, role, active) values(%L, %L, %L, %L, %L, %L, '1', 'false');", newUserId, email, fName, lName, address, hashedPass))
          .then(()=>{
            client.query(sqlFormatter("insert into shopping_carts (id, userId) values(%L, %L)", generateId(), newUserId))
            .then(()=>{
              let code = generateId();
              client.query(sqlFormatter("insert into email_codes values(%L, %L)", code, newUserId))
              .then(()=>{
                let link = 'http://localhost:3000/verify/' + code;
                // nodemailer.sendmail;
                const mailOptions = {
                  from: 'mailsender6000@gmail.com', // sender address
                  to: email, // list of receivers
                  subject: 'Account Verification at Localhost:3k', // Subject line
                  html: '<p>Hello ' + fName + ',\n to verify your account click the following link: '+link+'</p>'// plain text body
                };
                transporter.sendMail(mailOptions, function(error, info){
                  if(error){
                      return console.log(error);
                  }
                  console.log('Message sent: ' + info.response);
              });
              res.redirect(303, '/login');
              });
            });
          })
          .catch(e => console.error(e.stack));
        }else{
          res.redirect(303, '/register');
        }
      }
    })
    .catch(e => console.error(e.stack));
    }
  });
});

/* POST login page */
router.post('/login', function(req, res) {
  let recaptchaResp = req.body['g-recaptcha-response'];
  let verifyURL = 'https://www.google.com/recaptcha/api/siteverify?secret=6LdF9FQUAAAAAJrUDQ7a-KxAtzKslyxhA7KZ-Bwt&response=' + recaptchaResp;
  
  if(failedLoginCounter>2){
    request(verifyURL, (err, response, body)=>{
      body = JSON.parse(body);
  
      if(body.success !== undefined && !body.success){ //failed captcha
        return failLogin(res);
      }else{
        return checkLoginInfo(res,req);
      }
    });
  }else{
    return checkLoginInfo(res,req);
  }
});

function checkLoginInfo(res,req){let email = req.body.email;
  let pass = req.body.password;
  let foundUser = false;
  client
  .query("select * from accounts")
  .then((accounts)=>{
    accounts.rows.forEach((account)=>{
      if(account.email === email){
        foundUser = true;
        if(passwordHash.verify(pass, account.pass) && account.active){
          isLoggedIn = true;
          username = account.firstName;
          loggedInUserId = account.id;
          if(account.role == 2){
            isAdmin = true;
          }
          res.redirect(303, '/');
        }else{
          return failLogin(res);
        }
      }
    });
    if(!foundUser){
      return failLogin(res);
    }
  })
  .catch(e => console.error(e.stack));
}

function failLogin(res){
        //req.flash("error", "No such user"); TODO
        failedLoginCounter++;
        if(failedLoginCounter>2){
          return res.render('login', {data:{'isLoggedIn': isLoggedIn,'user': username, 'isAdmin': isAdmin, 'r': true}});
        }
        return res.render('login', {data:{'isLoggedIn': isLoggedIn,'user': username, 'isAdmin': isAdmin, 'r': false}});   
}

/* GET add prod page. */
router.get('/add', function(req, res, next) {
  if(!isAdmin){
    res.redirect(303, '/');
  }
  let ctg = [];
  client.query(sqlFormatter("select * from categories as c"))
  .then((data)=>{
    data.rows.forEach((row) => ctg.push(row.name));
    res.render('add', {data:{'isLoggedIn': isLoggedIn,'user': username, 'isAdmin': isAdmin, 'ctg': ctg}});
  });
});

/* GET check page. */
router.get('/check', function(req, res, next) {
  if(!isAdmin){
    res.redirect(303, '/');
  }
  let purchases = [];
  let count = 1;
  client.query(sqlFormatter("select p.date, p.id, a.first_name, a.address, st.name as state from accounts as a join purchases as p on a.id = p.userid join states as st on st.id = p.state order by state asc, p.date asc"))
  .then((data)=>{
    data.rows.forEach((row)=>{
      row.number = count++;
      purchases.push(row);
    });
    res.render('check', {data:{'isLoggedIn': isLoggedIn,'user': username, 'isAdmin': isAdmin, 'purchases': purchases}});  
  });
});

/* GET orders page. */
router.get('/orders', function(req, res, next) {
  if(!isLoggedIn){
    res.redirect(303, '/');
  }
  let purchases = [];
  let count = 1;
  client.query(sqlFormatter('select p.id, p.date, s.name as state from purchases as p join states as s on s.id = p.state where p.userid = %L order by state asc, p.date desc;', loggedInUserId))
  .then((data)=>{
    data.rows.forEach((row)=>{
      row.number = count++;
      purchases.push(row);
    });
    res.render('orders', {data:{'isLoggedIn': isLoggedIn,'user': username, 'isAdmin': isAdmin, 'purchases': purchases}});
  });
});

/* GET order:id page. */
router.get('/order/:id', function(req, res, next) {
  if(!isLoggedIn){
    res.redirect(303, '/');
  }
  orderId = req.params.id;
  let order = [];
  client.query(sqlFormatter('select pr.name, sum(pi.quantity) as quantity, pr.price, pr.id from purchase_items as pi join purchases as pur on pi.purchaseId = pur.id join products as pr on pr.id = pi.prodid where pur.id = %L group by pr.name, pr.price, pr.id order by pr.name asc', orderId))
  .then((data)=>{
    let totalPrice = 0;
    let count = 1;
    data.rows.forEach((row)=>{
      totalPrice += (Number(row.price) * Number(row.quantity));
      row.number = count++;
      row.price = addTrailingZeros(row.price);
      order.push(row);
    });
    totalPrice = addTrailingZeros(totalPrice);
    res.render('itemsInOrder', {data:{'isLoggedIn': isLoggedIn,'user': username, 'isAdmin': isAdmin, 'order': order, 'total': totalPrice}});
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
      row.price = addTrailingZeros(row.price);
      currentCart.push(row);
    });
    totalPrice = addTrailingZeros(totalPrice);
    res.render('purchases', {data:{'isLoggedIn': isLoggedIn,'user': username, 'isAdmin': isAdmin, 'cart': currentCart, 'total': totalPrice}});
  });
});

/* GET profile page */
router.get('/profile', function(req, res, next) {
  if(isAdmin || !isLoggedIn){
    res.redirect(303, '/');
  }
  let profData = [];
  client.query(sqlFormatter('select a.first_name as fn, a.last_name as ln, a.address from accounts as a where a.id = %L', loggedInUserId))
  .then((data)=>{
    data.rows.forEach((row)=>profData.push(row));
    res.render('profile', {data:{'isLoggedIn': isLoggedIn,'user': username, 'isAdmin': isAdmin, 'p': profData}});
  });
});

/* POST profile page. */
router.post('/profile', function(req, res, next) {
  if(isAdmin || !isLoggedIn){
    res.redirect(303, '/');
  }
  let fName = req.body.fname;
  let lName = req.body.lname;
  let address = req.body.address;

  client.query(sqlFormatter("update accounts set first_name = %L, last_name = %L, address = %L where id = %L", fName, lName, address, loggedInUserId))
  .then(res.redirect(303, '/'));
});

/* GET chpass page */
router.get('/chpass', function(req, res, next) {
  if(isAdmin || !isLoggedIn){
    res.redirect(303, '/');
  }
  res.render('chpass', {data:{'isLoggedIn': isLoggedIn,'user': username, 'isAdmin': isAdmin}});
});

/* POST chpass page. TODO*/
router.post('/chpass', function(req, res, next) {
  if(isAdmin || !isLoggedIn){
    res.redirect(303, '/');
  }
  let pass = req.body.pass;
  let newPass = req.body.newPass;
  let repeatPass = req.body.repNewPass;
  let found = false;

  client
  .query("select * from accounts")
  .then((accounts)=>{
    accounts.rows.forEach((account)=>{
      if(account.id === loggedInUserId){
        let hashedPass = passwordHash.generate(newPass);
        if(validatePass(newPass) && newPass === repeatPass && passwordHash.verify(pass, account.pass)){
          client.query(sqlFormatter("update accounts set pass = %L where id = %L", hashedPass, loggedInUserId))
          .then(res.redirect(303, '/'));
        }else{
          res.redirect(303, '/chpass')
        }
      }
    });
    res.redirect(303, '/chpass')
  })
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
  let descr = req.body.descr;
  let ctg = Number(req.body.ctg) + 1; // offset +1

  client.query(sqlFormatter("insert into products values(%L, %L, %L, %L, %L, %L);", generateId(), name, price, quant, ctg, descr))
        .catch(e => console.error(e.stack));

  res.redirect(303, '/');
});

/* GET cart page. */
router.get('/cart', function(req, res, next) {
  if(!isLoggedIn || isAdmin){
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
      row.price = addTrailingZeros(row.price);
      currentCart.push(row);
    });
    totalPrice = addTrailingZeros(totalPrice);
    res.render('cart', {data:{'isLoggedIn': isLoggedIn,'user': username, 'isAdmin': isAdmin, 'cart': currentCart, 'total': totalPrice}});
  });
});

/* GET edit page. */
router.get('/edit/:id', function(req, res, next) {
  if(!isAdmin){
    res.redirect(303, '/');
  }
  let productId = req.params.id;
  client.query(sqlFormatter("select p.name, p.price, p.quantity, p.description from products as p where p.id = %L", productId))
  .then((data)=>{
    let ctg = [];
    let row = data.rows[0];
    let name = row.name;
    let price = row.price;
    let quantity = row.quantity;
    let descr = row.description;
    client.query(sqlFormatter("select * from categories as c"))
    .then((data)=>{
      data.rows.forEach((row) => ctg.push(row.name));
      res.render('edit', {data:{'isLoggedIn': isLoggedIn,'user': username, 'isAdmin': isAdmin, 'name': name, 'price': price, 'quantity': quantity, 'descr': descr, 'ctg': ctg}});
    }); 
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
  let descr = req.body.descr;
  let ctg = Number(req.body.ctg) + 1; // offset +1

  client.query(sqlFormatter("update products set name = %L, price = %L, quantity = %L, category = %L, description = %L where id = %L;", name, price, quant, ctg, descr, productId))
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

/* POST cart. */
router.post('/cart', function(req, res) {
  res.redirect(303, '/buy');
});

/* GET buy page */
router.get('/buy', function(req, res){
  if(isAdmin || !isLoggedIn){
    res.redirect('/');
  }
  let wd = req.query.wd;
  gateway.clientToken.generate({}, function (err, response) {
    let clientToken = response.clientToken
    res.render('buy', {data:{'isLoggedIn': isLoggedIn,'user': username, 'isAdmin': isAdmin, 'wd': wd, 'ct': clientToken}});
  });
});

/* POST buy page */
router.post('/buy', function(req, res){
  let pass = true;
  //get nonce
  let nonce = req.body.nonce;
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
      //make test credit card transaction
      gateway.transaction.sale({
        amount: "10.00",
        paymentMethodNonce: nonce,
        options: {
          submitForSettlement: true
        }
      }, function (err, result) {
        pass = result.success;
        console.log(pass);
        if(result.success){
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

          //cart clean up
          client.query(sqlFormatter("delete from cart_items as ci using shopping_carts as sc where ci.cartid = sc.id and sc.userid = %L", loggedInUserId))
          .then(res.redirect(303, '/orders'));  
        }else{
          res.redirect(303, '/buy?wd=1');
        }
      });
    }
  });
});

function addTrailingZeros(number){
  return parseFloat(Math.round(number * 100) / 100).toFixed(2);
}

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
  var reg = /^([a-z]{3,20})$/;
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