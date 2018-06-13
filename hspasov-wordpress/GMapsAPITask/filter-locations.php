<?php
  require('wp-load.php');

  global $wpdb;

  $query = 'SELECT address, elevation, elevation_unit, data_coverage, min_date, max_date, lat, lng 
    FROM locations WHERE
    elevation >= COALESCE(%f, elevation) AND elevation <= COALESCE(%f, elevation) AND
    data_coverage >= COALESCE(%f, data_coverage) AND data_coverage <= COALESCE(%f, data_coverage) AND
    max_date >= COALESCE(%s, max_date) AND min_date <= COALESCE(%s, min_date) AND
    lat >= COALESCE(%f, lat) AND lat <= COALESCE(%f, lat) AND
    lng >= COALESCE(%f, lng) AND lng <= COALESCE(%f, lng);';
  
  $prepared = $wpdb->prepare(
    $query,
    $_GET['elevation_from'],
    $_GET['elevation_to'],
    $_GET['data_coverage_from'],
    $_GET['data_coverage_to'],
    $_GET['data_from'],
    $_GET['data_to'],
    $_GET['lat_from'],
    $_GET['lat_to'],
    $_GET['lng_from'],
    $_GET['lng_to']
  );

  echo $prepared; 

  // $filtered = $wpdb->get_results($wpdb->prepare(
  //   $query, 
  //   ['elevation_from'],
  //   $_GET['elevation_to'],
  //   $_GET['data_coverage_from'],
  //   $_GET['data_coverage_to'],
  //   $_GET['data_from'],
  //   $_GET['data_to'],
  //   $_GET['lat_from'],
  //   $_GET['lat_to'],
  //   $_GET['lng_from'],
  //   $_GET['lng_to']
  //   )
  // );
  // header('Content-Type: application/json');
  // echo json_encode($filtered);
?>