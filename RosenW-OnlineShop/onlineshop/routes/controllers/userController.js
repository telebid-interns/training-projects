let client = require('../../database/db');
let sqlFormatter = require('pg-format');
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
        let data = await client.query(sqlFormatter('select * from categories'));
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
        let data = await client.query(sqlFormatter('select * from categories'));
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
        let data = await client.query(sqlFormatter('select * from email_codes as ec where ec.code = %L order by id', verificationId));
        if (data.rows.length !== 0) {
            row = data.rows[0];
            id = row.id;
            userid = row.account;
        }
        await client.query(sqlFormatter('update accounts set active = true where id = %L', userid));
        await client.query(sqlFormatter('delete from email_codes where id = %L', id));
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
        await request(verifyURL, (err, response, body) => {
            body = JSON.parse(body);
            if (body.success !== undefined && !body.success) { //failed captcha
                failRegister(req, res, 3);
            }
        }); //passed captcha
        let accs = await client.query("select * from accounts"); //FIX
        await accs.rows.forEach((acc) => {
            if (acc.email.toLowerCase() == email.toLowerCase()) {
                stop = true;
                failRegister(req, res, 6);
            }
        });

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
                    await client.query(sqlFormatter(  
                        "insert into accounts (email, first_name, last_name, "+
                        "phone, address, pass, salt, role, active, suspended) "+
                        "values(%L, %L, %L, %L, %L, %L, %L, '1', 'false', 'false');", 
                        email, fName, lName, wholeNumber, address, hash, salt));
                });
                let queryString = sqlFormatter("select id from accounts where email=%L;", email);
                console.log(debug);
                let currentAcc = await client.query(sqlFormatter("select id from accounts where email=%L;", email)); //??????
                console.log(email);
                console.log(currentAcc);
                let userid = currentAcc.rows[0].id;
                console.log(userid);
                await client.query(sqlFormatter("insert into shopping_carts (userid) values(%L)", userid));
                let code = u.generateId();
                await client.query(sqlFormatter("insert into email_codes (account, code) values(%L, %L)", userid, code));
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
            }
        }
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
    getProfile: function(req, res, next) {
        if (req.session.admin || !req.session.loggedIn) {
            res.redirect(303, '/');
        }
        let categories = [];
        let profData = [];
        client.query(sqlFormatter(  'select a.first_name as fn, a.last_name as ln, '+
                                    'a.phone as ph, a.address '+
                                    'from accounts as a '+
                                    'where a.id = %L', req.session.userId))
        .then((data) => {
            client.query(sqlFormatter('select * from categories'))
            .then((cats)=>{
                cats.rows.forEach((cat)=> categories.push(cat));
                data.rows.forEach((row) => profData.push(row));
                res.render('profile', {
                    data: {
                        'isLoggedIn': req.session.loggedIn,
                        'user': req.session.username,
                        'isAdmin': req.session.admin,
                        'p': profData,
                        'cats': categories
                    }
                });
            });
        });
    },
    postProfile: function(req, res, next) {
        if (req.session.admin || !req.session.loggedIn) {
            res.redirect(303, '/');
        }
        let fName = req.body.fname;
        let lName = req.body.lname;
        let phone = req.body.phone;
        let address = req.body.address;
    
        if(u.validateName(fName) && u.validateName(lName)){
          client.query(sqlFormatter("update accounts set first_name = %L, last_name = %L, address = %L, phone = %L where id = %L", fName, lName, address, phone, req.session.userId))
              .then(res.redirect(303, '/?pi=1')); //password info
        }else{
          let profData = [];
          client.query(sqlFormatter('select a.first_name as fn, a.last_name as ln, '+
                                    'a.phone as ph, a.address '+
                                    'from accounts as a where a.id = %L', req.session.userId))
            .then((data) => {
                client.query(sqlFormatter('select * from categories'))
                .then((cats) => {
                    let categores = cats.rows;
                    data.rows.forEach((row) => profData.push(row));
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
                });
            });
        }
    },
    getChpass: function(req, res, next) {
        if (req.session.admin || !req.session.loggedIn) {
            res.redirect(303, '/');
        }
        client.query(sqlFormatter('select * from categories'))
        .then((cats)=>{
            let categories = cats.rows;
            res.render('chpass', {
                data: {
                    'isLoggedIn': req.session.loggedIn,
                    'user': req.session.username,
                    'isAdmin': req.session.admin,
                    'cats': categories
                }
            });
        });
    },
    postChpass: function(req, res, next) {
        if (req.session.admin || !req.session.loggedIn) {
            res.redirect(303, '/');
        }
        let pass = req.body.pass;
        let newPass = req.body.newPass;
        let repeatPass = req.body.repNewPass;
        let found = false;
    
        client
            .query("select * from accounts") //MAKE DB FILTER DATA
            .then((accounts) => {
                accounts.rows.forEach((account) => {
                    if (account.id === req.session.userId) {
                        bcrypt.compare(account.salt + pass, account.pass, function(err, bcryptResp) {
                          if(bcryptResp){
                            if(u.validatePass(newPass)){
                              if(newPass === repeatPass){
                                bcrypt.hash(account.salt + newPass, 5, function(err, hash) {
                                  client.query(sqlFormatter("update accounts set pass = %L where id = %L", hash, req.session.userId))
                                      .then(res.redirect(303, '/?pc=1'));
                                });
                              }else{
                                failChangePass(req, res, 3); //f repeat
                              }
                            }else{
                              failChangePass(req, res, 2); //f validate
                            }
                          }else{
                            failChangePass(req, res, 1) //f password
                          }
                        });
                    }
                });
            });
    }
}

function failChangePass(req, res, code){
    client.query(sqlFormatter('select * from categories'))
    .then((cats)=>{
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
    });
}

function failRegister(req, res, code) {
    console.log('3');
    client.query(sqlFormatter("select * from categories")).then((cats)=>{
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
    });
}

function failLogin(req, res, code) {
    client.query(sqlFormatter("select * from categories"))
        .then((cats)=>{
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
        });
}

function checkLoginInfo(res, req) {
    let email = req.body.email;
    let pass = req.body.password;
    let foundUser = false;
    client
        .query("select * from accounts")
        .then((accounts) => {
            accounts.rows.forEach((account) => {
                if (account.email === email) {
                    foundUser = true;
                    bcrypt.compare(account.salt + pass, account.pass, function(err, bcryptResp) {
                        if (bcryptResp == true && account.active) {
                            req.session.userId = account.id;
                            req.session.loggedIn = true;
                            req.session.admin = false;
                            req.session.username = account.first_name;
                            req.session.logincount = 0;
                            res.redirect(303, '/');
                        } else {
                            return failLogin(req, res, 1);
                        }
                    });
                }
            });
            if (!foundUser) {
                return failLogin(req, res, 2);
            }
        })
        .catch(e => console.error(e.stack));
}
