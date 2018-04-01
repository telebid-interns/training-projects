package map.services.implementations;

import map.entities.Marker;
import map.repository.MarkerRepository;
import map.services.interfaces.MarkerService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
public class MarkerServiceImpl implements MarkerService {
    private final MarkerRepository markerRepository;

    @Autowired
    public MarkerServiceImpl(MarkerRepository markerRepository) {
        this.markerRepository = markerRepository;
    }

    @Override
    public List<Marker> getAllMarkers() {
        return markerRepository.findAll();
    }

    @Override
    public List<Marker> getMarkersByTypes(Boolean[] types) {
        List<Marker> allMarkers = markerRepository.findAll();
        List<Marker> resultList = new ArrayList<>();
        // TO DO
        return resultList;
    }

    @Override
    public List<Marker> getMarkersByName(String name) {
        List<Marker> markers = markerRepository.findAll();
        List<Marker> resultList = new ArrayList<>();
        for (Marker marker : markers) {
            if (marker.getName().toLowerCase().contains(name.toLowerCase())) {
                resultList.add(marker);
            }
        }
        return resultList;
    }

    @Override
    public List<Marker> getMarkersByCoordinates(double latFrom, double latTo, double lngFrom, double lngTo) {
        List<Marker> markers = markerRepository.findAll();
        List<Marker> resultList = new ArrayList<>();
        for (Marker marker : markers) {
            if (marker.getLat() > latFrom &&
                    marker.getLat() < latTo &&
                    marker.getLng() > lngFrom &&
                    marker.getLng() < lngTo) {
                resultList.add(marker);
            }
        }
        return resultList;
    }

    @Override
    public void saveAll(List<Marker> markers) {
        markerRepository.saveAll(markers);
    }

    @Override
    public void save(Marker marker) {
        markerRepository.save(marker);
    }
}
