package map.services.interfaces;

import map.entities.Marker;

import java.util.List;

public interface MarkerService {
    List<Marker> getAllMarkers();
    List<Marker> getMarkersByTypes(Boolean[] types);
    List<Marker> getMarkersByName(String name);
    List<Marker> getMarkersByCoordinates(double latFrom, double latTo, double lngFrom, double lngTo);

    void saveAll(List<Marker> markers);
    void save(Marker marker);
}
