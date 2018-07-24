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
