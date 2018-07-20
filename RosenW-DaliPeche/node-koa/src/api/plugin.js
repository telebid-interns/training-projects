(function($){
  const functions = {
    getForecastByCity: (city) => {
      console.log(city);
    }

    getForecastByIataCode: (iata) => {
      console.log(iata);
    }
  };

  $.fn.myapi = function(func) {
    if ( functions[func] ) {
      return functions[func];
    } else if ( typeof func === 'object' || !func ) {
      // Default to "init"
      return functions.init;
    } else {
      $.error( `Function ${func} does not exist` );
    }
  };
})( jQuery );

app.use(async (ctx, next) => {
  try {
    await next();
  } catch (err) {
    err.status = err.statusCode || err.status || 500;
    ctx.body = err.message;
    ctx.app.emit('error', err, ctx);
  }
});
