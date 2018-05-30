let client = require('../../database/db');
let u = require('../../utils/utils');
let bcrypt = require('bcrypt');
let nodemailer = require('nodemailer');
let Recaptcha = require('express-recaptcha').Recaptcha;
let request = require('request');

// set up email
let transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'mailsender6000@gmail.com',
        pass: 'edno!dve@tri#'
    }
});

module.exports = {
    getRegister: async function(req, res, next) {
        let data = await client.query('select * from categories');
        let categories = data.rows;

        if (req.session.loggedIn) {
            res.redirect(303, '/');
        }
        res.render('registration', {
            data: {
                'isLoggedIn': req.session.loggedIn,
                'user': req.session.username,
                'isAdmin': req.session.admin,
                'cats': categories
            }
        });
    },
    getLogin: async function(req, res, next) {
        let data = await client.query('select * from categories');
        let categories = data.rows;

        if (req.session.loggedIn) {
            res.redirect(303, '/');
        }

        if(req.session.logincount == undefined){
            req.session.logincount = 0;
        }

        if (req.session.logincount > 2) {
            res.render('login', {
                data: {
                    'isLoggedIn': req.session.loggedIn,
                    'user': req.session.username,
                    'isAdmin': req.session.admin,
                    'r': true,
                    'cats': categories
                }
            });
        }

        res.render('login', {
            data: {
                'isLoggedIn': req.session.loggedIn,
                'user': req.session.username,
                'isAdmin': req.session.admin,
                'r': false,
                'cats': categories
            }
        });
    },
    getLogout: function(req, res, next) {
        req.session.loggedIn = false;
        req.session.admin = false;
        req.session.username = 'Guest';
        res.redirect(303, '/');
    },
    getVerify: async function(req, res, next) {
        //if id exists active = true, delete from email_codes
        let verificationId = req.params.id;
        let rows;
        let id;
        let userid;
        let data = await client.query(
          'select * from email_codes as ec where ec.code = $1 order by id', [verificationId]);
        if (data.rows.length !== 0) {
            row = data.rows[0];
            id = row.id;
            userid = row.account;
        }
        await client.query('update accounts set active = true where id = $1', [userid]);
        await client.query('delete from email_codes where id = $1', [id]);
        res.redirect(303, '/login');
    },
    postRegister: async function(req, res) {
      let recaptchaResp = req.body['g-recaptcha-response'];
      let email = req.body.email;
      let fName = req.body.fname;
      let lName = req.body.lname;
      let phone = req.body.phone;
      let address = req.body.address;
      let pass = req.body.password;
      let cpass = req.body.cpassword;
      let cc = req.body.countryCode;
      let link;
      let stop = false;
      let wholeNumber = cc + parseInt(phone.replace(/[^0-9]/g,''),10); // parse int removes leading zeros, replace makes sure its only numbers

      let verifyURL = 'https://www.google.com/recaptcha/api/siteverify?secret=6LdF9FQUAAAAAJrUDQ7a-KxAtzKslyxhA7KZ-Bwt&response=' + recaptchaResp;

      await request(verifyURL, async (err, response, body) => {
        body = JSON.parse(body);
        if (body.success !== undefined && !body.success) { //failed captcha
            stop = true;
            await failRegister(req, res, 3);
        }else{ //passed captcha
            let accs = await client.query(
              "select * from accounts where lower(email) = $1", [email.toLowerCase()]);

            if (accs.rows.length != 0) {
              stop = true;
              await failRegister(req, res, 6);
            }

            if (!stop) {
              let salt = u.generateId();
              let saltedPass = salt + pass;
              if (await !u.validateEmail(email)) {
                  stop=true;
                  await failRegister(req, res, 5);
              }
              if (await !u.validatePass(pass)) {
                  stop=true;
                  await failRegister(req, res, 1);
              }
              if (pass !== cpass) {
                  stop=true;
                  await failRegister(req, res, 4);
              }
              if (await !u.validateName(fName) || await !u.validateName(lName)) {
                  stop=true;
                  await failRegister(req, res, 2);
              }
              if(!stop){
                  await bcrypt.hash(saltedPass, 5, async function(err, hash) {
                      await client.query(
                          "insert into accounts (email, first_name, last_name, "+
                          "phone, address, pass, salt, role, active, suspended) "+
                          "values($1, $2, $3, $4, $5, $6, $7, '1', 'false', 'false');",
                          [email, fName, lName, wholeNumber, address, hash, salt])
                      .then(async ()=>{
                        let currentAcc = await client.query(
                          "select id from accounts where email=$1;", [email]); //??????
                        let userid = currentAcc.rows[0].id;
                        await client.query(
                          "insert into shopping_carts (userid) values($1)", [userid]);
                        let code = u.generateId();
                        await client.query(
                          "insert into email_codes (account, code) values($1, $2)", [userid, code]);
                        let link = 'http://localhost:3000/verify/' + code;
                        // nodemailer.sendmail;
                        const mailOptions = {
                            from: 'mailsender6000@gmail.com', // sender address
                            to: email, // list of receivers
                            subject: 'Account Verification at Localhost:3k', // Subject line
                            html: '<p>Hello ' + fName + ',\n to verify your account click the following link: ' + link + '</p>' // plain text body
                        };
                        await transporter.sendMail(mailOptions, function(error, info) {
                            if (error) {
                                return console.log(error);
                            }
                            console.log('Message sent: ' + info.response);
                        });
                        res.redirect(303, '/?reg=1');
                      });
                  });
              }
            }
          }
        });
    },
    postLogin: function(req, res) {
      let recaptchaResp = req.body['g-recaptcha-response'];
      let verifyURL = 'https://www.google.com/recaptcha/api/siteverify?secret=6LdF9FQUAAAAAJrUDQ7a-KxAtzKslyxhA7KZ-Bwt&response=' + recaptchaResp;

      if (req.session.logincount > 2) {
          request(verifyURL, (err, response, body) => {
              body = JSON.parse(body);
              if (body.success !== undefined && !body.success) { //failed captcha
                  return failLogin(req, res, 3);
              } else {
                  return checkLoginInfo(res, req);
              }
          });
      } else {
          return checkLoginInfo(res, req);
      }
    },
    getProfile: async function(req, res, next) {
        if (req.session.admin || !req.session.loggedIn) {
            res.redirect(303, '/');
        }
        let categories = [];
        let profData = [];
        let data = await client.query(
          'select a.first_name as fn, a.last_name as ln, '+
          'a.phone as ph, a.address '+
          'from accounts as a '+
          'where a.id = $1::integer', [req.session.userId]);
        let cats = await client.query('select * from categories');
        await cats.rows.forEach((cat)=> categories.push(cat));
        await data.rows.forEach((row) => profData.push(row));
        res.render('profile', {
            data: {
                'isLoggedIn': req.session.loggedIn,
                'user': req.session.username,
                'isAdmin': req.session.admin,
                'p': profData,
                'cats': categories
            }
        });
    },
    postProfile: async function(req, res, next) {
        if (req.session.admin || !req.session.loggedIn) {
            res.redirect(303, '/');
        }
        let fName = req.body.fname;
        let lName = req.body.lname;
        let phone = req.body.phone;
        let address = req.body.address;

        if(u.validateName(fName) && u.validateName(lName)){
          await client.query(
            "update accounts set first_name = $1::text, last_name = $2::text, "+
            "address = $3::text, phone = $4::text where id = $5::integer",
             [fName, lName, address, phone, req.session.userId]);
          req.session.username = fName;
          res.redirect(303, '/?pi=1'); //password info
        }else{
          let profData = [];
          let data = await client.query(
            'select a.first_name as fn, a.last_name as ln, '+
            'a.phone as ph, a.address '+
            'from accounts as a where a.id = $1::integer', [req.session.userId]);
          let cats = await client.query('select * from categories');
          let categores = cats.rows;
          await data.rows.forEach((row) => profData.push(row));
          res.render('profile', {
              data: {
                  'isLoggedIn': req.session.loggedIn,
                  'user': req.session.username,
                  'isAdmin': req.session.admin,
                  'p': profData,
                  'f': 1,
                  'cats': categores
              }
          });
        }
    },
    getChpass: async function(req, res, next) {
        if (req.session.admin || !req.session.loggedIn) {
            res.redirect(303, '/');
        }
        let cats = await client.query('select * from categories')
        let categories = cats.rows;
        res.render('chpass', {
            data: {
                'isLoggedIn': req.session.loggedIn,
                'user': req.session.username,
                'isAdmin': req.session.admin,
                'cats': categories
            }
        });
    },
    postChpass: async function(req, res, next) {
      if (req.session.admin || !req.session.loggedIn) {
          res.redirect(303, '/');
      }
      let pass = req.body.pass;
      let newPass = req.body.newPass;
      let repeatPass = req.body.repNewPass;
      let found = false;

      let accountData = await client.query(
        "select * from accounts where id = $1::integer", [req.session.userId]);
      if (accountData.rows.length != 0) {
        let account = accountData.rows[0];
        await bcrypt.compare(account.salt + pass, account.pass, async function(err, bcryptResp) {
          if(!bcryptResp){
            await failChangePass(req, res, 1) //f password
          }
          if(u.validatePass(!newPass)){
            await failChangePass(req, res, 2); //f validate
          }
          if(newPass !== repeatPass){
            await failChangePass(req, res, 3); //f repeat
          }
          await bcrypt.hash(account.salt + newPass, 5, async function(err, hash) {
            await client.query(
              "update accounts set pass = $1::text where id = $2::integer", [hash, req.session.userId]);
          });
          res.redirect(303, '/?pc=1');
        });
      }
    }
}

