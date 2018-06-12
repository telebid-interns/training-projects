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

get_header(); ?>

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
<style>
    #map {
    height: 500px;
    width: 100%;
} 
</style>
<div class="wrap">
    <div id="primary" class="content-area">
        <main id="main" class="site-main" role="main">
            <div id="map" <?php echo_dm_cls() ?> ></div>
        </main><!-- #main -->
    </div><!-- #primary -->
    <?php get_sidebar(); ?>
</div><!-- .wrap -->
<script type="text/javascript" src="https://developers.google.com/maps/documentation/javascript/examples/markerclusterer/markerclusterer.js"></script>
<script src="https://maps.googleapis.com/maps/api/js?key=AIzaSyDe8Gok8E-1JFGtCRm24aZBnbFstkP3fyA&callback=initMap"></script>
<script type="text/javascript">google_map()</script>
<?php get_footer();
