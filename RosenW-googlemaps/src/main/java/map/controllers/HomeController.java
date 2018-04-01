package map.controllers;

import map.entities.Marker;
import map.entities.Type;
import map.models.Place;
import map.services.interfaces.MarkerService;
import map.services.interfaces.TypeService;
import map.utils.GoogleMapsUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.ResponseBody;

import java.util.*;

@Controller
public class HomeController {
    private final MarkerService markerService;
    private final TypeService typeService;

    @Autowired
    public HomeController(MarkerService markerService, TypeService typeService) {
        this.markerService = markerService;
        this.typeService = typeService;
    }

    private void findAndSaveLocationsToDB(int latFrom, int lngFrom, int latTo, int lngTo, int latIncrement, int lngIncrement) {
        GoogleMapsUtils googleMapsUtils = new GoogleMapsUtils();
        for (int lat = latFrom; lat < latTo; lat += latIncrement) {
            for (int lng = lngFrom; lng < lngTo; lng += lngIncrement) {
                List<Place> places = googleMapsUtils.search("", lat, lng, 30000);
                List<Marker> markers = new ArrayList<>();

                populateMarkersFromPlaceObjects(places, markers);
            }
        }
    }

    private void populateMarkersFromPlaceObjects(List<Place> places, List<Marker> markers) {
        for (Place place : places) {
            Marker marker = new Marker(place.getId(), place.getName(), place.getLat(), place.getLng());

            for (String curType : place.getTypes()) {
                List<Type> types = typeService.getAllTypes();
                boolean containsType = false;
                for (Type type : types) {
                    if (curType.equals(type.getName())) {
                        containsType = true;
                    }
                }
                if (!containsType) {
                    Type newType = new Type();
                    newType.setName(curType);
                    typeService.save(newType);
                    marker.getTypes().add(newType);
                } else {
                    marker.getTypes().add(typeService.getTypeByName(curType));
                }
            }
            markerService.save(marker);
        }
    }

    @GetMapping("/")
    public String getHomePage(Model model) {
        List<Type> types = typeService.getAllTypes();
        model.addAttribute("types", types);
        return "home";
    }

    @GetMapping("/markers/all")
    @ResponseBody
    public List<Marker> getAllMarkers() {
        return markerService.getAllMarkers();
    }

    @GetMapping("/types/all")
    @ResponseBody
    public List<Type> getAllTypes() {
        return typeService.getAllTypes();
    }

    @GetMapping("/relations/all")
    @ResponseBody
    public Map<String, List<Long>> getAllRelations() {
        List<Marker> markers = markerService.getAllMarkers();
        Map<String, List<Long>> map = new HashMap();
        for (Marker marker : markers) {
            for (Type type : marker.getTypes()) {
                if (map.containsKey(marker.getId())) {
                    map.get(marker.getId()).add(type.getId());
                } else {
                    List<Long> curTypeIdList = new ArrayList<>();
                    curTypeIdList.add(type.getId());
                    map.put(marker.getId(), curTypeIdList);
                }
            }
        }
        return map;
    }

    @GetMapping("/markers/{name}")
    @ResponseBody
    public List<Marker> getMarkersByName(@PathVariable String name) {
        return markerService.getMarkersByName(name);
    }

    @GetMapping("/markers/{types}")
    @ResponseBody
    public List<Marker> getMarkersByType(@PathVariable Boolean[] types) {
        return markerService.getMarkersByTypes(types);
    }

    @GetMapping("/markers/{latFrom}/{latTo}/{lngFrom}/{lngTo}")
    @ResponseBody
    public List<Marker> getMarkersByCoordinates(@PathVariable double latFrom, @PathVariable double latTo, @PathVariable double lngFrom, @PathVariable double lngTo) {
        return markerService.getMarkersByCoordinates(latFrom, latTo, lngFrom, lngTo);
    }
}