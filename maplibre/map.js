const map = new maplibregl.Map({
    container: 'map',
    projection: 'globe',
    style: 'https://api.maptiler.com/maps/dataviz-v4/style.json?key=0Vzl9yHwu0Xyx4TwT2Iw',
    center: [0, 20],
    zoom: 1.5
});

// Wetland colormap
const wetlandColormap = encodeURIComponent(JSON.stringify({
    0: [0, 0, 0, 0],        // No data - transparent
    1: [0, 112, 255],       // Freshwater lake - deep blue
    2: [0, 197, 255],       // Saline lake - cyan
    3: [0, 92, 230],        // Reservoir - dark blue
    4: [0, 38, 115],        // Large river - very dark blue
    5: [83, 115, 115],      // Large estuarine river - gray-blue
    6: [156, 156, 156],     // Other permanent waterbody - gray
    7: [115, 178, 255],     // Small streams - light blue
    8: [38, 115, 0],        // Lacustrine, forested - dark green
    9: [163, 255, 115],     // Lacustrine, non-forested - light green
    10: [0, 168, 132],      // Riverine, regularly flooded, forested - teal
    11: [163, 255, 184],    // Riverine, regularly flooded, non-forested - pale teal
    12: [76, 115, 0],       // Riverine, seasonally flooded, forested - olive
    13: [204, 242, 77],     // Riverine, seasonally flooded, non-forested - yellow-green
    14: [0, 100, 0],        // Riverine, seasonally saturated, forested - green
    15: [178, 178, 178],    // Riverine, seasonally saturated, non-forested - light gray
    16: [115, 76, 0],       // Palustrine, regularly flooded, forested - brown
    17: [230, 152, 0],      // Palustrine, regularly flooded, non-forested - orange
    18: [115, 115, 0],      // Palustrine, seasonally saturated, forested - dark yellow
    19: [255, 235, 175],    // Palustrine, seasonally saturated, non-forested - beige
    20: [168, 112, 0],      // Ephemeral, forested - dark orange
    21: [255, 170, 0],      // Ephemeral, non-forested - bright orange
    22: [158, 187, 215],    // Arctic/boreal peatland, forested - light blue-gray
    23: [218, 218, 235],    // Arctic/boreal peatland, non-forested - very pale blue
    24: [122, 142, 245],    // Temperate peatland, forested - periwinkle
    25: [175, 175, 255],    // Temperate peatland, non-forested - light purple
    26: [168, 0, 132],      // Tropical peatland, forested - magenta
    27: [255, 115, 223],    // Tropical peatland, non-forested - pink
    28: [197, 0, 255],      // Mangrove - purple
    29: [255, 255, 115],    // Saltmarsh - yellow
    30: [223, 115, 255],    // Delta - light purple
    31: [0, 255, 197],      // Other coastal wetland - aqua
    32: [255, 235, 190],    // Salt pan, saline/brackish wetland - pale tan
    33: [255, 190, 232]     // Rice paddies - light pink
}));

// Store dark style URL
const darkStyleUrl = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
const datavizStyleUrl = 'https://api.maptiler.com/maps/dataviz-v4/style.json?key=0Vzl9yHwu0Xyx4TwT2Iw';

// Wait for map to load before adding wetlands layer
map.on('load', function () {
    map.addSource('wetlands-cog', {
        'type': 'raster',
        'tiles': [
            `https://titiler.nrp-nautilus.io/cog/tiles/WebMercatorQuad/{z}/{x}/{y}@2x.png?url=https://minio.carlboettiger.info/public-wetlands/GLWD_v2_0/GLWD_v2_0_combined_classes/GLWD_v2_0_main_class.tif&colormap=${wetlandColormap}`
        ],
        'tileSize': 512
    });

    map.addLayer({
        'id': 'wetlands-layer',
        'type': 'raster',
        'source': 'wetlands-cog',
        'paint': {
            'raster-opacity': 0.7
        }
    });

    // Set up wetlands layer toggle after layer is added
    const wetlandsCheckbox = document.getElementById('wetlands-layer');
    if (wetlandsCheckbox) {
        wetlandsCheckbox.onclick = function (e) {
            e.preventDefault();
            e.stopPropagation();

            const visibility = map.getLayoutProperty('wetlands-layer', 'visibility');

            if (visibility === 'visible' || !visibility) {
                map.setLayoutProperty('wetlands-layer', 'visibility', 'none');
                this.checked = false;
            } else {
                this.checked = true;
                map.setLayoutProperty('wetlands-layer', 'visibility', 'visible');
            }
        };
    }
});

// Base layer switcher functionality
function switchBaseLayer(styleName) {
    const styleUrl = styleName === 'dark' ? darkStyleUrl : datavizStyleUrl;

    // Store current wetlands layer state
    const wetlandsVisible = map.getLayer('wetlands-layer') ?
        map.getLayoutProperty('wetlands-layer', 'visibility') !== 'none' : true;

    map.setStyle(styleUrl);

    // Re-add wetlands layer after style loads
    map.once('styledata', function () {
        map.addSource('wetlands-cog', {
            'type': 'raster',
            'tiles': [
                `https://titiler.nrp-nautilus.io/cog/tiles/WebMercatorQuad/{z}/{x}/{y}@2x.png?url=https://minio.carlboettiger.info/public-wetlands/GLWD_v2_0/GLWD_v2_0_combined_classes/GLWD_v2_0_main_class.tif&colormap=${wetlandColormap}`
            ],
            'tileSize': 512
        });

        map.addLayer({
            'id': 'wetlands-layer',
            'type': 'raster',
            'source': 'wetlands-cog',
            'paint': {
                'raster-opacity': 0.7
            }
        });

        if (!wetlandsVisible) {
            map.setLayoutProperty('wetlands-layer', 'visibility', 'none');
            document.getElementById('wetlands-layer').checked = false;
        }
    });
}

document.querySelectorAll('input[name="basemap"]').forEach(radio => {
    radio.addEventListener('change', function () {
        if (this.checked) {
            switchBaseLayer(this.value);
        }
    });
});

// Legend toggle functionality
const legendToggle = document.getElementById('legend-toggle');
const legendContent = document.getElementById('legend-content');

legendToggle.addEventListener('click', function () {
    legendContent.classList.toggle('collapsed');
    if (legendContent.classList.contains('collapsed')) {
        legendToggle.textContent = '+';
    } else {
        legendToggle.textContent = '−';
    }
});
