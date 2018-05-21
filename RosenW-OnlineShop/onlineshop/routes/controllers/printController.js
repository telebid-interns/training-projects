let client = require('../../database/db');
let sqlFormatter = require('pg-format');
let u = require('../../utils/utils');
let net = require('net');
let lp = require('node-lp');
let cmd = require('node-cmd');

let HOST = '10.20.1.104';
let PORT = 9100;

let lineFeedCommand = new Buffer([0x0A, 0x0A, 0x0A, 0x0A, 0x0A, 0x0A]);
let cutCommand = new Buffer([0x1B, 0x69]);
let setBoldCommand = new Buffer([0x1B, 0x21, 0x128]);
let setNormalCommand = new Buffer([0x1B, 0x21, 0x00]);
let newLineCommand = new Buffer([0x0A]);

module.exports = {
    getPrint: function(req, res, next) {
        if (!req.session.admin) {
            res.redirect(303, '/');
        }
        client.query(sqlFormatter('select * from printformats where id = 1'))
        .then((data)=>{
            let format = data.rows[0].format;
            res.render('print', {
                data: {
                    'isLoggedIn': req.session.loggedIn,
                    'user': req.session.username,
                    'isAdmin': req.session.admin,
                    'format': format
                }
            });
        });
    },
    postPrintFormat: function(req, res, next) {
        if (!req.session.admin) {
            res.redirect(303, '/');
        }
    
        let newFormat = req.body.format;
        client.query(sqlFormatter("update printformats set format = %L where id = 1", newFormat))
            .then(res.redirect(303, '/check'));
    },
    postPrint: function(req, res) {
        let total = req.body.total.substr(1,);
        let user = req.body.user;
        let names = req.body['names[]'];
        let qs = req.body['qs[]'];
        let prices = req.body['prices[]'];
        client.query(sqlFormatter('select * from printformats where id = 1'))
        .then((data)=>{
            client.query(sqlFormatter('select first_name from accounts where id = %L', user))
            .then((userRow)=>{
                let curUser = userRow.rows[0].first_name;
                let format = data.rows[0].format;
                let info = '';
                for(let i = 0; i<names.length;i++){
                    info += names[i] + ' - ' + qs[i] + ' - ' + prices[i].substr(1,) + '\n';
                }
                format = format.replace(/!I/g, info);
                format = format.replace(/!T/g, total);
                format = format.replace(/!U/g, curUser);
                format = format.replace(/ESC/g, '\x1b');
                format = format.replace(/GS/g, '\x1d');
    
                cmd.get('echo "'+format+'" | lp', function(err, data, stderr){
                });
    
                // deprecated printing
                // format.split(/\n/).forEach((line)=>{
                //     if(line.trim().startsWith('ESC')){ //////////////Handling ESC commands
                //         givePrinterCommand(27, line);
                //     }else if(line.trim().startsWith('GS')){ /////////Handling GS commands
                //         givePrinterCommand(29, line);
                //     }else{
                //         bixolon.write(line);
                //         bixolon.write(newLineCommand);
                //     }
                // });
                // bixolon.write(lineFeedCommand);
                // bixolon.write(cutCommand);
            });
        });
    }
}