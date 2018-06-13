<?php
  require('wp-load.php');

  global $wpdb;

  $query = 'SELECT address, elevation, elevation_unit, data_coverage, min_date, max_date, lat, lng 
  FROM locations WHERE';

  $query_parameters = array();

  if ($_GET['elevation_from'] !== '\0' && $_GET['elevation_to'] !== '\0') {
    $query .= ' elevation >= %f AND elevation <= %f';
    array_push($query_parameters, $_GET['elevation_from'], $_GET['elevation_to']);
  } else {
    $query .= ' 1 = 1';
  }
  if ($_GET['data_coverage_from'] !== '\0' && $_GET['data_coverage_to'] !== '\0') {
    $query .= ' AND data_coverage >= %f AND data_coverage <= %f';
    array_push($query_parameters, $_GET['data_coverage_from'], $_GET['data_coverage_to']);
  }
  if ($_GET['data_from'] !== '\0' && $_GET['data_to'] !== '\0') {
    $query .= ' AND max_date >= %s AND min_date <= %s';
    array_push($query_parameters, $_GET['data_from'], $_GET['data_to']);
  }
 
  if ($_GET['lat_from'] !== '\0' && $_GET['lat_to'] !== '\0') {
    $query .= ' AND lat >= %f AND lat <= %f';
    array_push($query_parameters, $_GET['lat_from'], $_GET['lat_to']);
  }

  if ($_GET['lng_from'] !== '\0' && $_GET['lng_to'] !== '\0') {
    $query .= ' AND lng >= %f AND lng <= %f';
    array_push($query_parameters, $_GET['lng_from'], $_GET['lng_to']);
  }
  
  $query .= ';';

  // $query = 'SELECT address, elevation, elevation_unit, data_coverage, min_date, max_date, lat, lng 
  //   FROM locations WHERE
  //   elevation >= COALESCE(%f, elevation) AND elevation <= COALESCE(%f, elevation) AND
  //   data_coverage >= COALESCE(%f, data_coverage) AND data_coverage <= COALESCE(%f, data_coverage) AND
  //   max_date >= COALESCE(%s, max_date) AND min_date <= COALESCE(%s, min_date) AND
  //   lat >= COALESCE(%f, lat) AND lat <= COALESCE(%f, lat) AND
  //   lng >= COALESCE(%f, lng) AND lng <= COALESCE(%f, lng);';

  $prepared = NULL;

  if (sizeof($query_parameters) <= 0) {
    $prepared = $query;
  } else {
    $prepared = $wpdb->prepare(
      $query,
      $query_parameters
    );
  }

  $filtered = $wpdb->get_results($prepared);

  header('Content-Type: application/json');
  echo json_encode($filtered);
?>