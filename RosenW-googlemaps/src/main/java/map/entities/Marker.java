package map.entities;

import com.fasterxml.jackson.annotation.JsonIgnore;

import javax.persistence.*;
import java.util.HashSet;
import java.util.Set;

@Table(name = "markers")
@Entity
public class Marker {
    @Id
    private String id;
    private double lat;
    private double lng;
    private String name;

    @ManyToMany(cascade = CascadeType.ALL)
    @JoinTable(name = "places_types", joinColumns = @JoinColumn(name = "marker_id", referencedColumnName = "id"), inverseJoinColumns = @JoinColumn(name = "type_id", referencedColumnName = "id"))
    @JsonIgnore
    private Set<Type> types;

    public Marker() {
        this.setTypes(new HashSet<>());
    }

    public Marker(String id, String name, String lat, String lng) {
        this.setTypes(new HashSet<>());
        this.setId(id);
        this.setLat(Double.parseDouble(lat));
        this.setLng(Double.parseDouble(lng));
        this.setName(name);
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public double getLat() {
        return lat;
    }

    private void setLat(double lat) {
        this.lat = lat;
    }

    public double getLng() {
        return lng;
    }

    private void setLng(double lng) {
        this.lng = lng;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public Set<Type> getTypes() {
        return types;
    }

    public void setTypes(Set<Type> types) {
        this.types = types;
    }
}