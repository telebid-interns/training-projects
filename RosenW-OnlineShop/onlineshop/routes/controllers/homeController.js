let client = require('../../database/db');
let u = require('../../utils/utils');

module.exports = {
    getHome: async function(req, res, next) {
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
        let cats = await client.query("select * from categories");
        let newproducts = await client.query("select * from products as p order by p.name limit 11");
        for(let i = 0; i<8;i++){
            eightNewProds.push(newproducts.rows[i]);
        }

        for(let i = 8; i<11;i++){
            threeNewProds.push(newproducts.rows[i]);
        }

        await cats.rows.forEach((cat)=>{
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
    },
    postHome: async function(req, res, next) {
      let word = req.body.name;

      let count = 1;
      if (/^[a-zA-Z\s+]+$/.test(word)) {
        let data = await client.query(
          "select * from products where lower(name) like concat('%', $1::text, '%') order by name",
          [word.toLowerCase()]);
        let products = data.rows;
        products.forEach((prod)=>{
          prod.price = u.addTrailingZeros(prod.price);
        });
        if(req.session.admin){
          res.render('index', {
              data: {
                  'isLoggedIn': req.session.loggedIn,
                  'user': req.session.username,
                  'isAdmin': req.session.admin,
                  'prods': products
              }
          });
        }else{
          res.render('newIndex', {
              data: {
                  'isLoggedIn': req.session.loggedIn,
                  'user': req.session.username,
                  'isAdmin': req.session.admin,
                  'prods': products,
                  'cname': 'Searching Products By Name',
                  'word': word
              }
          });
        }
      } else {
          res.redirect(303, '/');
      }
    },
    getCategory: async function(req, res, next) {
      let products = [];
      let word = req.params.word;
      if(word == '*'){
        word = '';
      }
      let catId = req.params.id;
      let sort = Number(req.params.sort);
      let sortString;
      switch(sort){
        case 1:
          sortString = 'p.name';
          break;
        case 2:
          sortString = 'p.price';
          break;
      }
      let prods;
      let catData;
      if(catId == 0){
        prods = await client.query(
          "select distinct(p.id), p.name, p.price, p.quantity, p.img from products as p " +
          "join products_categories as pc on pc.product = p.id " +
          "where lower(name) like concat('%', $1::text, '%') " +
          "group by p.id " +
          "order by " + sortString, [word.toLowerCase()]);
      }else{
        prods = await client.query(
          "select distinct(p.id), p.name, p.price, p.quantity, p.img from products as p " +
          "join products_categories as pc on pc.product = p.id " +
          "where pc.category = $1 and lower(name) like concat('%', $2::text, '%') "+
          "order by " + sortString, [catId, word.toLowerCase()]);
        catData = await client.query(
          "select c.name as cname from categories as c " +
          "where c.id = $1 limit 1", [catId]);
      }
      let number = 0;
      await prods.rows.forEach((prod) => {
          prod.number = ++number;
          prod.price = u.addTrailingZeros(prod.price);
          products.push(prod);
      });
      if(word==''){
        word = '*';
      }
      let cname;
      if(catData==undefined){
        cname = 'Searching Products By Name';
      }else{
        cname = catData.rows[0].cname;
      }
      if(!req.session.admin){
        res.render('newIndex', {
            data: {
                'isLoggedIn': req.session.loggedIn,
                'user': req.session.username,
                'isAdmin': req.session.admin,
                'prods': products,
                'cname': cname,
                'catid': catId,
                'word': word
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
    },
    postCategory: async function(req, res, next) {
      let products = [];
      let word = req.params.word;
      if(word == '*'){
        word = '';
      }
      let catId = req.params.id;
      let sort = Number(req.params.sort);
      let newWord = req.body.name;

      if (/^[a-zA-Z\s+]+$/.test(newWord)) {
        let sortString;
        switch(sort){
          case 1:
            sortString = 'p.name';
            break;
          case 2:
            sortString = 'p.price';
            break;
        }
        let prods;
        let catData;
        if(catId == 0){
          prods = await client.query(
            "select distinct(p.id), p.name, p.price, p.quantity, p.img from products as p " +
            "join products_categories as pc on pc.product = p.id " +
            "where lower(name) like concat('%', $1::text, '%') "+
            "and lower(name) like concat('%', $2::text, '%') " +
            "group by p.id " +
            "order by " + sortString, [word.toLowerCase(), newWord.toLowerCase()]);
        }else{
          prods = await client.query(
            "select distinct(p.id), p.name, p.price, p.quantity, p.img from products as p " +
            "join products_categories as pc on pc.product = p.id " +
            "where pc.category = $1 and lower(name) like concat('%', $2::text, '%') " +
            "and lower(name) like concat('%', $3::text, '%') " +
            "order by " + sortString, [catId, word.toLowerCase(), newWord.toLowerCase()]);
          catData = await client.query(
            "select c.name as cname from categories as c " +
            "where c.id = $1 limit 1", [catId]);
        }
        let number = 0;
        await prods.rows.forEach((prod) => {
            prod.number = ++number;
            prod.price = u.addTrailingZeros(prod.price);
            products.push(prod);
        });
        if(word==''){
          word = '*';
        }
        let cname;
        if(catData==undefined){
          cname = 'Searching Products By Name';
        }else{
          cname = catData.rows[0].cname;
        }
        if(!req.session.admin){
          res.render('newIndex', {
              data: {
                  'isLoggedIn': req.session.loggedIn,
                  'user': req.session.username,
                  'isAdmin': req.session.admin,
                  'prods': products,
                  'cname': cname,
                  'catid': catId,
                  'word': word
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
      }else{
        res.redirect(303, '/')
      }
    }
}
