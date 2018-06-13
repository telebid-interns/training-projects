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
function explode_range($str) {
    $data = explode(':', $str);
    if(count($data) == 1 && $data[0]) {
        return ["min" => $data[0], "max"=>100000000000];
    }
    else if(count($data) > 1) {
        return ["min" => $data[0], "max"=>$data[1]];
    }
    else {
        return ["min" => -100000000000, "max"=> 1000000000000];
    }
}
function get_param($param, $default) {
    $val = get_query_var($param, $default);
    if ($val == '') {
        $val = $default;
    }
    return $val;
}
function echo_from_db() {
    global $wpdb;
    $loc_name = get_param('loc_name', '.*');
    $lat_coords = explode_range(get_param('lat', '-1000:1000'));
    $lng_coords = explode_range(get_param('lng', '-1000:1000'));
    $elevation = explode_range(get_param('ele', '0:10000'));
    $pop_range = explode_range(get_param('pop', '0:100000000000000'));
    $country_code = get_param('ccode', 'BG');
    $query = $wpdb->prepare("
        SELECT name, latitude, longitude from wp_map_markers
        WHERE (latitude BETWEEN %f AND %f) 
        AND (longitude BETWEEN %f AND %f)
        AND (elevation BETWEEN %f and %f)
        AND (name REGEXP '%s')
        AND (population BETWEEN %d AND %d)
        AND country_code='%s'",
        $lat_coords["min"], $lat_coords["max"], 
        $lng_coords["min"], $lng_coords["max"],
        $elevation["min"], $elevation["max"],
        $loc_name,
        $pop_range["min"], $pop_range["max"],
        $country_code
    );
    $results = $wpdb->get_results($query, ARRAY_A);
    foreach($results as $result) {
        $lat = $result['latitude'];
        $lng = $result['longitude'];
        echo "$lat $lng ";
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
            html, body {
                height: 100%;
                width: 100%;
                padding: 0;
                margin: 1em, 0, 0, 0;
            }
            #map {
                height: 100%;
                width: 100%;
            } 
            #filter_form {
                display: flex;
                text-align: center;
            }
            #button_container {
                display: flex;
                text-align: center;
                justify-content: center;
            }
        </style>
    </head>
    <body>
        <form id='filter_form' method='get' onsubmit="return submitFilter()">
            <div id='name_input_container' class='input_container'>
                <label for='loc_name'>Name:</label>
                <input type='text' name='loc_name'>
            </div>
            <div class='input_container'>
                <label for='pop'>Population:</label>
                <input type='text' name='pop'>
            </div>
            <div class='input_container'>
                <label for='ccode'>Country Code:</label>
                <input type='text' name='ccode'>
            </div>
            <div class='input_container'>
                <label for='lat'>Latitude</label>
                <input type='text' name='lat'>
                <span class='error' aria-live='polite'></span>
            </div>
            <div class='input_container'>
                <label for='lng'>Longtitude</label>
                <input type='text' name='lng'>
            </div>
            <div class='input_container'>
                <label for='ele'>Elevation</label>
                <input type='text' name='ele'>
            </div>
            <div id='button_container' class='input_container'>
                <button id='submit_button' type="submit">Filter</button>
            </div>
        </form>
        <div id="map" <?php echo_dm_cls() ?> ></div>
    </body>
    <script type="text/javascript" src="https://developers.google.com/maps/documentation/javascript/examples/markerclusterer/markerclusterer.js"></script>
    <script src="https://maps.googleapis.com/maps/api/js?key=AIzaSyDe8Gok8E-1JFGtCRm24aZBnbFstkP3fyA&callback=initMap"></script>
    <script type="text/javascript">google_map()</script>
</html>
