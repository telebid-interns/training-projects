let client = require('../../database/db');
let sqlFormatter = require('pg-format');
let u = require('../../utils/utils');

module.exports = {
    getCart: async function(req, res, next) {
        if (!req.session.loggedIn || req.session.admin) {
            res.redirect(303, '/');
        }
        let currentCart = [];

        let data = await client.query(sqlFormatter(
          'select pr.description, pr.img, pr.name, sum(ci.quantity) as quantity'+
          ', pr.price, pr.id, ci.id as itemsid, ci.modified '+
          'from cart_items as ci '+
          'join shopping_carts as sc '+
          'on ci.cartId = sc.id '+
          'join accounts as a on a.id = sc.userId '+
          'join products as pr on pr.id = ci.prodId '+
          'where a.id = %L '+
          'group by pr.name, pr.price, pr.id, ci.modified, ci.id, pr.img, pr.description '+
          'order by pr.name asc', req.session.userId));
          let totalPrice = 0;
          let count = 1;
          await data.rows.forEach((row) => {
              totalPrice += (Number(row.price) * Number(row.quantity));
              row.number = count++;
              row.price = u.addTrailingZeros(row.price);
              currentCart.push(row);
          });
          totalPrice = u.addTrailingZeros(totalPrice);
          res.render('cart', {
              data: {
                  'isLoggedIn': req.session.loggedIn,
                  'user': req.session.username,
                  'isAdmin': req.session.admin,
                  'cart': currentCart,
                  'total': totalPrice
              }
          });
    },
    getRemoveFromCart: async function(req, res) {
        if (!req.session.loggedIn) {
            res.redirect(303, '/');
        }
        let id = req.params.id;
        await client.query(sqlFormatter(
          "delete from cart_items as ci using shopping_carts as sc "+
          "where ci.cartid = sc.id and ci.prodid = %L "+
          "and sc.userid = %L", id, req.session.userId));
        res.redirect(303, '/cart');
    },
    postAddToCart: async function(req, res) {
        let id = req.body.id;
        let quant = req.body.quant;

        let data = await client.query(sqlFormatter(
          "select id from shopping_carts where userid = %L;", req.session.userId));
        let cartId = data.rows[0].id;
        let ciData = await client.query(sqlFormatter(
          "select * from cart_items where cartid = %L and prodid = %L;", cartId, id));
        if(ciData.rows.length == 0){
            await client.query(sqlFormatter(
              "insert into cart_items (prodid, quantity, cartid, modified) "+
              "values(%L, %L, %L, false);", id, quant, cartId));
        }else{
            await client.query(sqlFormatter(
              "update cart_items set quantity = quantity + %L "+
              "where cartid = %L and prodid = %L", quant, cartId, id))
        }
    },
    postChangeQuant: function(req, res) {
        let num = req.body.num;
        let pid = req.body.pid;
        let iid = req.body.iid;
        client.query(sqlFormatter("update cart_items set quantity = %L where id = %L ", num, iid));
    },
    postRemoveFromCart: function(req, res) {
        let itemId = req.body.id;

        client.query(sqlFormatter("delete from cart_items as ci using shopping_carts as sc where ci.cartid = sc.id and ci.prodId = %L and sc.userid = %L", itemId, req.session.userId));
    },
    postCart: function(req, res) {
        res.redirect(303, '/buy');
    }
}
