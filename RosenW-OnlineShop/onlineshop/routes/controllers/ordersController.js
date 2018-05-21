let client = require('../../database/db');
let sqlFormatter = require('pg-format');
let u = require('../../utils/utils');

module.exports = {
    getOrders: function(req, res, next) {
        if (!req.session.loggedIn) {
            res.redirect(303, '/');
        }
        let successfulPurchase = false;
        if(req.query.sp==1){
            successfulPurchase = true;
        }
        let orders = [];
        let purchases = [];
        let count = 1;
        client.query(sqlFormatter(  
                'select p.id, p.date, s.name as state ' +
                'from purchases as p join states as s on s.id = p.state ' +
                'where p.userid = %L order by state asc, p.date desc', req.session.userId))
            .then((data) => {
                data.rows.forEach((row) => {
                    row.number = count++;
                    purchases.push(row);
                });
                client.query(sqlFormatter(  'select pi.prodname as name, pi.quantity, ' +
                                            'pi.prodprice as price, pur.id as pid '+
                                            'from purchase_items as pi '+
                                            'join purchases as pur on pi.purchaseId = pur.id ' +
                                            'where pur.userid = %L ' +
                                            'order by pi.prodname', req.session.userId))
                    .then((oData) => {
                        oData.rows.forEach((row) => {
                            row.price = u.addTrailingZeros(row.price * row.quantity);
                            orders.push(row);
                        });
    
                        purchases.forEach((p) => {
                            let total = 0;
                            p.orderList = []
                            orders.forEach((o) => {
                                if (p.id == o.pid) {
                                    total += Number(o.price);
                                    p.orderList.push(o);
                                }
                            });
                            p.total = u.addTrailingZeros(total);
                        });
                        res.render('orders', {
                            data: {
                                'isLoggedIn': req.session.loggedIn,
                                'user': req.session.username,
                                'isAdmin': req.session.admin,
                                'purchases': purchases,
                                'sp': successfulPurchase
                            }
                        });
                    });
            });
    }
}