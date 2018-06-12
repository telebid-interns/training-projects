<?php
/**
*Plugin Name: Google maps API task
**/
  $locations = $wpdb->get_results('SELECT address, lat, lng FROM locations;');

  function gmaps_api_task()
  {
    global $locations;
    $content = '<div id="map" style="height: 400px; width: 100%;"></div>';
  ?>
  <script>
    <?php echo 'var locations = '.json_encode($locations).';';?>;   
    function initMap() {
      var usa = {lat: 37.275, lng: -95.655};
      var map = new google.maps.Map(document.getElementById('map'), {
        zoom: 3,
        center: usa
      });
      locations.forEach(location => {
        var infoWindow = new google.maps.InfoWindow({
          content: location.address
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
