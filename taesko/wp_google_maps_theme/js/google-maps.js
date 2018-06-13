function populateMap(map, coordinates) {
    for(k=0; k<100; k++) {
        new google.maps.Marker({position:markerCoordinates[k]}).setMap(map);
    }
}

function parseCoordinates(string) {
    var markerCoordinates = [];
    var data_markers = string.split(' ');
    for(k=0; k<data_markers.length-2; k+=2) {
        lat = parseFloat(data_markers[k]);
        lng = parseFloat(data_markers[k+1]);
        markerCoordinates.push(new google.maps.LatLng(lat, lng));
    }
    return markerCoordinates;
}

function filterCoord(coord, minLat, maxLat, minLng, maxLng) {
    return (minLat < coord.lat() && coord.lat() < maxLat && 
            minLng < coord.lng() && coord.lng() < maxLng);
}

function filterCoordinates(coordinates, minLat, maxLat, minLng, maxLng) {
    var filtered = [];
    for(k=0; k < coordinates.length; k++) {
        filtered.push(filterCoord(coordinates[k], minLat, maxLat, minLng, maxLng));
    }
}

function prepareMarkers() {
    coords = parseCoordinates(
            document.getElementById("map").getAttribute('data-markers'));
    filtered = Array(coords.length).fill(true);
    markers = coords.map(coord => new google.maps.Marker({
        position:coord, label:"H"
    }));
    return {
        "data": coords, "filtered": filtered, "markers": markers
    };
}

function findCenter(markerData) {
    return markerData[0];
}

function filter_data(markerData, minLat, maxLat, minLng, maxLng) {
    for(k=0; k < markerData.data.length; k++) {
        coord = markerData.data[k];
        markerData.filtered[k] = filterCoord(coord, 0, form.lat.value, 0, 100);
    }
}

function filter_markers(markerData, clusterer) {
    clusterer.clear()
    for(k=0; k < markerData.data.length; k++) {
        if(markerData.filtered[k]) {
            clusterer.addMarker(markerData.markers[k]);
        }
    }
    clusterer.redraw()
}

function setupFiltering(markerData, clusterer) {
    form = filter_form();
    console.log(form.name.value, form.lat.value, form.lng.value);
    setInterval(function () {
        console.log(form.name.value, form.lat.value, form.lng.value);
        filter_data(markerData, 0, form.lat.value, 0, 100);
        filter_markers(markerData, clusterer);
    }, 1000);
}

function filter_form() {
    return document.getElementById('filter_form');
}


function urlParams() {
    var pairs = window.location.search.slice(1).split('&').map(
                function(param) {
                    var pair = param.split('=');
                    return {"name": decodeURIComponent(pair[0]), "value": decodeURIComponent(pair[1])};
            });
    return pairs.reduce((map, pair) => {map[pair.name] = pair.value; return map}, {});
}

function fillInputs() {
    var form = filter_form();
    var params = urlParams()
    for (var name in params) {
        if(form[name]) {
            form[name].value = params[name];
        }
    }
}

function initMap() {
    var mapCanvas = document.getElementById("map");
    var markerData = prepareMarkers();
    MAP_ELEMENT = new google.maps.Map(document.getElementById("map"), 
            {center: findCenter(markerData.data), zoom: 12});
    var markerCluster = new MarkerClusterer(MAP_ELEMENT, markerData.markers,
                        {imagePath: "https://raw.githubusercontent.com/googlemaps/v3-utility-library/master/markerclustererplus/images/m",
                         maxZoom:14});
}

function submitFilter() {
    url = window.location.href + '&zoom=' + MAP_ELEMENT.getZoom();
    console.log("submit url is ", url);
    window.location = url;
    return true;
}

function google_map () {
    fillInputs();
}
