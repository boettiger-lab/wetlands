const map = new maplibregl.Map({
    container: 'map',
    // projection: 'globe',
    style: 'https://api.maptiler.com/maps/dataviz-v4/style.json?key=0Vzl9yHwu0Xyx4TwT2Iw',
    center: [0, 20],
    zoom: 1.5
});

// Add error handlers for debugging
map.on('error', function (e) {
    console.error('Map error:', e);
});

map.on('styleimagemissing', function (e) {
    console.warn('Style image missing:', e.id);
});

map.on('sourcedata', function (e) {
    if (e.sourceId === 'wetlands-cog' && e.isSourceLoaded) {
        console.log('Wetlands source loaded');
    }
});

// Store style URLs
const darkStyleUrl = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
const datavizStyleUrl = 'https://api.maptiler.com/maps/dataviz-v4/style.json?key=0Vzl9yHwu0Xyx4TwT2Iw';

// Load wetland colormap and initialize map
let wetlandColormap;
let wetlandColormapData;

const colormapPromise = fetch('wetland-colormap.json')
    .then(response => {
        console.log('Colormap fetch response:', response.status);
        return response.json();
    })
    .then(data => {
        console.log('Colormap data loaded:', Object.keys(data).length, 'classes');
        wetlandColormapData = data;
        // Extract just the color arrays for the tile service
        const colorArrays = {};
        for (const [key, value] of Object.entries(data)) {
            colorArrays[key] = value.color;
        }
        wetlandColormap = encodeURIComponent(JSON.stringify(colorArrays));
        console.log('Colormap encoded, length:', wetlandColormap.length);
        return wetlandColormap;
    })
    .catch(error => {
        console.error('Error loading colormap:', error);
        throw error;
    });

// Wait for both map and colormap to load before adding wetlands layer
map.on('load', function () {
    console.log('Map loaded, waiting for colormap...');
    colormapPromise.then(() => {
        console.log('Colormap ready, adding wetlands layer...');
        map.addSource('wetlands-cog', {
            'type': 'raster',
            'tiles': [
                `https://titiler.nrp-nautilus.io/cog/tiles/WebMercatorQuad/{z}/{x}/{y}.png?url=https://minio.carlboettiger.info/public-wetlands/GLWD_v2_0/GLWD_v2_0_combined_classes/GLWD_v2_0_main_class.tif&colormap=${wetlandColormap}`
            ],
            'tileSize': 256,
            'minzoom': 0,
            'maxzoom': 12,
            'attribution': '<a href="https://data.hydrosheds.org/file/hydrobasins/GLWD_TechDoc_v2_0.pdf" target="_blank">GLWD v2.0</a>'
        });

        map.addLayer({
            'id': 'wetlands-layer',
            'type': 'raster',
            'source': 'wetlands-cog',
            'paint': {
                'raster-opacity': 0.7
            }
        });

        console.log('Wetlands layer added successfully');

        // Add NCP biodiversity layer
        map.addSource('ncp-cog', {
            'type': 'raster',
            'tiles': [
                'https://titiler.nrp-nautilus.io/cog/tiles/WebMercatorQuad/{z}/{x}/{y}.png?url=https://minio.carlboettiger.info/public-ncp/NCP_biod_nathab_cog.tif&rescale=0,19&colormap_name=viridis'
            ],
            'tileSize': 256,
            'minzoom': 0,
            'maxzoom': 12,
            'attribution': '<a href="https://doi.org/10.1038/s41467-023-43832-9" target="_blank">Nature\'s Contributions to People</a>'
        });

        map.addLayer({
            'id': 'ncp-layer',
            'type': 'raster',
            'source': 'ncp-cog',
            'paint': {
                'raster-opacity': 0.7
            },
            'layout': {
                'visibility': 'none'
            }
        });

        console.log('NCP layer added successfully');

        // Set up wetlands layer toggle after layer is added
        const wetlandsCheckbox = document.getElementById('wetlands-layer');
        if (wetlandsCheckbox) {
            wetlandsCheckbox.addEventListener('change', function () {
                if (this.checked) {
                    map.setLayoutProperty('wetlands-layer', 'visibility', 'visible');
                } else {
                    map.setLayoutProperty('wetlands-layer', 'visibility', 'none');
                }
            });
        }

        // Set up NCP layer toggle
        const ncpCheckbox = document.getElementById('ncp-layer');
        if (ncpCheckbox) {
            ncpCheckbox.addEventListener('change', function () {
                if (this.checked) {
                    map.setLayoutProperty('ncp-layer', 'visibility', 'visible');
                } else {
                    map.setLayoutProperty('ncp-layer', 'visibility', 'none');
                }
            });
        }
    }).catch(error => {
        console.error('Error adding wetlands layer:', error);
    });
});

// Base layer switcher functionality
function switchBaseLayer(styleName) {
    const styleUrl = styleName === 'dark' ? darkStyleUrl : datavizStyleUrl;

    // Store current layer states
    const wetlandsVisible = map.getLayer('wetlands-layer') ?
        map.getLayoutProperty('wetlands-layer', 'visibility') !== 'none' : true;
    const ncpVisible = map.getLayer('ncp-layer') ?
        map.getLayoutProperty('ncp-layer', 'visibility') !== 'none' : false;

    map.setStyle(styleUrl);

    // Re-add layers after style loads
    map.once('styledata', function () {
        map.addSource('wetlands-cog', {
            'type': 'raster',
            'tiles': [
                `https://titiler.nrp-nautilus.io/cog/tiles/WebMercatorQuad/{z}/{x}/{y}.png?url=https://minio.carlboettiger.info/public-wetlands/GLWD_v2_0/GLWD_v2_0_combined_classes/GLWD_v2_0_main_class.tif&colormap=${wetlandColormap}`
            ],
            'tileSize': 256,
            'minzoom': 0,
            'maxzoom': 12,
            'attribution': '<a href="https://data.hydrosheds.org/file/hydrobasins/GLWD_TechDoc_v2_0.pdf" target="_blank">GLWD v2.0</a>'
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

        // Re-add NCP layer
        map.addSource('ncp-cog', {
            'type': 'raster',
            'tiles': [
                'https://titiler.nrp-nautilus.io/cog/tiles/WebMercatorQuad/{z}/{x}/{y}.png?url=https://minio.carlboettiger.info/public-ncp/NCP_biod_nathab_cog.tif&rescale=0,19&colormap_name=viridis'
            ],
            'tileSize': 256,
            'minzoom': 0,
            'maxzoom': 12,
            'attribution': '<a href="https://doi.org/10.1038/s41467-023-43832-9" target="_blank">Nature\'s Contributions to People</a>'
        });

        map.addLayer({
            'id': 'ncp-layer',
            'type': 'raster',
            'source': 'ncp-cog',
            'paint': {
                'raster-opacity': 0.7
            }
        });

        if (!ncpVisible) {
            map.setLayoutProperty('ncp-layer', 'visibility', 'none');
            document.getElementById('ncp-layer').checked = false;
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
