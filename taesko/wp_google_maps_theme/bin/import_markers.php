#!/opt/lampp/bin/php
<?php
define('SHORTINIT', true);

require("/opt/lampp/apps/wordpress/htdocs/wp-load.php");

global $wpdb;
$file_path = $argv[1];
$contents = file($file_path);
$values = array();
$place_holders = array();
$query = "INSERT INTO wp_map_markers (name, latitude, longtitude) VALUES ";
foreach($contents as $line) {
    $raw_data = explode(",", $line);
    array_push($values, $raw_data[0], $raw_data[1], $raw_data[2]);
    $place_holders[] = "(%s, %f, %f)";
}
$query .= implode(", ", $place_holders);
// clear old data
$wpdb->query("DELETE FROM wp_map_markers");
$wpdb->query($wpdb->prepare("$query ", $values));
