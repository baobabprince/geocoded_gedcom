# Geocoded GEDCOM

This web application allows you to visualize the locations from a GEDCOM file on a map. It parses a GEDCOM file, extracts all `PLAC` tags, geocodes them using Nominatim and LocationIQ, and displays them as markers on an interactive map.

## Features

*   Load and parse `.ged` files.
*   Geocode place data using Nominatim with a fallback to LocationIQ.
*   Display geocoded locations on an interactive map with clustering.
*   Export the geocoded data as a GeoJSON file.
*   Export a `corrected.ged` file with the coordinate data embedded in the original GEDCOM structure.
*   Switch between different map tile layers (OpenStreetMap, CartoDB, Satellite).
*   Dark/Light theme support.

## How to Use

1.  Open the `index.html` file in your web browser.
2.  Click the "Choose File" button and select your GEDCOM (`.ged`) file.
3.  The application will automatically parse the file, geocode the locations, and display them on the map.
4.  You can then:
    *   Pan and zoom the map to explore the locations.
    *   Click on individual markers to see more details.
    *   Drag markers to correct their positions.
    *   Use the "Export GeoJSON" or "Export Corrected GEDCOM" buttons to download the data.
