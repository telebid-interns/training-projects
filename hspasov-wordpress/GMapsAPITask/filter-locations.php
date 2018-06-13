<?php
  $str_json = file_get_contents('php://input');
  $filter = json_decode($str_json, true); // 'true' parameter makes json_decode return an array

  $query = 'SELECT address, elevation, elevation_unit, data_coverage, min_date, max_date, lat, lng 
    FROM locations WHERE
    elevation >= COALESCE(%f, elevation) AND elevation <= COALESCE(%f, elevation) AND
    data_coverage >= COALESCE(%f, data_coverage) AND data_coverage <= COALESCE(%f, data_coverage) AND
    max_date >= COALESCE(%s, max_date) AND min_date <= COALESCE(%s, min_date) AND
    lat >= COALESCE(%f, lat) AND lat <= COALESCE(%f, lat) AND
    lng >= COALESCE(%f, lng) AND lng <= COALESCE(%f, lng);';
  
  $filtered = $wpdb->get_results($wpdb->prepare(
    $query, 
    $filter['elevation']['from'],
    $filter['elevation']['to'],
    $filter['dataCoverage']['from'],
    $filter['dataCoverage']['to'],
    $filter['date']['from'],
    $filter['date']['to'],
    $filter['lat']['from'],
    $filter['lat']['to'],
    $filter['lng']['from'],
    $filter['lng']['to']
    )
  );
  header('Content-Type: application/json');
  echo json_encode($filtered);
?>