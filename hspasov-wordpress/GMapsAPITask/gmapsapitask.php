<?php
/**
*Plugin Name: Google maps API task
**/
  global $wpdb;
  $locations = $wpdb->get_results('SELECT address, elevation, elevation_unit, data_coverage, min_date, max_date, lat, lng FROM locations;');

  function gmaps_api_task()
  {
    global $locations;
    $content = '<div>
      <div id="map" style="height: 400px; width: 100%;"></div>
      <div>
        <div>
          <label>Elevation:</label>
          <label for="from_elevation">From</label>
          <input id="from_elevation" type="number" step="0.1">
          <label for="to_elevation">To</label>
          <input id="to_elevation" type="number" step="0.1">
          <hr>
        </div>
        <div>
          <label>Coverage:</label>
          <label for="from_data_coverage">From</label>
          <input id="from_data_coverage" type="number" step="0.0001">
          <label for="to_data_coverage">To</label>
          <input id="to_data_coverage" type="number" step="0.0001">
          <hr>
        </div>
        <div>
          <label>Data between:</label>
          <label for="from_date">From</label>
          <input id="from_date" type="data" step="0.0001">
          <label for="to_date">To</label>
          <input id="to_date" type="data" step="0.0001">
          <hr>
        </div>
        <div>
          <label>Coordinates:</label>
          <div>
            <label>Latitude:</label>
            <label for="from_lat">From</label>
            <input id="from_lat" type="number" step="0.00001">
            <label for="to_lat">To</label>
            <input id="to_lat" type="number" step="0.00001">
          </div>
          <div>
            <label>Longitude:</label>
            <label for="from_lng">From</label>
            <input id="from_lng" type="number" step="0.00001">
            <label for="to_lng">To</label>
            <input id="to_lng" type="number" step="0.00001">
          </div>
          <hr>
        </div>
        <div>
          <button id="submit_filter" onclick="submitFilter()">Submit filter</button>
          <button id="reset_filter" onclick="resetFilter()">Reset filter</button>
        </div>
      </div>
    </div>';
  ?>
  <script>
    <?php echo 'var locations = '.json_encode($locations).';';?>;

    var map = null;
    var markers = [];

    function parseInputDateRange(fromInput, toInput) {
      var range = {};
      var swap = null;

      if (!fromInput.value || !toInput.value) {
        range.from = null;
        range.to = null;
      } else {
        range.from = fromInput.value;
        range.to = toInput.value;

        if (new Date(range.from) > new Date(range.to)) {
          swap = range.from;
          range.from = range.to;
          range.to = swap;
        }
      }

      return range;
    }

    function parseInputFloatRange(fromInput, toInput) {
      var range = {};
      var swap = null;

      if (!fromInput.value || !toInput.value) {
        range.from = null;
        range.to = null;
      } else {
        range.from = parseFloat(fromInput.value);
        range.to = parseFloat(toInput.value);
        
        if (range.from > range.to) {
          swap = range.from;
          range.from = range.to;
          range.to = swap;
          swap = null;
        }
      }

      return range;
    }

    function submitFilter() {
      var fromElevationInput = document.getElementById('from_elevation');
      var toElevationInput = document.getElementById('to_elevation');
      var fromDataCoverageInput = document.getElementById('from_data_coverage');
      var toDataCoverageInput = document.getElementById('to_data_coverage');
      var fromDateInput = document.getElementById('from_date');
      var toDateInput = document.getElementById('to_date');
      var fromLatInput = document.getElementById('from_lat');
      var toLatInput = document.getElementById('to_lat');
      var fromLngInput = document.getElementById('from_lng');
      var toLngInput = document.getElementById('to_lng');

      if (!(
        fromElevationInput &&
        toElevationInput &&
        fromDataCoverageInput &&
        toDataCoverageInput &&
        fromDateInput &&
        toDateInput &&
        fromLatInput &&
        toLatInput &&
        fromLngInput &&
        toLngInput
       )) {
        console.log('Error: invalid submit format');
        return;
      }

      var elevation = parseInputFloatRange(fromElevationInput, toElevationInput);
      var dataCoverage = parseInputFloatRange(fromDataCoverageInput, toDataCoverageInput);
      var data = parseInputDateRange(fromDateInput, toDateInput);
      var lat = parseInputFloatRange(fromLatInput, toLatInput);
      var lng = parseInputFloatRange(fromLngInput, toLngInput);

      var xmlhttp = new XMLHttpRequest();
      
      xmlhttp.open('GET', '../../filter-locations.php?elevation_from=' + (elevation.from === null? '%00' :  encodeURIComponent(elevation.from)) +
        '&elevation_to=' + (elevation.to? encodeURIComponent(elevation.to) : '%00') +
        '&data_coverage_from=' + (dataCoverage.from? encodeURIComponent(dataCoverage.from) : '%00') +
        '&data_coverage_to=' + (dataCoverage.to? encodeURIComponent(dataCoverage.to) : '%00') +
        '&data_from=' + (data.from? encodeURIComponent(data.from) : '%00') +
        '&data_to=' + (data.to? encodeURIComponent(data.to) : '%00') +
        '&lat_from=' + (lat.from? encodeURIComponent(lat.from) : '%00') +
        '&lat_to=' + (lat.to? encodeURIComponent(lat.to) : '%00') +
        '&lng_from=' + (lng.from? encodeURIComponent(lng.from) : '%00') +
        '&lng_to=' + (lng.to? encodeURIComponent(lng.to) : '%00')
      );

      xmlhttp.onreadystatechange = function() {
        if (xmlhttp.readyState == XMLHttpRequest.DONE) {
          locations = JSON.parse(xmlhttp.responseText);
          clearMarkers();
          initMap();
        }
      }
      xmlhttp.setRequestHeader('Content-Type', 'application/json');
      xmlhttp.send(JSON.stringify({
        elevation: elevation,
        dataCoverage: dataCoverage,
        data: data,
        lat: lat,
        lng: lng
      }))
    }

    function resetFilter() {
      document.getElementById('from_elevation').value = '';
      document.getElementById('to_elevation').value = '';
      document.getElementById('from_data_coverage').value = '';
      document.getElementById('to_data_coverage').value = '';
      document.getElementById('from_date').value = '';
      document.getElementById('to_date').value = '';
      document.getElementById('from_lat').value = '';
      document.getElementById('to_lat').value = '';
      document.getElementById('from_lng').value = '';
      document.getElementById('to_lng').value = '';
      clearMarkers();
      initMap();
    }

    function clearMarkers() {
      markers.forEach(marker => {
        marker.setMap(null);
      });
      markers.length = 0;
    }

    function initMap() {
      var usa = {lat: 37.275, lng: -95.655};
      
      markers.length = 0;
      
      map = new google.maps.Map(document.getElementById('map'), {
        zoom: 3,
        center: usa
      });
      
      locations.forEach(location => {
        var infoWindow = new google.maps.InfoWindow({ 
          content: `address: ${location.address},
            elevation: ${location.elevation},
            elevation_unit: ${location.elevation_unit},
            data_coverage: ${location.data_coverage},
            min_date: ${location.min_date},
            max_date: ${location.max_date},
            lat: ${location.lat},
            lng: ${location.lng}` 
        });
        var marker = new google.maps.Marker({
          position: {
            lat: parseFloat(location.lat),
            lng: parseFloat(location.lng)
          },
          map: map
        });
        marker.addListener('click', () => {
          infoWindow.open(map, marker);
        });

        markers.push(marker);
      });
    }
  </script>
  <script async defer
    src='https://maps.googleapis.com/maps/api/js?key=AIzaSyA9HxwNfmUEyBe1F2NV72n2PJRxy81ss9Q&callback=initMap'>
  </script>
  <?php
    return $content;
  }
  add_shortcode('gmapsapitask', 'gmaps_api_task');
?>