async function failChangePass(req, res, code){
    let cats = await client.query('select * from categories');
    let categories = cats.rows;
    return res.render('chpass', {
        data: {
            'isLoggedIn': req.session.loggedIn,
            'user': req.session.username,
            'isAdmin': req.session.admin,
            'f': code,
            'cats': categories
        }
    });
}

async function failRegister(req, res, code) {
    let cats = await client.query("select * from categories");
    let categories = cats.rows;
    return res.render('registration', {
        data: {
            'isLoggedIn': req.session.loggedIn,
            'user': req.session.username,
            'isAdmin': req.session.admin,
            'f': code,
            'cats': categories
        }
    });
}

async function failLogin(req, res, code) {
    let cats = await client.query("select * from categories");
    let categories = cats.rows;
    let captchaBool = false;
    req.session.logincount++;
    if (req.session.logincount > 2) {
        captchaBool = true;
    }
    return res.render('login', {
        data: {
            'isLoggedIn': req.session.loggedIn,
            'user': req.session.username,
            'isAdmin': req.session.admin,
            'r': captchaBool,
            'f': code,
            'cats': categories
        }
    });
}

async function checkLoginInfo(res, req) {
    let email = req.body.email;
    let pass = req.body.password;
    let foundUser = false;
    let accountData = await client.query(
      "select * from accounts where email = $1", [email]);
    let totalItemsInCart = await client.query(
      "select sum(quantity) as q from cart_items as ci "+
      "join shopping_carts as sc on sc.id = ci.cartid "+
      "join accounts as acc on acc.id = sc.userid where acc.email = $1", [email]);
    let itemNum = totalItemsInCart.rows[0].q;
    let account = accountData.rows[0];
    if (accountData.rows.length != 0) {
        foundUser = true;
        await bcrypt.compare(account.salt + pass, account.pass, function(err, bcryptResp) {
            if (bcryptResp == true && account.active) {
                req.session.userId = account.id;
                req.session.loggedIn = true;
                req.session.admin = false;
                req.session.username = account.first_name;
                req.session.logincount = 0;
                req.session.itemCount = itemNum;
                res.redirect(303, '/');
            } else {
                return failLogin(req, res, 1);
            }
        });
    }
    if (!foundUser) {
        return failLogin(req, res, 2);
    }
}
