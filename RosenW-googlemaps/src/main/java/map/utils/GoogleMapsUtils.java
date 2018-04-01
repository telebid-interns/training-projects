package map.utils;

import map.models.Place;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.MalformedURLException;
import java.net.URL;
import java.net.URLEncoder;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

public class GoogleMapsUtils {

    private static final String PLACES_API_BASE = "https://maps.googleapis.com/maps/api/place";

    private static final String TYPE_SEARCH = "/search";

    private static final String OUT_JSON = "/json";

    // KEY!
    private static final String API_KEY = "AIzaSyBr_3eYE9-wszu7jfiHhgbVp0i7cdsyLsI";


    public static ArrayList<Place> search(String keyword, double lat, double lng, int radius) {
        ArrayList<Place> resultList = null;

        HttpURLConnection conn = null;
        StringBuilder jsonResults = new StringBuilder();
        try {
            StringBuilder sb = new StringBuilder(PLACES_API_BASE);
            sb.append(TYPE_SEARCH);
            sb.append(OUT_JSON);
            sb.append("?sensor=false");
            sb.append("&key=" + API_KEY);
            sb.append("&keyword=" + URLEncoder.encode(keyword, "utf8"));
            sb.append("&location=" + String.valueOf(lat) + "," + String.valueOf(lng));
            sb.append("&radius=" + String.valueOf(radius));

            URL url = new URL(sb.toString());
            conn = (HttpURLConnection) url.openConnection();
            InputStreamReader in = new InputStreamReader(conn.getInputStream());

            int read;
            char[] buff = new char[1024];
            while ((read = in.read(buff)) != -1) {
                jsonResults.append(buff, 0, read);
            }
        } catch (MalformedURLException e) {
            System.out.println(e.getMessage());
        } catch (IOException e) {
            System.out.println(e.getMessage());
        } finally {
            if (conn != null) {
                conn.disconnect();
            }
        }

        try {
            // Create a JSON object hierarchy from the results
            JSONObject jsonObj = new JSONObject(jsonResults.toString());
            JSONArray predsJsonArray = jsonObj.getJSONArray("results");

            // Extract the Place descriptions from the results
            resultList = new ArrayList<>(predsJsonArray.length());
            for (int i = 0; i < predsJsonArray.length(); i++) {
                Place place = new Place();
                place.setLat(predsJsonArray.getJSONObject(i).getJSONObject("geometry").getJSONObject("location").getString("lat"));
                place.setLng(predsJsonArray.getJSONObject(i).getJSONObject("geometry").getJSONObject("location").getString("lng"));
                place.setName(predsJsonArray.getJSONObject(i).getString("name"));

                ///////////////////////////////////
                JSONArray types = predsJsonArray.getJSONObject(i).getJSONArray("types");
                ArrayList<String> typeList = new ArrayList<>();
                if (types != null) {
                    int len = types.length();
                    for (int j=0;j<len;j++){
                        typeList.add(types.get(j).toString());
                    }
                }
                place.setTypes(typeList);
                //////////////////////////////////

                place.setId(predsJsonArray.getJSONObject(i).getString("id"));
                resultList.add(place);
            }
        } catch (JSONException e) {
            System.out.println(e.getMessage());
        }

        return resultList;
    }

}