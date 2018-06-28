(async () => {
  const fetch = require('node-fetch');
  const toQueryString = require('./to-query-string');
  const { toKiwiAPIDateFormat } = require('./date-format');
  const { select } = require('./db');

  const subscriptions = select(['fly_from', 'fly_to'], 'subscriptions');
  // await db.all('SELECT fly_from, fly_to FROM subscriptions;');
  console.log('subscriptions:', subscriptions);

  const query = {
    jsonrpc: 2.0,
    method: 'search',
    params: {
      v: 1.0,
      fly_from: 'SOF',
      fly_to: 'JFK',
      price_to: 1000,
      currency: 'EUR',
      date_from: '2018-06-28',
      date_to: '2018-09-28',
      sort: 'price',
      max_fly_duration: 10
    },
    id: 1
  };

  // TODO use JSON validator

  const params = query.params;

  console.log(query);
  console.log(toQueryString);
  let queryString = toQueryString({
    flyFrom: params.fly_from,
    to: params.fly_to,
    dateFrom: toKiwiAPIDateFormat(params.date_from),
    dateTo: toKiwiAPIDateFormat(params.date_to),
    maxFlyDuration: params.max_fly_duration,
    typeFlight: 'oneway',
    partner: 'picky',
    v: '2',
    xml: '0',
    curr: params.currency,
    locale: 'en',
    price_to: params.price_to,
    offset: '0',
    limit: '30',
    sort: params.sort,
    asc: '1'
  });

  fetch(`https://api.skypicker.com/flights?${queryString}`).then((res) => {
    console.log(res);
  }).catch((err) => {
    console.error(err);
  });
})();
