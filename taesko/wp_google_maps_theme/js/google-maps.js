function setupFiltering (markerClusterer) {
    // function filterCoord(coord, minLat, maxLat, minLng, maxLng) {
    //     return (minLat < coord.lat && coord.lat < maxLat &&
    //             minLng < coord.lng && coord.lng < maxLng);
    // }
    //
    // function filter_data(markerData, minLat, maxLat, minLng, maxLng) {
    //     for(k=0; k < markerData.data.length; k++) {
    //         coord = markerData.data[k];
    //         markerData.filtered[k] = filterCoord(coord, minLat, maxLat, minLng, maxLng);
    //     }
    // }
    //
    // function filter_markers(markerData, clusterer) {
    //     clusterer.clear();
    //     for(k=0; k < markerData.data.length; k++) {
    //         if(markerData.filtered[k]) {
    //             clusterer.addMarker(markerData.markers[k]);
    //         }
    //     }
    //     clusterer.redraw()
    // }
    //
    // function setupFiltering(markerData, clusterer) {
    //     form = filter_form();
    //     console.log(form.name.value, form.lat.value, form.lng.value);
    //     setInterval(function () {
    //         console.log(form.name.value, form.lat.value, form.lng.value);
    //         filter_data(markerData, 0, form.lat.value, 0, 100);
    //         filter_markers(markerData, clusterer);
    //     }, 1000);
    // }


}

function parseCoordinates(string) {
    let markerCoordinates = [];
    let data_markers = string.split(' ');
    for(let k=0; k<data_markers.length-3; k+=3) {
        let name = data_markers[k];
        let lat = parseFloat(data_markers[k+1]);
        let lng = parseFloat(data_markers[k+2]);
        markerCoordinates.push({
            'name': decodeURIComponent(name),
            'lat': lat,
            'lng': lng
        });
    }
    return markerCoordinates;
}

function prepareMarkers() {
    let coords = parseCoordinates(
        document.getElementById("map").getAttribute('data-markers'));
    let filtered = Array(coords.length).fill(true);
    let markers = coords.map(coord => new google.maps.Marker({
        position: new google.maps.LatLng(coord.lat, coord.lng),
        label: coord.name
    }));
    return {
        "data": coords, "filtered": filtered, "markers": markers
    };
}

function findCenter(markerData) {
    if (markerData === undefined || markerData.length === 0){
        return new google.maps.LatLng(0, 0);
    }
    else {
        return new google.maps.LatLng(markerData[0].lat, markerData[0].lng);
    }
}

function filter_form() {
    return document.getElementById('filter_form');
}


function urlParams() {
    const pairs = window.location.search.slice(1).split('&').map(
        function (param) {
            const pair = param.split('=');
            return {"name": decodeURIComponent(pair[0]), "value": decodeURIComponent(pair[1])};
        });
    return pairs.reduce((map, pair) => {map[pair.name] = pair.value; return map}, {});
}

function fillInputs() {
    const form = filter_form();
    const params = urlParams();
    for (const name in params) {
        if(params.hasOwnProperty(name) && form[name]) {
            form[name].value = params[name];
        }
    }
}

function initMap() {
    let mapCanvas = document.getElementById("map");
    const markerData = prepareMarkers();
    const mapElement = new google.maps.Map(mapCanvas,
        {center: findCenter(markerData.data), zoom: 12});
    const markerCluster = new MarkerClusterer(mapElement, markerData.markers,
        {
            imagePath: "https://raw.githubusercontent.com/googlemaps/v3-utility-library/master/markerclustererplus/images/m",
            maxZoom: 14
        });
}

function google_map () {
    fillInputs();
}
