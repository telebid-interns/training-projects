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

  add_shortcode('GMaps-map', 'add_map');
  add_action('wp_enqueue_scripts', 'enqueue_scripts');

  function enqueue_scripts () {
    wp_enqueue_script( 'init_maps', plugin_dir_url( __FILE__ ) . '/js/init-maps.js', array(), null, true);
  }

  function add_map ($atts) {
    try {
      if (array_key_exists('key', $atts) !== true) {
        throw new InvalidArgumentException("Shortcode must have an API key parameter");
      }

      if (isset($GLOBALS['key']) && $GLOBALS['key'] !== $atts['key']) {
        throw new Exception("Shortcode must have an API key parameter"); 
      }

      $GLOBALS['key'] = $atts['key'];

      wp_enqueue_script( 'google_api_script', 'https://maps.googleapis.com/maps/api/js?key=' . $GLOBALS['key'] . '&callback=initMaps', array(), null, true);

      return '<div id="' . $atts['id'] . '" class="gmaps-map" style="width: ' . $atts['width'] . 'px; height: ' . $atts['height'] . 'px" data-markers="' . $atts['markers'] . '" data-zoom="' . $atts['zoom'] . '" data-center="' . $atts['center'] . '"></div>';
    } catch (Exception $e) {

      if (WP_DEBUG === true) {
        error_log(print_r($e->getMessage(), true));
      }

      return '<div>There was an error in shortcode [GMaps-map]</div>';
    }
  }
?>
