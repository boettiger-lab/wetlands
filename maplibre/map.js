// Register PMTiles protocol
let protocol = new pmtiles.Protocol();
maplibregl.addProtocol('pmtiles', protocol.tile);

// MapController: API for chatbot to control the map
window.MapController = {
    // Available layers with their display names and associated map layer IDs
    layers: {
        'wetlands': {
            displayName: 'Global Wetlands (GLWD)',
            layerIds: ['wetlands-layer'],
            checkboxId: 'wetlands-layer',
            hasLegend: true
        },
        'ncp': {
            displayName: "Nature's Contributions to People",
            layerIds: ['ncp-layer'],
            checkboxId: 'ncp-layer',
            hasLegend: false
        },
        'carbon': {
            displayName: 'Vulnerable Carbon',
            layerIds: ['carbon-layer'],
            checkboxId: 'carbon-layer',
            hasLegend: false
        },
        'ramsar': {
            displayName: 'Ramsar Wetland Sites',
            layerIds: ['ramsar-layer', 'ramsar-outline'],
            checkboxId: 'ramsar-layer',
            hasLegend: false
        },
        'wdpa': {
            displayName: 'Protected Areas (WDPA)',
            layerIds: ['wdpa-layer', 'wdpa-outline'],
            checkboxId: 'wdpa-layer',
            hasLegend: false
        },
        'hydrobasins': {
            displayName: 'Watersheds (HydroBASINS L6)',
            layerIds: ['hydrobasins-fill', 'hydrobasins-layer'],
            checkboxId: 'hydrobasins-layer',
            hasLegend: false
        }
    },

    // Get list of available layers and their current visibility
    getAvailableLayers: function () {
        const result = {};
        for (const [key, config] of Object.entries(this.layers)) {
            const checkbox = document.getElementById(config.checkboxId);
            result[key] = {
                displayName: config.displayName,
                visible: checkbox ? checkbox.checked : false
            };
        }
        return result;
    },

    // Set layer visibility
    setLayerVisibility: function (layerKey, visible) {
        const config = this.layers[layerKey];
        if (!config) {
            return { success: false, error: `Unknown layer: ${layerKey}. Available layers: ${Object.keys(this.layers).join(', ')}` };
        }

        // Check if map and layers are ready
        if (!window.map || !window.map.getLayer) {
            return { success: false, error: 'Map not yet initialized' };
        }

        try {
            const visibility = visible ? 'visible' : 'none';

            // Set visibility on all associated layer IDs
            for (const layerId of config.layerIds) {
                if (window.map.getLayer(layerId)) {
                    window.map.setLayoutProperty(layerId, 'visibility', visibility);
                }
            }

            // Update the checkbox to match
            const checkbox = document.getElementById(config.checkboxId);
            if (checkbox) {
                checkbox.checked = visible;
            }

            // Handle legend visibility for wetlands layer
            if (config.hasLegend) {
                const legend = document.getElementById('legend');
                if (legend) {
                    legend.style.display = visible ? 'block' : 'none';
                }
            }

            console.log(`[MapController] Layer '${layerKey}' visibility set to ${visible}`);
            return {
                success: true,
                layer: layerKey,
                displayName: config.displayName,
                visible: visible
            };
        } catch (error) {
            console.error('[MapController] Error setting layer visibility:', error);
            return { success: false, error: error.message };
        }
    },

    // Toggle layer visibility
    toggleLayer: function (layerKey) {
        const config = this.layers[layerKey];
        if (!config) {
            return { success: false, error: `Unknown layer: ${layerKey}` };
        }

        const checkbox = document.getElementById(config.checkboxId);
        const currentlyVisible = checkbox ? checkbox.checked : false;
        return this.setLayerVisibility(layerKey, !currentlyVisible);
    },

    // Show only specified layers (hide all others)
    showOnlyLayers: function (layerKeys) {
        const results = [];
        for (const key of Object.keys(this.layers)) {
            const shouldShow = layerKeys.includes(key);
            results.push(this.setLayerVisibility(key, shouldShow));
        }
        return results;
    },

    // Hide all overlay layers
    hideAllLayers: function () {
        const results = [];
        for (const key of Object.keys(this.layers)) {
            results.push(this.setLayerVisibility(key, false));
        }
        return results;
    },

    // Show all overlay layers  
    showAllLayers: function () {
        const results = [];
        for (const key of Object.keys(this.layers)) {
            results.push(this.setLayerVisibility(key, true));
        }
        return results;
    }
};

