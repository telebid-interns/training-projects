<?php
  /**
   * Plugin Name: My Map // TODO name plugin
   * Description: Replaces [map] with an actual interactable map // TODO finish description 
   * Version: 0.1
   * Author: Rosen
   */

  defined('ABSPATH') or die('ABSPATH not defined'); // TODO read some more on this
  // TODO research security flaws and stuff

  add_shortcode('map', 'generate_map');

  function generate_map (/* TODO should accept array of marker coords or smth ?*/) {
    // TODO error handling
    // TODO generate map

    return '
      <style>
        #map {
          height: 400px;
          width: 100%;
         }
      </style>
      <div id="map"></div>
      <script> 
        function initMap() {
          var uluru = {lat: -25.344, lng: 131.036};
          var map = new google.maps.Map(
              document.getElementById("map"), {zoom: 4, center: uluru});
          var marker = new google.maps.Marker({position: uluru, map: map});
        } 
      </script>
      <script async defer src="https://maps.googleapis.com/maps/api/js?key=AIzaSyDrLczSe8MEo3k5FAwo1Kc3fkn26NB-VUQ&callback=initMap"></script>
    ';
  }
?>