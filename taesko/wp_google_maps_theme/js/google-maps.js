function populateMap(map, coordinates) {
    for(k=0; k<100; k++) {
        new google.maps.Marker({position:markerCoordinates[k]}).setMap(map);
    }
}
function parseCoordinates(string) {
    markerCoordinates = [];
    data_markers = string.split(' ');
    for(k=0; k<data_markers.length-2; k+=2) {
        lat = parseFloat(data_markers[k]);
        lng = parseFloat(data_markers[k+1]);
        markerCoordinates.push(new google.maps.LatLng(lat, lng));
    }
    return markerCoordinates;
}

function initMap() {
    var mapCanvas = document.getElementById("map");
    var myCenter = new google.maps.LatLng(0, 0);
    markerCoordinates = parseCoordinates(
            mapCanvas.getAttribute('data-markers'));
    if(markerCoordinates) {
        myCenter = markerCoordinates[0];
    }
    mapOptions = {center: myCenter, zoom: 12};
    console.log("center", myCenter.lat(), myCenter.lng());
    console.log("marker count:", markerCoordinates.length);
    var map = new google.maps.Map(mapCanvas, mapOptions);
    markers = markerCoordinates.map(function(coord){
            return new google.maps.Marker({position:coord, label:"H"});
    });
    var markerCluster = new MarkerClusterer(map, markers,
                        {imagePath: "https://raw.githubusercontent.com/googlemaps/v3-utility-library/master/markerclustererplus/images/m"});
}

function google_map () {
}
