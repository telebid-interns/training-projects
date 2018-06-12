const Koa = require('koa');
const logger = require('koa-logger');
const bodyParser = require('koa-bodyparser');
const serve = require('koa-static');
const session = require('koa-session');
const { Client } = require('pg');
const path = require('path');
const routes = require('./routes/admin');

// Create app
const app = new Koa();

// Create a database connection client
const client = new Client({
  user: process.env.PGUSER,
  database: process.env.PGDATABASE,
  password: process.env.PGPASSWORD,
  port: process.env.PGPORT
});
client.connect();

app.use(logger());
app.use(session(app));
app.use(bodyParser());
app.use(serve(path.join(__dirname, 'public')));

app.context.db = client;
app.use(routes);

app.listen(3001);

console.log('Listening on 3001...');
