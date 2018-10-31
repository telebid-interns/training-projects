function initMaps () {
  gmaps = [...document.getElementsByClassName("gmap")];
  gmaps.map((gmap) => {
    // TODO asserts
    const markers = [];

    const center = { lat: 0, lng: 0 };

    if (gmap.dataset.zoom == null) {
      let zoom = 1;
    }

    centerTokens = gmap.dataset.center.split(', ');
    center.lat = Number(centerTokens[0].substr(1));
    center.lng = Number(centerTokens[1].substr(0, centerTokens[1].length - 1));

    const currentMap = new google.maps.Map(gmap, {
      zoom: Number(gmap.dataset.zoom), 
      center
    });

    if (gmap.dataset.markers == null) {
      return;
    }

    for (const pair of gmap.dataset.markers.split(';')) {
      const pairTokens = pair.split(', ');
      const position = {
        lat: Number(pairTokens[0].substr(1)),
        lng: Number(pairTokens[1].substr(0, pairTokens[1].length - 1))
      }

      new google.maps.Marker({
        position,
        map: currentMap
      });
    }
  });
}
