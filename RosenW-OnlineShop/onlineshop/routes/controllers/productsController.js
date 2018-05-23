let client = require('../../database/db');
let sqlFormatter = require('pg-format');
let u = require('../../utils/utils');

module.exports = {
    getAddProduct: async function(req, res, next) {
        if (!req.session.admin) {
            res.redirect(303, '/');
        }
        let ctg = [];
        let data = await client.query(sqlFormatter("select * from categories"));
        await data.rows.forEach((row) => ctg.push(row.name));
        res.render('add', {
            data: {
                'isLoggedIn': req.session.loggedIn,
                'user': req.session.username,
                'isAdmin': req.session.admin,
                'ctg': ctg
            }
        });
    }
}
