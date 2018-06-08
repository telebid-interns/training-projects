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

<style>
    #map {
    height: 500px;
    width: 100%;
} 
</style>
<div class="wrap">
    <div id="primary" class="content-area">
        <main id="main" class="site-main" role="main">
            <p> Hello World ! </p>
            <div id="map"
<?php
global $wpdb;
$results = $wpdb->get_results("SELECT * from wp_map_markers", ARRAY_A);
echo "data-markers=\"";
foreach($results as $result) {
    echo "{$result["latitude"]}-{$result["longtitude"]},";
}
echo "\"";
?>
></div>
        </main><!-- #main -->
    </div><!-- #primary -->
    <?php get_sidebar(); ?>
</div><!-- .wrap -->
<script src="https://maps.googleapis.com/maps/api/js?key=AIzaSyDe8Gok8E-1JFGtCRm24aZBnbFstkP3fyA&callback=initMap"></script>
<script type="text/javascript">google_map()</script>
<?php get_footer();
