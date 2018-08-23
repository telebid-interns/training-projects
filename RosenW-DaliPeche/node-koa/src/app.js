const Koa = require('koa');
const { DEFAULT_PORT } = require('./utils/consts.js');
const mount = require('koa-mount');
const api = require('./api/api.js');
const frontOffice = require('./server/front_office.js');
const backOffice = require('./server/back_office.js');
const bodyParser = require('koa-bodyparser');
const serve = require('koa-static');
const views = require('koa-views');
const { PeerError, UserError } = require('./asserts/exceptions.js');
const session = require('koa-session');

const app = new Koa();

app.use(serve(`${__dirname}/server/public/css`));
app.use(serve(`${__dirname}/server/public/js`));

app.use(views(`${__dirname}/server/views`, {
  extension: 'hbs',
  map: { hbs: 'handlebars' }, // marks engine for extensions
  options: {
    partials: {
      adminForm: `./admin_form`, // requires ./admin_form.hbs
    },
  },
}));

app.keys = ['DaliKrieTaini'];

// (cookie lifetime): (Milliseconds)
app.use(session({ maxAge: 1000 * 60 * 60 * 24 }, app));

// Error Handling
app.use(async (ctx, next) => {
  try {
    await next();
  } catch (err) {
    if (err instanceof UserError) {
      ctx.body = {
        message: err.message,
        statusCode: err.statusCode,
      };
    } else if (err instanceof PeerError) {
      ctx.body = {
        message: err.message,
        statusCode: err.statusCode,
      };
    } else {
      console.log(err);
      console.log(`Application Error: ${err.message}, Status code: ${err.statusCode}`);
      ctx.body = 'An error occured please clear your cookies and try again';
    }
  }
});

app.use(bodyParser());
app.use(mount('/api', api));
app.use(mount('/', frontOffice));
app.use(mount('/admin', backOffice));

const server = app.listen(DEFAULT_PORT, () => {
  console.log(`App Server listening on port: ${DEFAULT_PORT}`);
});
