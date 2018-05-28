let client = require('../../database/db');
let u = require('../../utils/utils');
let bcrypt = require('bcrypt');
let request = require('request');

module.exports = {
    getAdmin: function(req, res, next) {

        // function randomWord(){
        //   let word = '';
        //   let alphabet="ZXCVBNMASDFGHJKLQWERTYUIOP";
        //   for(let i = 0; i<7;i++){
        //     word += alphabet.charAt(Math.floor(Math.random() * 26));
        //   }
        //   return word;
        // }
        // for(let i = 0; i<999000;i++){
        //   client.query(
        //   'insert into products (name, price, quantity, description, img) '+
        //   'values($1, $2, $3, $4, $5)',
        //   [randomWord(), 12.50, Math.floor(Math.random() * 5000), "", "test100k.jpg"]);
        // }

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
    postSearchCheck: async function(req, res, next) {
        if (!req.session.admin) {
            res.redirect(303, '/');
        }
        let word = req.body.name;

        let dataCheckQuery = getCheckQuery(
          "where lower(a.first_name) like concat('%', $1::text, '%') ",
          "order by p.date desc");
        let totalCheckQuery = getTotalCheckQuery(
          "where lower(a.first_name) like concat('%', $1::text, '%') ",
          "order by ord.date desc");

        let data = await client.query(dataCheckQuery , [word.toLowerCase()]);
        let totals = await client.query(totalCheckQuery, [word.toLowerCase()]);

        let purchases = data.rows;
        let awaiting = [];
        let being = [];
        let del = [];
        let totalValues = totals.rows;

        await totalValues.forEach((row)=>{
            let tokens = String(row.date).substr(0,15).split(" ");
            row.date = tokens[2] + ' ' + tokens[1] + ' ' + tokens[3];
            row.totalfortheday = u.addTrailingZeros(row.totalfortheday);
        });

        await purchases.forEach((row)=>{
            let tokens = String(row.date).substr(0,15).split(" ");
            row.date = tokens[2] + ' ' + tokens[1] + ' ' + tokens[3];
            row.tot = u.addTrailingZeros(row.tot);

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
                'del': del,
                'opt': 1,
                'word': word
            }
        });
    },
    getSortCheck: async function(req, res, next) {
      if (!req.session.admin) {
        res.redirect(303, '/');
      }
      let sortIndex = Number(req.params.sort);
      let word = req.params.word;
      let opt = Number(req.params.opt);

      let sortString = await getSortStringById(sortIndex);

      if(word == '*'){
          word = '';
      }

      let CheckQuery = getCheckQuery(
      "where lower(a.first_name) like concat('%', $1::text, '%') ",
      "order by "+sortString+" desc");
      let totalCheckQuery = getTotalCheckQuery(
      "where lower(a.first_name) like concat('%', $1::text, '%') ",
      "order by date desc");

      let data = await client.query(CheckQuery, [word.toLowerCase()]);
      let totals = await client.query(totalCheckQuery, [word.toLowerCase()]);

      let purchases = data.rows;
      let awaiting = [];
      let being = [];
      let del = [];
      let totalValues = totals.rows;

      await totalValues.forEach((row)=>{
          let tokens = String(row.date).substr(0,15).split(" ");
          row.date = tokens[2] + ' ' + tokens[1] + ' ' + tokens[3];
          row.totalfortheday = u.addTrailingZeros(row.totalfortheday);
      });

      await purchases.forEach((row)=>{
          let tokens = String(row.date).substr(0,15).split(" ");
          row.date = tokens[2] + ' ' + tokens[1] + ' ' + tokens[3];
          row.tot = u.addTrailingZeros(row.tot);

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
              'del': del,
              'opt': opt,
              'word': word
          }
      });
    },
    getCheckId: async function(req, res, next) {
      if (!req.session.admin) {
          res.redirect(303, '/');
      }
      let purchId = req.params.id;
      let currentCart = [];

      let data = await client.query(
        'select pi.prodname as name, sum(pi.quantity) as quantity, '+
        'pi.prodprice as price, pur.userid '+
        'from purchase_items as pi '+
        'join purchases as pur '+
        'on pi.purchaseId = pur.id '+
        'where pur.id = $1 '+
        'group by pi.prodname, pi.prodprice, pur.userid '+
        'order by pi.prodname asc', [purchId]);
      let totalPrice = 0;
      let count = 1;
      await data.rows.forEach((row) => {
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
    },
    postCheck: async function(req, res, next) {
        if (!req.session.admin) {
            res.redirect(303, '/');
        }
        let purchID = req.params.id;
        let newState = req.body.state;

        await client.query(
          "update purchases set state = $1 where id = $2", [newState, purchID]);
        res.redirect(303, '/check/s/1/1/*');
    },
    postAddProd: async function(req, res) {
        let name = req.body.name;
        let price = req.body.price;
        let quant = req.body.quant;
        let descr = req.body.descr;
        let img = req.files.img;

        if(img.name.slice(-4) == '.jpg'){
          let newName = u.generateId() + '.jpg';
          await img.mv('/home/rosen1/Desktop/repo/RosenW-OnlineShop/onlineshop/public/images/'+newName,
            function(err) {
              if (err)
                return res.status(500).send(err);
              });
          await client.query(
            "insert into products values($1, $2, $3, $4, $5);", [name, price, quant, descr, newName]);
          let product = await client.query(
            "select id from products where name = $1 and img = $2", [name, newName]);
          let pid = product.rows[0].id;
          for (let i in req.body) {
            if (u.isNumber(i)) {
                client.query(
                  "insert into products_categories values($1, $2)", [pid, i]);
            }
          }
          res.redirect(303, '/');
        }
        res.redirect(303, '/');
    },
    getEdit: async function(req, res, next) {
        if (!req.session.admin) {
            res.redirect(303, '/');
        }
        let productId = req.params.id;
        let data = await client.query(
          "select p.name, p.price, p.quantity, p.description, p.img "+
          "from products as p "+
          "where p.id = $1", [productId]);
        let ctg = [];
        let row = data.rows[0];
        let name = row.name;
        let price = row.price;
        let quantity = row.quantity;
        let descr = row.description;
        let img = row.img;
        let cats = await client.query("select * from categories");
        await cats.rows.forEach((row) => ctg.push(row.name));
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
    },
    getDelete: async function(req, res) {
        if (!req.session.admin) {
            res.redirect(303, '/');
        }
        let id = req.params.id;
        await client.query("delete from products_categories where product = $1", [id]);
        await client.query("delete from products where id = $1", [id]);
        res.redirect(303, '/');
    },
    getAccs: async function(req, res) {
      if (!req.session.admin) {
          res.redirect(303, '/');
      }


      let data = await client.query("select * from accounts order by id");
      let users = data.rows;

      res.render('accs', {
          data: {
              'isLoggedIn': req.session.loggedIn,
              'user': req.session.username,
              'isAdmin': req.session.admin,
              'users': users
          }
      });
    },
    postEdit: async function(req, res, next) {
        if (!req.session.admin) {
            res.redirect(303, '/');
        }
        let productId = req.params.id;
        let name = req.body.name;
        let price = req.body.price;
        let quant = req.body.quant;
        let descr = req.body.descr;
        let img = req.files.img;

        if(img != undefined && img.name.slice(-4) == '.jpg'){
          let newName = u.generateId() + '.jpg';
          await img.mv('/home/rosen1/Desktop/repo/RosenW-OnlineShop/onlineshop/public/images/'+ newName,
            function(err) {
                if (err)
                  return res.status(500).send(err);
              });

          await client.query(
            "delete from products_categories where product = $1", [productId]);
          for (let i in req.body) {
              if (u.isNumber(i)) {
                  client.query(
                    "insert into products_categories values($1, $2)", [productId, i])
                      .catch(e => console.error(e.stack))
              }
          }

          await client.query(
            "update products set name = $1, price = $2, quantity = $3, "+
            "description = $4, img = $5 where id = $6;",
            [name, price, quant, descr, newName, productId]);
          await client.query(
            "update cart_items set modified = true where prodid = $1", [productId]);
          res.redirect(303, '/');
        }else{
            res.redirect(303, '/edit/' + productId);
        }
    },
    getAll: async function(req, res, next) {
        if (!req.session.admin) {
            res.redirect(303, '/');
        }
        let products = [];
        let catId = req.params.id;
        let prods = await client.query(
          "select * from products as p order by name");
        let number = 0;
        prods.rows.forEach((prod) => {
          prod.number = ++number;
          prod.price = u.addTrailingZeros(prod.price);
          products.push(prod);
        });
        res.render('index', {
            data: {
                'isLoggedIn': req.session.loggedIn,
                'user': req.session.username,
                'isAdmin': req.session.admin,
                'prods': products
            }
        });
    }
}

async function checkAdminInfo(res, req) {
    let username = req.body.username;
    let pass = req.body.password;
    let foundUser = false;
    let accounts = await client.query(
      "select * from admins where username = $1", [username]);
    let account = accounts.rows[0];
    if(accounts.rows.length != 0){
      bcrypt.compare(account.salt + pass, account.pass,
        function(err, bcryptResp) {
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
    }else{
      return failAdminLogin(req, res, 2);
    }
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

function getSortStringById(sortIndex){
  switch(sortIndex){
    case 1:
      return 'p.date';
    case 2:
      return 'a.first_name';
    case 3:
      return 'a.address';
    case 4:
      return 'st.name';
    case 5:
      return 'tot';
  }
}

function getCheckQuery(condition, order){
  return "select p.id, a.first_name, a.last_name, p.date, "+
  "st.name as state, p.date, sum(pi.prodprice * pi.quantity) as tot, a.address "+
  "from accounts as a join purchases as p on a.id = p.userid "+
  "join states as st on st.id = p.state "+
  "join purchase_items as pi on pi.purchaseid = p.id "+
  condition+
  "group by a.first_name, a.last_name, st.name, p.date, p.id, a.address "+
  order;
}

function getTotalCheckQuery(condition, order){
  return "select sum(ord.tot) as totalForTheDay, ord.date "+
  "from (select p.id, a.first_name, a.last_name, p.date, "+
  "st.name as state, sum(pi.prodprice * pi.quantity) as tot "+
  "from accounts as a join purchases as p on a.id = p.userid "+
  "join states as st on st.id = p.state "+
  "join purchase_items as pi on pi.purchaseid = p.id "+
  condition+
  "group by a.first_name, a.last_name, st.name, p.date, p.id "+
  ") as ord group by ord.date "+
  order;
}