const map = new maplibregl.Map({
    container: 'map',
    // projection: 'globe',
    style: 'https://api.maptiler.com/maps/dataviz-v4/style.json?key=0Vzl9yHwu0Xyx4TwT2Iw',
    center: [0, 20],
    zoom: 1.5
});

// Expose map globally for MapController access
window.map = map;

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

        // Add vulnerable carbon layer
        map.addSource('carbon-cog', {
            'type': 'raster',
            'tiles': [
                'https://titiler.nrp-nautilus.io/cog/tiles/WebMercatorQuad/{z}/{x}/{y}.png?url=https://minio.carlboettiger.info/public-carbon/cogs/vulnerable_c_total_2018.tif&colormap_name=reds'
            ],
            'tileSize': 256,
            'minzoom': 0,
            'maxzoom': 12,
            'attribution': '<a href="https://www.conservation.org/irrecoverable-carbon" target="_blank">Irrecoverable Carbon (CI 2018)</a>'
        });

        map.addLayer({
            'id': 'carbon-layer',
            'type': 'raster',
            'source': 'carbon-cog',
            'paint': {
                'raster-opacity': 0.7
            },
            'layout': {
                'visibility': 'none'
            }
        });

        console.log('Carbon layer added successfully');

        // Add Ramsar sites PMTiles layer
        map.addSource('ramsar-source', {
            'type': 'vector',
            'url': 'pmtiles://https://minio.carlboettiger.info/public-wetlands/ramsar/ramsar_wetlands.pmtiles',
            'attribution': '<a href="https://rsis.ramsar.org/" target="_blank">Ramsar Sites Information Service</a>'
        });

        map.addLayer({
            'id': 'ramsar-layer',
            'type': 'fill',
            'source': 'ramsar-source',
            'source-layer': 'ramsar',
            'minzoom': 0,
            'maxzoom': 22,
            'paint': {
                'fill-color': '#FF1493',
                'fill-opacity': 0.6
            },
            'layout': {
                'visibility': 'none'
            }
        });

        map.addLayer({
            'id': 'ramsar-outline',
            'type': 'line',
            'source': 'ramsar-source',
            'source-layer': 'ramsar',
            'minzoom': 0,
            'maxzoom': 22,
            'paint': {
                'line-color': '#8B008B',
                'line-width': 2
            },
            'layout': {
                'visibility': 'none'
            }
        });

        // Add click popup for Ramsar sites
        map.on('click', 'ramsar-layer', (e) => {
            const coordinates = e.lngLat;
            const properties = e.features[0].properties;

            new maplibregl.Popup()
                .setLngLat(coordinates)
                .setHTML(`
                    <strong>${properties.officialna || 'Ramsar Site'}</strong><br>
                    ${properties.country_en ? 'Country: ' + properties.country_en + '<br>' : ''}
                    ${properties.area_off ? 'Area: ' + properties.area_off + ' ha<br>' : ''}
                `)
                .addTo(map);
        });

        // Change cursor on hover
        map.on('mouseenter', 'ramsar-layer', () => {
            map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', 'ramsar-layer', () => {
            map.getCanvas().style.cursor = '';
        });

        console.log('Ramsar layer added successfully');

        // Add WDPA protected areas PMTiles layer
        map.addSource('wdpa-source', {
            'type': 'vector',
            'url': 'pmtiles://https://s3-west.nrp-nautilus.io/public-wdpa/WDPA_Dec2025.pmtiles',
            'attribution': '<a href="https://www.protectedplanet.net/" target="_blank">World Database on Protected Areas</a>'
        });

        map.addLayer({
            'id': 'wdpa-layer',
            'type': 'fill',
            'source': 'wdpa-source',
            'source-layer': 'wdpa',
            'minzoom': 0,
            'maxzoom': 22,
            'paint': {
                'fill-color': '#2E7D32',
                'fill-opacity': 0.4
            },
            'layout': {
                'visibility': 'none'
            }
        });

        map.addLayer({
            'id': 'wdpa-outline',
            'type': 'line',
            'source': 'wdpa-source',
            'source-layer': 'wdpa',
            'minzoom': 0,
            'maxzoom': 22,
            'paint': {
                'line-color': '#1B5E20',
                'line-width': 1.5
            },
            'layout': {
                'visibility': 'none'
            }
        });

        // Add click popup for WDPA sites
        map.on('click', 'wdpa-layer', (e) => {
            const coordinates = e.lngLat;
            const properties = e.features[0].properties;

            new maplibregl.Popup()
                .setLngLat(coordinates)
                .setHTML(`
                    <strong>${properties.NAME_ENG || properties.NAME || 'Protected Area'}</strong><br>
                    ${properties.DESIG_ENG ? 'Type: ' + properties.DESIG_ENG + '<br>' : ''}
                    ${properties.IUCN_CAT ? 'IUCN Category: ' + properties.IUCN_CAT + '<br>' : ''}
                    ${properties.GIS_AREA ? 'Area: ' + properties.GIS_AREA + ' km²<br>' : ''}
                    ${properties.STATUS_YR ? 'Year: ' + properties.STATUS_YR + '<br>' : ''}
                `)
                .addTo(map);
        });

        // Change cursor on hover
        map.on('mouseenter', 'wdpa-layer', () => {
            map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', 'wdpa-layer', () => {
            map.getCanvas().style.cursor = '';
        });

        console.log('WDPA layer added successfully');

        // Add HydroBASINS level 6 PMTiles layer
        map.addSource('hydrobasins-source', {
            'type': 'vector',
            'url': 'pmtiles://https://s3-west.nrp-nautilus.io/public-hydrobasins/level_06/hydrobasins_level_06.pmtiles',
            'attribution': '<a href="https://www.hydrosheds.org/products/hydrobasins" target="_blank">HydroBASINS</a>'
        });

        map.addLayer({
            'id': 'hydrobasins-fill',
            'type': 'fill',
            'source': 'hydrobasins-source',
            'source-layer': 'hydrobasins_level_06',
            'minzoom': 0,
            'maxzoom': 22,
            'paint': {
                'fill-color': '#1E88E5',
                'fill-opacity': 0.05
            },
            'layout': {
                'visibility': 'none'
            }
        });

        map.addLayer({
            'id': 'hydrobasins-layer',
            'type': 'line',
            'source': 'hydrobasins-source',
            'source-layer': 'hydrobasins_level_06',
            'minzoom': 0,
            'maxzoom': 22,
            'paint': {
                'line-color': '#1E88E5',
                'line-width': 1.5,
                'line-opacity': 0.8
            },
            'layout': {
                'visibility': 'none'
            }
        });

        // Add click popup for HydroBASINS
        map.on('click', 'hydrobasins-fill', (e) => {
            const coordinates = e.lngLat;
            const properties = e.features[0].properties;

            new maplibregl.Popup()
                .setLngLat(coordinates)
                .setHTML(`
                    <strong>Watershed Basin</strong><br>
                    ${properties.PFAF_ID ? 'Pfafstetter ID: ' + properties.PFAF_ID + '<br>' : ''}
                    ${properties.UP_AREA ? 'Upstream Area: ' + properties.UP_AREA + ' km²<br>' : ''}
                    ${properties.SUB_AREA ? 'Sub-basin Area: ' + properties.SUB_AREA + ' km²<br>' : ''}
                `)
                .addTo(map);
        });

        // Change cursor on hover
        map.on('mouseenter', 'hydrobasins-fill', () => {
            map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', 'hydrobasins-fill', () => {
            map.getCanvas().style.cursor = '';
        });

        console.log('HydroBASINS layer added successfully');

        // Set up wetlands layer toggle after layer is added
        const wetlandsCheckbox = document.getElementById('wetlands-layer');
        const legend = document.getElementById('legend');
        if (wetlandsCheckbox) {
            wetlandsCheckbox.addEventListener('change', function () {
                if (this.checked) {
                    map.setLayoutProperty('wetlands-layer', 'visibility', 'visible');
                    legend.style.display = 'block';
                } else {
                    map.setLayoutProperty('wetlands-layer', 'visibility', 'none');
                    legend.style.display = 'none';
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

        // Set up carbon layer toggle
        const carbonCheckbox = document.getElementById('carbon-layer');
        if (carbonCheckbox) {
            carbonCheckbox.addEventListener('change', function () {
                if (this.checked) {
                    map.setLayoutProperty('carbon-layer', 'visibility', 'visible');
                } else {
                    map.setLayoutProperty('carbon-layer', 'visibility', 'none');
                }
            });
        }

        // Set up Ramsar layer toggle
        const ramsarCheckbox = document.getElementById('ramsar-layer');
        if (ramsarCheckbox) {
            ramsarCheckbox.addEventListener('change', function () {
                const visibility = this.checked ? 'visible' : 'none';
                map.setLayoutProperty('ramsar-layer', 'visibility', visibility);
                map.setLayoutProperty('ramsar-outline', 'visibility', visibility);
            });
        }

        // Set up WDPA layer toggle
        const wdpaCheckbox = document.getElementById('wdpa-layer');
        if (wdpaCheckbox) {
            wdpaCheckbox.addEventListener('change', function () {
                const visibility = this.checked ? 'visible' : 'none';
                map.setLayoutProperty('wdpa-layer', 'visibility', visibility);
                map.setLayoutProperty('wdpa-outline', 'visibility', visibility);
            });
        }

        // Set up HydroBASINS layer toggle
        const hydrobasinsCheckbox = document.getElementById('hydrobasins-layer');
        if (hydrobasinsCheckbox) {
            hydrobasinsCheckbox.addEventListener('change', function () {
                const visibility = this.checked ? 'visible' : 'none';
                map.setLayoutProperty('hydrobasins-fill', 'visibility', visibility);
                map.setLayoutProperty('hydrobasins-layer', 'visibility', visibility);
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
    const carbonVisible = map.getLayer('carbon-layer') ?
        map.getLayoutProperty('carbon-layer', 'visibility') !== 'none' : false;
    const ramsarVisible = map.getLayer('ramsar-layer') ?
        map.getLayoutProperty('ramsar-layer', 'visibility') !== 'none' : false;
    const ramsarOutlineVisible = ramsarVisible;
    const wdpaVisible = map.getLayer('wdpa-layer') ?
        map.getLayoutProperty('wdpa-layer', 'visibility') !== 'none' : false;
    const wdpaOutlineVisible = wdpaVisible;
    const hydrobasinsVisible = map.getLayer('hydrobasins-layer') ?
        map.getLayoutProperty('hydrobasins-layer', 'visibility') !== 'none' : false;
    const hydrobasinsFillVisible = hydrobasinsVisible;

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

        // Re-add carbon layer
        map.addSource('carbon-cog', {
            'type': 'raster',
            'tiles': [
                'https://titiler.nrp-nautilus.io/cog/tiles/WebMercatorQuad/{z}/{x}/{y}.png?url=https://minio.carlboettiger.info/public-carbon/cogs/vulnerable_c_total_2018.tif&colormap_name=reds'
            ],
            'tileSize': 256,
            'minzoom': 0,
            'maxzoom': 12,
            'attribution': '<a href="https://www.conservation.org/irrecoverable-carbon" target="_blank">Irrecoverable Carbon (CI 2018)</a>'
        });

        map.addLayer({
            'id': 'carbon-layer',
            'type': 'raster',
            'source': 'carbon-cog',
            'paint': {
                'raster-opacity': 0.7
            }
        });

        if (!carbonVisible) {
            map.setLayoutProperty('carbon-layer', 'visibility', 'none');
            document.getElementById('carbon-layer').checked = false;
        }

        // Re-add Ramsar layer
        map.addSource('ramsar-source', {
            'type': 'vector',
            'url': 'pmtiles://https://minio.carlboettiger.info/public-wetlands/ramsar/ramsar_wetlands.pmtiles',
            'attribution': '<a href="https://rsis.ramsar.org/" target="_blank">Ramsar Sites Information Service</a>'
        });

        map.addLayer({
            'id': 'ramsar-layer',
            'type': 'fill',
            'source': 'ramsar-source',
            'source-layer': 'ramsar',
            'minzoom': 0,
            'maxzoom': 22,
            'paint': {
                'fill-color': '#FF1493',
                'fill-opacity': 0.6
            }
        });

        map.addLayer({
            'id': 'ramsar-outline',
            'type': 'line',
            'source': 'ramsar-source',
            'source-layer': 'ramsar',
            'minzoom': 0,
            'maxzoom': 22,
            'paint': {
                'line-color': '#8B008B',
                'line-width': 2
            }
        });

        if (!ramsarVisible) {
            map.setLayoutProperty('ramsar-layer', 'visibility', 'none');
            map.setLayoutProperty('ramsar-outline', 'visibility', 'none');
            document.getElementById('ramsar-layer').checked = false;
        }

        // Re-add WDPA layer
        map.addSource('wdpa-source', {
            'type': 'vector',
            'url': 'pmtiles://https://s3-west.nrp-nautilus.io/public-wdpa/WDPA_Dec2025.pmtiles',
            'attribution': '<a href="https://www.protectedplanet.net/" target="_blank">World Database on Protected Areas</a>'
        });

        map.addLayer({
            'id': 'wdpa-layer',
            'type': 'fill',
            'source': 'wdpa-source',
            'source-layer': 'wdpa',
            'minzoom': 0,
            'maxzoom': 22,
            'paint': {
                'fill-color': '#2E7D32',
                'fill-opacity': 0.4
            }
        });

        map.addLayer({
            'id': 'wdpa-outline',
            'type': 'line',
            'source': 'wdpa-source',
            'source-layer': 'wdpa',
            'minzoom': 0,
            'maxzoom': 22,
            'paint': {
                'line-color': '#1B5E20',
                'line-width': 1.5
            }
        });

        if (!wdpaVisible) {
            map.setLayoutProperty('wdpa-layer', 'visibility', 'none');
            map.setLayoutProperty('wdpa-outline', 'visibility', 'none');
            document.getElementById('wdpa-layer').checked = false;
        }

        // Re-add HydroBASINS layer
        map.addSource('hydrobasins-source', {
            'type': 'vector',
            'url': 'pmtiles://https://s3-west.nrp-nautilus.io/public-hydrobasins/level_06/hydrobasins_level_06.pmtiles',
            'attribution': '<a href="https://www.hydrosheds.org/products/hydrobasins" target="_blank">HydroBASINS</a>'
        });

        map.addLayer({
            'id': 'hydrobasins-fill',
            'type': 'fill',
            'source': 'hydrobasins-source',
            'source-layer': 'hydrobasins_level_06',
            'minzoom': 0,
            'maxzoom': 22,
            'paint': {
                'fill-color': '#1E88E5',
                'fill-opacity': 0.05
            }
        });

        map.addLayer({
            'id': 'hydrobasins-layer',
            'type': 'line',
            'source': 'hydrobasins-source',
            'source-layer': 'hydrobasins_level_06',
            'minzoom': 0,
            'maxzoom': 22,
            'paint': {
                'line-color': '#1E88E5',
                'line-width': 1.5,
                'line-opacity': 0.8
            }
        });

        if (!hydrobasinsVisible) {
            map.setLayoutProperty('hydrobasins-fill', 'visibility', 'none');
            map.setLayoutProperty('hydrobasins-layer', 'visibility', 'none');
            document.getElementById('hydrobasins-layer').checked = false;
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
