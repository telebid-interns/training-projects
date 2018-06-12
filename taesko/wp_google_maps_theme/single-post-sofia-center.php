<?php
/**
 * The template for displaying all single posts
 *
 * @link https://developer.wordpress.org/themes/basics/template-hierarchy/#single-post
 *
 * @package WordPress
 * @subpackage Twenty_Seventeen
 * @since 1.0
 * @version 1.0
 */

?>

<?php
function echo_from_txt() {
    $file_path = getcwd() . '/wp-content/themes/twentyseventeen/bg_locations.txt';
    $contents = file($file_path);
    foreach($contents as $line) {
        $columns = explode(",", $line);
        echo "{$columns[1]} {$columns[2]} ";
    }
}
function echo_from_db() {
    global $wpdb;
    $results = $wpdb->get_results("SELECT * from wp_map_markers", ARRAY_A);
    foreach($results as $result) {
        // echo join(', ', $result), "\n", "<br>";
        echo $result['latitude'] . ' ' . $result['longtitude'] . ' ';
    }
  
}
function echo_dm_cls() {
    echo "data-markers=\"";
    echo_from_db();
    echo "\"";
}
?>
<html <?php language_attributes(); ?> class="no-js no-svg">
    <head>
        <meta charset="<?php bloginfo( 'charset' ); ?>">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <link rel="profile" href="http://gmpg.org/xfn/11">

        <?php wp_head(); ?>
        <style>
            html, body, #page, .site-content-contain, #content {
            height: 100%;
            width: 100%;
            padding: 0;
            margin: 1em, 0, 0, 0;
        }
            #map {
            height: 100%;
            width: 100%;
        } 
        </style>
    </head>
    <body>
        <div id="map" <?php echo_dm_cls() ?> ></div>
    </body>
    <script type="text/javascript" src="https://developers.google.com/maps/documentation/javascript/examples/markerclusterer/markerclusterer.js"></script>
    <script src="https://maps.googleapis.com/maps/api/js?key=AIzaSyDe8Gok8E-1JFGtCRm24aZBnbFstkP3fyA&callback=initMap"></script>
    <script type="text/javascript">google_map()</script>
</html>
