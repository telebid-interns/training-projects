package map.services.interfaces;

import map.entities.Type;

import java.util.List;

public interface TypeService {
    void saveAll(List<Type> types);
    List<Type> getAllTypes();
    Type getTypeByName(String name);
    void save(Type type);
}
