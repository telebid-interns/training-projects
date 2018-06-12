Directory structure is copied from the twentyseventeen theme.
A single post template "single-post-sofia-center.php" querries the database and
injects into the map canvas as data-markers attribute the coordinates for
markers. The js/google-map.js script renders the map and the markers.

"single-post-sofia-center.php" can also import markers into the database from
the bg_locations.txt file when a hard coded $import_markers flag is raised.
