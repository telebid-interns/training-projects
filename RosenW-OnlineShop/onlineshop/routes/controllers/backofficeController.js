let client = require('../../database/db');
let sqlFormatter = require('pg-format');
let u = require('../../utils/utils');
let bcrypt = require('bcrypt');

module.exports = {
    getAdmin: function(req, res, next) {
        if (req.session.loggedIn) {
            res.redirect(303, '/');
        }
    
        if(req.session.logincount == undefined){
            req.session.logincount = 0;
        }
    
        if (req.session.logincount > 2) {
            res.render('admin', {
                data: {
                    'isLoggedIn': req.session.loggedIn,
                    'user': req.session.username,
                    'isAdmin': req.session.admin,
                    'r': true
                }
            });
        }
        res.render('admin', {
            data: {
                'isLoggedIn': req.session.loggedIn,
                'user': req.session.username,
                'isAdmin': req.session.admin,
                'r': false
            }
        });
    },
    postAdmin: function(req, res) {
        let recaptchaResp = req.body['g-recaptcha-response'];
        let verifyURL = 'https://www.google.com/recaptcha/api/siteverify?secret=6LdF9FQUAAAAAJrUDQ7a-KxAtzKslyxhA7KZ-Bwt&response=' + recaptchaResp;
    
        if (req.session.logincount > 2) {
            request(verifyURL, (err, response, body) => {
                body = JSON.parse(body);
                if (body.success !== undefined && !body.success) { //failed captcha
                    return failAdminLogin(req, res, 3);
                } else {
                    return checkAdminInfo(res, req);
                }
            });
        } else {
            return checkAdminInfo(res, req);
        }
    },
    postSearchCheck: function(req, res, next) {
        let word = req.body.name;
        if (!req.session.admin) {
            res.redirect(303, '/');
        }
        let purchases = [];
        let awaiting = [];
        let being = [];
        let del = [];
        client
            .query(sqlFormatter(
                "select p.id, a.first_name, a.last_name, p.date, "+
                "st.name as state, p.date, sum(pi.prodprice * pi.quantity) as tot, a.address "+
                "from accounts as a join purchases as p on a.id = p.userid "+
                "join states as st on st.id = p.state "+
                "join purchase_items as pi on pi.purchaseid = p.id "+
                "group by a.first_name, a.last_name, st.name, p.date, p.id, a.address "+
                "order by p.date"
            ))
            .then((data) => {
                client.query(sqlFormatter(  //getting total for every day
                    "select sum(ord.tot) as totalForTheDay, ord.date, ord.first_name as name "+
                    "from (select p.id, a.first_name, a.last_name, p.date, "+
                    "st.name as state, sum(pi.prodprice * pi.quantity) as tot "+
                    "from accounts as a join purchases as p on a.id = p.userid "+
                    "join states as st on st.id = p.state "+
                    "join purchase_items as pi on pi.purchaseid = p.id "+
                    "group by a.first_name, a.last_name, st.name, p.date, p.id "+
                    "order by p.date) as ord group by ord.date, ord.first_name"))
                    .then((totals)=>{
                        let totalValues = [];
                        totals.rows.forEach((total)=>{
                            if(total.name.toLowerCase().includes(word.toLowerCase())){
                                totalValues.push(total);
                            }
                        });
                        data.rows.forEach((row) => {
                            row.tot = addTrailingZeros(row.tot);
                            if (row.first_name.toLowerCase().includes(word.toLowerCase())) {
                                purchases.push(row);
    
                                if(row.state == 'Awaiting Delivery'){
                                    awaiting.push(row)
                                }else if(row.state == 'Being Delivered'){
                                    being.push(row);
                                }else{
                                    del.push(row);
                                }
                            }
                        });
                        res.render('check', {
                            data: {
                                'isLoggedIn': req.session.loggedIn,
                                'user': req.session.username,
                                'isAdmin': req.session.admin,
                                'purchases': purchases,
                                'totals': totalValues,
                                'await': awaiting,
                                'being': being,
                                'del': del
                            }
                        });
                    });
            });
    },
    postSortCheck: function(req, res, next) {
        let sortIndex = req.params.sort;
        if (!req.session.admin) {
            res.redirect(303, '/');
        }
    
        let sortString;
        let purchases = [];
        let awaiting = [];
        let being = [];
        let del = [];
    
        switch(sortIndex){
            case 1:
                sortString = 'p.date';
                break;
            case 2:
            sortString = 'a.first_name';
                break;
            case 3:
            sortString = 'a.address';
                break;
            case 4:
            sortString = 'st.name';
                break;
            case 5:
            sortString = 'tot';
                break;
        }
        console.log(sortString);
        client
            .query(sqlFormatter(
                "select p.id, a.first_name, a.last_name, p.date, "+
                "st.name as state, p.date, sum(pi.prodprice * pi.quantity) as tot, a.address "+
                "from accounts as a join purchases as p on a.id = p.userid "+
                "join states as st on st.id = p.state "+
                "join purchase_items as pi on pi.purchaseid = p.id "+
                "group by a.first_name, a.last_name, st.name, p.date, p.id, a.address "+
                "order by %L", sortString
            ))
            .then((data) => {
                client.query(sqlFormatter(  //getting total for every day
                    "select sum(ord.tot) as totalForTheDay, ord.date, ord.first_name as name "+
                    "from (select p.id, a.first_name, a.last_name, p.date, "+
                    "st.name as state, sum(pi.prodprice * pi.quantity) as tot "+
                    "from accounts as a join purchases as p on a.id = p.userid "+
                    "join states as st on st.id = p.state "+
                    "join purchase_items as pi on pi.purchaseid = p.id "+
                    "group by a.first_name, a.last_name, st.name, p.date, p.id "+
                    "order by %L) as ord group by ord.date, ord.first_name", sortString))
                    .then((totals)=>{
                        let totalValues = [];
                        totals.rows.forEach((total)=>{
                            totalValues.push(total);
                        });
                        data.rows.forEach((row) => {
                            row.tot = u.addTrailingZeros(row.tot);
                            purchases.push(row);
    
                            if(row.state == 'Awaiting Delivery'){
                                awaiting.push(row)
                            }else if(row.state == 'Being Delivered'){
                                being.push(row);
                            }else{
                                del.push(row);
                            }
                        });
                        res.render('check', {
                            data: {
                                'isLoggedIn': req.session.loggedIn,
                                'user': req.session.username,
                                'isAdmin': req.session.admin,
                                'purchases': purchases,
                                'totals': totalValues,
                                'await': awaiting,
                                'being': being,
                                'del': del
                            }
                        });
                    });
            });
    },
    getCheck: function(req, res, next) {
        if (!req.session.admin) {
            res.redirect(303, '/');
        }
        let purchases = [];
        let awaiting = [];
        let being = [];
        let del = [];
    
        client
            .query(sqlFormatter(
                "select p.id, a.first_name, a.last_name, p.date, a.address, "+
                "st.name as state, p.date, sum(pi.prodprice * pi.quantity) as tot "+
                "from accounts as a join purchases as p on a.id = p.userid "+
                "join states as st on st.id = p.state "+
                "join purchase_items as pi on pi.purchaseid = p.id "+
                "group by a.first_name, a.last_name, st.name, p.date, p.id, a.address "+
                "order by p.date"
            ))
            .then((data) => {
                client.query(sqlFormatter(  //getting total for every day
                    "select sum(ord.tot) as totalForTheDay, ord.date "+
                    "from (select p.id, a.first_name, a.last_name, p.date, "+
                    "st.name as state, sum(pi.prodprice * pi.quantity) as tot "+
                    "from accounts as a join purchases as p on a.id = p.userid "+
                    "join states as st on st.id = p.state "+
                    "join purchase_items as pi on pi.purchaseid = p.id "+
                    "group by a.first_name, a.last_name, st.name, p.date, p.id "+
                    "order by p.date) as ord group by ord.date"))
                    .then((totals)=>{
                        totals.rows.forEach((row)=>{
                            let tokens = String(row.date).substr(0,15).split(" ");
                            row.date = tokens[2] + ' ' + tokens[1] + ' ' + tokens[3];
                        });
    
                        let totalValues = totals.rows;
                        data.rows.forEach((row) => {
                            let tokens = String(row.date).substr(0,15).split(" ");
                            row.date = tokens[2] + ' ' + tokens[1] + ' ' + tokens[3];
                            row.tot = u.addTrailingZeros(row.tot);
                            purchases.push(row);
                            if(row.state == 'Awaiting Delivery'){
                                awaiting.push(row)
                            }else if(row.state == 'Being Delivered'){
                                being.push(row);
                            }else{
                                del.push(row);
                            }
                        });
                        res.render('check', {
                            data: {
                                'isLoggedIn': req.session.loggedIn,
                                'user': req.session.username,
                                'isAdmin': req.session.admin,
                                'purchases': purchases,
                                'totals': totalValues,
                                'await': awaiting,
                                'being': being,
                                'del': del
                            }
                        });
                    });
            });
    },
    getCheckId: function(req, res, next) {
        if (!req.session.admin) {
            res.redirect(303, '/');
        }
        let purchId = req.params.id;
        let currentCart = [];
    
        client.query(sqlFormatter(  'select pi.prodname as name, sum(pi.quantity) as quantity, '+
                                    'pi.prodprice as price, pur.userid '+
                                    'from purchase_items as pi '+
                                    'join purchases as pur '+
                                    'on pi.purchaseId = pur.id '+
                                    'where pur.id = %L '+
                                    'group by pi.prodname, pi.prodprice, pur.userid '+
                                    'order by pi.prodname asc', purchId))
            .then((data) => {
                let totalPrice = 0;
                let count = 1;
                data.rows.forEach((row) => {
                    totalPrice += (Number(row.price) * Number(row.quantity));
                    row.number = count++;
                    row.price = u.addTrailingZeros(row.price);
                    currentCart.push(row);
                });
                totalPrice = u.addTrailingZeros(totalPrice);
                res.render('purchases', {
                    data: {
                        'isLoggedIn': req.session.loggedIn,
                        'user': req.session.username,
                        'isAdmin': req.session.admin,
                        'cart': currentCart,
                        'total': totalPrice
                    }
                });
            });
    },
    postCheck: function(req, res, next) {
        if (!req.session.admin) {
            res.redirect(303, '/');
        }
    
        let purchID = req.params.id;
        let newState = req.body.state;
    
        client.query(sqlFormatter("update purchases set state = %L where id = %L", newState, purchID))
            .then(res.redirect(303, '/check'));
    },
    postAddProd: function(req, res) {
        let name = req.body.name;
        let price = req.body.price;
        let quant = req.body.quant;
        let descr = req.body.descr;
        let img = req.files.img;
    
        let newName = u.generateId() + '.jpg';
        img.mv('/home/rosen/Desktop/repo/RosenW-OnlineShop/onlineshop/public/images/'+newName, function(err) {
            if (err)
              return res.status(500).send(err);
    
            if(img.name.slice(-4) == '.jpg'){
                client.query(sqlFormatter("insert into products values(%L, %L, %L, %L, %L);", name, price, quant, descr, newName))
                    .then(() => {
                        for (let i in req.body) {
                            if (isNumber(i)) {
                                client.query(sqlFormatter("insert into products_categories values(%L)", i))
                                    .catch(e => console.error(e.stack))
                            }
                        }
                        res.redirect(303, '/')
                    })
                    .catch(e => console.error(e.stack));
            }
            res.redirect(303, '/');
          });
    },
    getEdit: function(req, res, next) {
        if (!req.session.admin) {
            res.redirect(303, '/');
        }
        let productId = req.params.id;
        client.query(sqlFormatter(  "select p.name, p.price, p.quantity, p.description, p.img "+
                                    "from products as p "+
                                    "where p.id = %L", productId))
            .then((data) => {
                let ctg = [];
                let row = data.rows[0];
                let name = row.name;
                let price = row.price;
                let quantity = row.quantity;
                let descr = row.description;
                let img = row.img;
                client.query(sqlFormatter("select * from categories as c"))
                    .then((data) => {
                        data.rows.forEach((row) => ctg.push(row.name));
                        res.render('edit', {
                            data: {
                                'isLoggedIn': req.session.loggedIn,
                                'user': req.session.username,
                                'isAdmin': req.session.admin,
                                'name': name,
                                'price': price,
                                'quantity': quantity,
                                'descr': descr,
                                'ctg': ctg,
                                'img': img
                            }
                        });
                    });
            });
    },
    getDelete: function(req, res) {
        if (!req.session.admin) {
            res.redirect(303, '/');
        }
        let id = req.params.id;
        client.query(sqlFormatter("delete from products_categories where product = %L", id))
            .then(() => {
                client.query(sqlFormatter("delete from products where id = %L", id))
                    .then(res.redirect(303, '/'));
            });
    },
    getAccs: function(req, res) {
        if (!req.session.admin) {
            res.redirect(303, '/');
        }
        let users = [];
    
        client
            .query(sqlFormatter("select * from accounts order by role, first_name"))
            .then((data) => {
                data.rows.forEach((row) => {
                    row.id;
                    users.push(row);
                });
                res.render('accs', {
                    data: {
                        'isLoggedIn': req.session.loggedIn,
                        'user': req.session.username,
                        'isAdmin': req.session.admin,
                        'users': users
                    }
                });
            });
    },
    postEdit: function(req, res, next) {
        if (!req.session.admin) {
            res.redirect(303, '/');
        }
        let productId = req.params.id;
        let name = req.body.name;
        let price = req.body.price;
        let quant = req.body.quant;
        let descr = req.body.descr;
        let img = req.files.img;

        console.log(img);
    
        if(img != undefined && img.name.slice(-4) == '.jpg'){
            console.log('2');
            let newName = u.generateId() + '.jpg';
            img.mv('/home/rosen/Desktop/repo/RosenW-OnlineShop/onlineshop/public/images/'+newName, function(err) {
                if (err)
                return res.status(500).send(err);
        
                client.query(sqlFormatter("delete from products_categories where product = %L", productId))
                .then(() => {
                    for (let i in req.body) {
                        if (u.isNumber(i)) {
                            client.query(sqlFormatter("insert into products_categories values(%L, %L)", productId, i))
                                .catch(e => console.error(e.stack))
                        }
                    }
        
                    client.query(sqlFormatter("update products set name = %L, price = %L, quantity = %L, description = %L, img = %L where id = %L;", name, price, quant, descr, newName, productId))
                    .then(()=>{
                        client.query(sqlFormatter("update cart_items set modified = true where prodid = %L", productId))
                        .then(res.redirect(303, '/'));
                    });
                });
                res.redirect(303, '/');
            });
        }else{
            res.redirect(303, '/edit/' + productId);
        }
    }
}

function checkAdminInfo(res, req) {
    let username = req.body.username;
    let pass = req.body.password;
    let foundUser = false;
    client
        .query("select * from admins")
        .then((accounts) => {
            accounts.rows.forEach((account) => {
                if (account.username === username) {
                    foundUser = true;
                    bcrypt.compare(account.salt + pass, account.pass, function(err, bcryptResp) {
                        if (bcryptResp == true) {
                            req.session.loggedIn = true;
                            req.session.admin = true;
                            req.session.username = account.username;
                            req.session.logincount = 0;
                            res.redirect(303, '/');
                        } else {
                            return failAdminLogin(req, res, 1);
                        }
                    });
                }
            });
            if (!foundUser) {
                return failAdminLogin(req, res, 2);
            }
        })
        .catch(e => console.error(e.stack));
}

function failAdminLogin(req, res, code) {
    let captchaBool = false;
    req.session.logincount++;
    if (req.session.logincount > 2) {
        captchaBool = true;
    }
    return res.render('admin', {
        data: {
            'isLoggedIn': req.session.loggedIn,
            'user': req.session.username,
            'isAdmin': req.session.admin,
            'r': captchaBool,
            'f': code
        }
    });
}
