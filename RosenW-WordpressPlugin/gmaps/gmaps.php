<?php
  /**
   * Plugin Name: GMaps
   * Description: Replaces [GMaps-map] with an actual google map
   * Version: 0.2
   * Author: Rosen
   */

  /*
  * Use example:
  *
  * [GMaps-map markers="(18, 16);(12, 33)" zoom="1" center="(52, 162)" width="600" height="600" key="API_KEY_HERE"]
  */

  defined('ABSPATH') or die('ABSPATH not defined');

  // throw new Exception("Error Processing Request", 1);
  add_shortcode('GMaps-map', 'add_map');
  add_action('wp_enqueue_scripts', 'enqueue_scripts');

  function enqueue_scripts () {
    wp_enqueue_script( 'init_maps', plugin_dir_url( __FILE__ ) . '/js/init-maps.js', array(), null, true);
  }

  function add_map ($atts) {
    try {
      assert(array_key_exists('key', $atts) == true);

      wp_enqueue_script( 'google_api_script', 'https://maps.googleapis.com/maps/api/js?key=' . $atts['key'] . '&callback=initMaps', array(), null, true);

      return '<div class="gmaps-map" style="width: ' . $atts['width'] . 'px; height: ' . $atts['height'] . 'px" data-markers="' . $atts['markers'] . '" data-zoom="' . $atts['zoom'] . '" data-center="' . $atts['center'] . '"></div>';
    } catch (Exception $e) {
      log_error($e);
      return '<div>There was an error in shortcode [GMaps-map]</div>';
    }
  }

  function log_error ($error) {
    try {
      $file = fopen(plugin_dir_url( __FILE__ ) . '/logs/error.log', 'a');
      fputs($file, $error);
      fclose($file);
      // print_r($error);
    } catch (Exception $e) {
      print_r($e);
    }
  }
?>
