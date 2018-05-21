let client = require('../../database/db');
let sqlFormatter = require('pg-format');
let u = require('../../utils/utils');

module.exports = {
    getHome: function(req, res, next) {
        let passNotfic = false;
        let profileInfoNotific = false;
        let linkSentToMail = false;
        if(req.query.pc==1){
            passNotfic = true;
          }
        if(req.query.pi==1){
            profileInfoNotific = true;
        }
        if(req.query.reg==1){
            linkSentToMail = true;
        }
        let categories = [];
        let eightNewProds = [];
        let threeNewProds = [];
        client.query("select * from categories")
        .then((cats) => {
            client.query("select * from products as p order by p.name limit 11")
            .then((newproducts) => {
    
                for(let i = 0; i<8;i++){
                    eightNewProds.push(newproducts.rows[i]);
                }
    
                for(let i = 8; i<11;i++){
                    threeNewProds.push(newproducts.rows[i]);
                }
    
                cats.rows.forEach((cat)=>{
                    categories.push(cat);
                });
    
                if(!req.session.admin){
                    res.render('categories', {
                        data: {
                            'isLoggedIn': req.session.loggedIn,
                            'user': req.session.username,
                            'isAdmin': req.session.admin,
                            'cats': categories,
                            'eight': eightNewProds,
                            'three': threeNewProds,
                            'pc': passNotfic,
                            'pi': profileInfoNotific,
                            'reg': linkSentToMail
                        }
                    });
                }else{
                    let groupedCategories = [];
                    for(let i=0;i<categories.length;i++){
                        let newGroup = [];
                        newGroup.push(categories[i]);
                        newGroup.push(categories[++i]);
                        groupedCategories.push(newGroup);
                    }
                    console.log(groupedCategories);
                    res.render('oldCategories', {
                        data: {
                            'isLoggedIn': req.session.loggedIn,
                            'user': req.session.username,
                            'isAdmin': req.session.admin,
                            'cat': groupedCategories,
                            'eight': eightNewProds,
                            'three': threeNewProds,
                            'pc': passNotfic,
                            'pi': profileInfoNotific,
                            'reg': linkSentToMail
                        }
                    });
                }
                
            });
        });
    },
    postHome: function(req, res, next) {
        let word = req.body.name;
        let products = [];
        let count = 1;
        if (/^[a-zA-Z]+$/.test(word)) {
            client.query(sqlFormatter("select * from products as p order by name"))
                .then((data) => {
                    data.rows.forEach((row) => {
                        row.number = count++;
                        if (row.name.toLowerCase().includes(word.toLowerCase())) {
                            products.push(row);
                        }
                    });
                    res.render('index', {
                        data: {
                            'isLoggedIn': req.session.loggedIn,
                            'user': req.session.username,
                            'isAdmin': req.session.admin,
                            'prods': products
                        }
                    });
                });
        } else {
            res.redirect(303, '/');
        }
    },
    getCategory: function(req, res, next) {
        let products = [];
        let catId = req.params.id;
        client.query(sqlFormatter("select * from products as p " +
                "join products_categories as pc on pc.product = p.id " +
                "where pc.category = %L order by p.name", catId))
            // "join categories as c on c.id = pc.category "+
            .then((prods) => {
                client.query(
                    sqlFormatter(
                        "select c.name as cname from categories as c "+
                        "where c.id = %L limit 1", catId))
                .then((catData) => {
                    console.log(catId);
                    console.log(catData.rows);
                    let number = 0;
                    prods.rows.forEach((prod) => {
                        prod.number = ++number;
                        prod.price = u.addTrailingZeros(prod.price);
                        products.push(prod);
                    });
                    if(!req.session.admin){
                        res.render('newIndex', {
                            data: {
                                'isLoggedIn': req.session.loggedIn,
                                'user': req.session.username,
                                'isAdmin': req.session.admin,
                                'prods': products,
                                'cname': catData.rows[0].cname
                            }
                        });
                    }else{
                        res.render('index', {
                            data: {
                                'isLoggedIn': req.session.loggedIn,
                                'user': req.session.username,
                                'isAdmin': req.session.admin,
                                'prods': products
                            }
                        });
                    }
                });
            });
    },
    getAll: function(req, res, next) {
        if (!req.session.admin) {
            res.redirect(303, '/');
        }
        let products = [];
        let catId = req.params.id;
        client.query(sqlFormatter("select * from products as p order by name"))
            .then((prods) => {
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
            })
    }
}