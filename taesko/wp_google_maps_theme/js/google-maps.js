function populateMap(map, coordinates) {
    for(k=0; k<markerCoordinates.length; k++) {
        new google.maps.Marker({position:markerCoordinates[k]}).setMap(map);
    }
}
function parseCoordinates(string) {
    markerCoordinates = [];
    data_markers = string.split(',');
    for(k=0; k<data_markers.length; k++) {
        if(data_markers[k]) {
            marker = data_markers[k].split('-');
            lat = parseFloat(marker[0]);
            lng = parseFloat(marker[1]);
            markerCoordinates.push(new google.maps.LatLng(lat, lng));
            console.log(lat, lng);
        }
    }
    return markerCoordinates;
}

function initMap() {
    var mapCanvas = document.getElementById("map");
    var markerCoordinates = parseCoordinates(mapCanvas.getAttribute('data-markers'));
    var myCenter = markerCoordinates[0];
    console.log("center", myCenter.lat(), myCenter.lng());
    var mapOptions = {center: myCenter, zoom: 12};
    var map = new google.maps.Map(mapCanvas, mapOptions);
    populateMap(map, markerCoordinates);
}

function google_map () {
}
