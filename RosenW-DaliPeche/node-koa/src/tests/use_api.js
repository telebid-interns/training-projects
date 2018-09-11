let fetch = require("node-fetch");

const address = 'http://127.0.0.1:3001/api/forecast';
const API_CALLS_PER_USER = 50;

(async () => {
  for (let i = 0; i < API_CALLS_PER_USER; i++) {
    console.log(i);
    await fetch(address, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({city: 'Sofia', key: 'rQMdEUdSPGHOaaY0'}), //ivan
      }
    );
    await fetch(address, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({city: 'Sofia', key: '4cnhuGXlu2XFKf8T'}), //Rosen
      }
    );
    await fetch(address, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({city: 'Sofia', key: 'QMsnZ0jMZW2cbcFg'}), //Gosho
      }
    );
    await fetch(address, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({city: 'Sofia', key: 'TnE06o6rY4P4NFaF'}), //Toni
      }
    );
    await fetch(address, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({city: 'Sofia', key: '1EsK8Y58TgiLSQ4k'}), //foobar
      }
    );
  }
})();
