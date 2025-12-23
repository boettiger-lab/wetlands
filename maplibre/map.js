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
            hasLegend: true,
            isVector: false
        },
        'ncp': {
            displayName: "Nature's Contributions to People",
            layerIds: ['ncp-layer'],
            checkboxId: 'ncp-layer',
            hasLegend: false,
            isVector: false
        },
        'carbon': {
            displayName: 'Vulnerable Carbon',
            layerIds: ['carbon-layer'],
            checkboxId: 'carbon-layer',
            hasLegend: false,
            isVector: false
        },
        'ramsar': {
            displayName: 'Ramsar Wetland Sites',
            layerIds: ['ramsar-layer'],
            checkboxId: 'ramsar-layer',
            hasLegend: false,
            isVector: true,
            sourceLayer: 'ramsar',
            // Properties available for filtering (from PMTiles)
            filterableProperties: {
                'ramsarid': { type: 'number', description: 'Unique Ramsar site ID' },
                'Site name': { type: 'string', description: 'Official site name' },
                'Region': { type: 'string', description: 'Geographic region' },
                'Country': { type: 'string', description: 'Country name' },
                'Territory': { type: 'string', description: 'Territory name' },
                'iso3': { type: 'string', description: 'ISO 3-letter country code' },
                'country_en': { type: 'string', description: 'Country name in English' },
                'Designation date': { type: 'string', description: 'Date of Ramsar designation' },
                'Last publication date': { type: 'string', description: 'Last update date' },
                'Area (ha)': { type: 'number', description: 'Area in hectares' },
                'Latitude': { type: 'number', description: 'Latitude coordinate' },
                'Longitude': { type: 'number', description: 'Longitude coordinate' },
                'Annotated summary': { type: 'string', description: 'Site description' },
                'Criterion1': { type: 'boolean', description: 'Criterion 1: Representative/rare wetland type' },
                'Criterion2': { type: 'boolean', description: 'Criterion 2: Supports vulnerable species' },
                'Criterion3': { type: 'boolean', description: 'Criterion 3: Maintains biodiversity' },
                'Criterion4': { type: 'boolean', description: 'Criterion 4: Supports critical life stages' },
                'Criterion5': { type: 'boolean', description: 'Criterion 5: Supports 20,000+ waterbirds' },
                'Criterion6': { type: 'boolean', description: 'Criterion 6: Supports 1% of waterbird population' },
                'Criterion7': { type: 'boolean', description: 'Criterion 7: Supports indigenous fish' },
                'Criterion8': { type: 'boolean', description: 'Criterion 8: Fish spawning/nursery' },
                'Criterion9': { type: 'boolean', description: 'Criterion 9: Supports 1% of non-avian species' },
                'Wetland Type': { type: 'string', description: 'Type of wetland ecosystem' },
                'Maximum elevation': { type: 'number', description: 'Maximum elevation in meters' },
                'Minimum elevation': { type: 'number', description: 'Minimum elevation in meters' },
                'Montreux listed': { type: 'boolean', description: 'Whether site is on Montreux Record' },
                'Management plan implemented': { type: 'boolean', description: 'Management plan status' },
                'Management plan available': { type: 'boolean', description: 'Management plan availability' },
                'Ecosystem services': { type: 'string', description: 'Description of ecosystem services' },
                'Threats': { type: 'string', description: 'Documented threats to site' },
                'large administrative region': { type: 'string', description: 'Large administrative region' },
                'Global international legal designations': { type: 'string', description: 'Global legal designations' },
                'Regional international legal designations': { type: 'string', description: 'Regional legal designations' },
                'National conservation designation': { type: 'string', description: 'National conservation status' },
                'Does the wetland extend onto the territory of one or more other countries?': { type: 'boolean', description: 'Transboundary status' },
                'Ramsar Advisory Mission?': { type: 'boolean', description: 'Whether advisory mission conducted' }
            }
        },
        'wdpa': {
            displayName: 'Protected Areas (WDPA)',
            layerIds: ['wdpa-layer'],
            checkboxId: 'wdpa-layer',
            hasLegend: false,
            isVector: true,
            sourceLayer: 'wdpa',
            filterableProperties: {
                'NAME_ENG': { type: 'string', description: 'Site name in English' },
                'NAME': { type: 'string', description: 'Site name (original)' },
                'DESIG_ENG': { type: 'string', description: 'Designation type in English' },
                'DESIG_TYPE': { type: 'string', description: 'Designation type category' },
                'IUCN_CAT': {
                    type: 'string',
                    description: 'IUCN management category',
                    values: ['Ia', 'Ib', 'II', 'III', 'IV', 'V', 'VI', 'Not Reported', 'Not Applicable', 'Not Assigned']
                },
                'ISO3': { type: 'string', description: 'ISO 3-letter country code' },
                'STATUS': { type: 'string', description: 'Current status (e.g., Designated, Proposed)' },
                'STATUS_YR': { type: 'number', description: 'Year of status' },
                'GOV_TYPE': { type: 'string', description: 'Governance type' },
                'OWN_TYPE': { type: 'string', description: 'Ownership type' },
                'GIS_AREA': { type: 'number', description: 'GIS-calculated area in km²' },
                'REP_AREA': { type: 'number', description: 'Reported area in km²' },
                'MARINE': { type: 'string', description: 'Marine designation (0, 1, 2)' },
                'NO_TAKE': { type: 'string', description: 'No-take zone status' }
            }
        },
        'hydrobasins': {
            displayName: 'Watersheds (HydroBASINS)',
            layerIds: ['hydrobasins-fill', 'hydrobasins-layer'],
            checkboxId: 'hydrobasins-layer',
            hasLegend: false,
            isVector: true,
            sourceLayer: 'hydrobasins_level_03', // Default level
            currentLevel: '3', // Track current level
            filterableProperties: {
                'HYBAS_ID': { type: 'number', description: 'Unique basin identifier' },
                'PFAF_ID': { type: 'number', description: 'Pfafstetter hierarchical code' },
                'UP_AREA': { type: 'number', description: 'Upstream drainage area in km²' },
                'SUB_AREA': { type: 'number', description: 'Sub-basin area in km²' },
                'MAIN_BAS': { type: 'number', description: 'Main basin ID' }
            }
        }
    },

    // Switch HydroBASINS level
    switchHydrobasinsLevel(level) {
        const validLevels = ['3', '4', '5', '6'];
        if (!validLevels.includes(level)) {
            console.error('Invalid HydroBASINS level:', level);
            return { success: false, error: 'Invalid level. Must be 3, 4, 5, or 6.' };
        }

        const layerConfig = this.layers.hydrobasins;
        const wasVisible = map.getLayoutProperty('hydrobasins-layer', 'visibility') === 'visible';

        // Update source layer
        const newSourceLayer = `hydrobasins_level_0${level}`;
        const newSource = `hydrobasins${level}-source`;

        // Update the layers to use new source
        map.setLayoutProperty('hydrobasins-fill', 'visibility', 'none');
        map.setLayoutProperty('hydrobasins-layer', 'visibility', 'none');

        // Update layer sources
        ['hydrobasins-fill', 'hydrobasins-layer'].forEach(layerId => {
            const layer = map.getLayer(layerId);
            if (layer) {
                const paint = map.getPaintProperty(layerId, layer.type === 'fill' ? 'fill-color' : 'line-color');
                const opacity = map.getPaintProperty(layerId, layer.type === 'fill' ? 'fill-opacity' : 'line-opacity');
                const filter = map.getFilter(layerId);

                // Remove old layer
                map.removeLayer(layerId);

                // Add new layer with updated source
                if (layerId === 'hydrobasins-fill') {
                    map.addLayer({
                        'id': layerId,
                        'type': 'fill',
                        'source': newSource,
                        'source-layer': newSourceLayer,
                        'paint': {
                            'fill-color': paint || '#1E88E5',
                            'fill-opacity': opacity || 0.05
                        },
                        'layout': {
                            'visibility': wasVisible ? 'visible' : 'none'
                        }
                    }, 'hydrobasins-layer'); // Keep fill below line

                    if (filter) map.setFilter(layerId, filter);
                } else {
                    map.addLayer({
                        'id': layerId,
                        'type': 'line',
                        'source': newSource,
                        'source-layer': newSourceLayer,
                        'paint': {
                            'line-color': paint || '#1E88E5',
                            'line-width': level === '6' ? 1.5 : level === '5' ? 2 : level === '4' ? 2.5 : 3,
                            'line-opacity': opacity || 0.8
                        },
                        'layout': {
                            'visibility': wasVisible ? 'visible' : 'none'
                        }
                    });

                    if (filter) map.setFilter(layerId, filter);
                }
            }
        });

        // Update config
        layerConfig.sourceLayer = newSourceLayer;
        layerConfig.currentLevel = level;

        console.log(`Switched HydroBASINS to level ${level}`);
        return { success: true, level: level, visible: wasVisible };
    },

    // Store active filters for each layer
    activeFilters: {},

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
    },

    // Get filterable properties for a vector layer
    getFilterableProperties: function (layerKey) {
        const config = this.layers[layerKey];
        if (!config) {
            return { success: false, error: `Unknown layer: ${layerKey}` };
        }
        if (!config.isVector) {
            return { success: false, error: `Layer '${layerKey}' is a raster layer and does not support filtering` };
        }
        return {
            success: true,
            layer: layerKey,
            displayName: config.displayName,
            properties: config.filterableProperties
        };
    },

    // Set a filter on a vector layer using MapLibre filter expressions
    // filter should be a valid MapLibre filter expression array, e.g.:
    //   ["==", "IUCN_CAT", "II"]
    //   ["in", "IUCN_CAT", "Ia", "Ib", "II"]
    //   ["all", ["==", "Criterion1", true], ["==", "Criterion2", true]]
    //   [">=", "area_off", 10000]
    setLayerFilter: function (layerKey, filter) {
        const config = this.layers[layerKey];
        if (!config) {
            return { success: false, error: `Unknown layer: ${layerKey}. Available layers: ${Object.keys(this.layers).join(', ')}` };
        }
        if (!config.isVector) {
            return { success: false, error: `Layer '${layerKey}' is a raster layer and does not support filtering. Only vector layers (ramsar, wdpa, hydrobasins) can be filtered.` };
        }

        if (!window.map || !window.map.getLayer) {
            return { success: false, error: 'Map not yet initialized' };
        }

        try {
            // Apply filter to all layer IDs for this layer
            for (const layerId of config.layerIds) {
                if (window.map.getLayer(layerId)) {
                    window.map.setFilter(layerId, filter);
                    console.log(`[MapController] Filter applied to layer '${layerId}':`, filter);
                }
            }

            // Store the active filter
            this.activeFilters[layerKey] = filter;

            // Build a human-readable description of the filter
            const filterDescription = this.describeFilter(filter);

            return {
                success: true,
                layer: layerKey,
                displayName: config.displayName,
                filter: filter,
                description: filterDescription
            };
        } catch (error) {
            console.error('[MapController] Error setting filter:', error);
            return { success: false, error: `Failed to apply filter: ${error.message}` };
        }
    },

    // Clear filter from a layer (show all features)
    clearLayerFilter: function (layerKey) {
        const config = this.layers[layerKey];
        if (!config) {
            return { success: false, error: `Unknown layer: ${layerKey}` };
        }
        if (!config.isVector) {
            return { success: false, error: `Layer '${layerKey}' is a raster layer and does not have filters` };
        }

        if (!window.map || !window.map.getLayer) {
            return { success: false, error: 'Map not yet initialized' };
        }

        try {
            // Remove filter from all layer IDs (set to null or undefined)
            for (const layerId of config.layerIds) {
                if (window.map.getLayer(layerId)) {
                    window.map.setFilter(layerId, null);
                    console.log(`[MapController] Filter cleared from layer '${layerId}'`);
                }
            }

            // Remove from active filters
            delete this.activeFilters[layerKey];

            return {
                success: true,
                layer: layerKey,
                displayName: config.displayName,
                message: 'Filter cleared - showing all features'
            };
        } catch (error) {
            console.error('[MapController] Error clearing filter:', error);
            return { success: false, error: error.message };
        }
    },

    // Get current filter for a layer
    getLayerFilter: function (layerKey) {
        const config = this.layers[layerKey];
        if (!config) {
            return { success: false, error: `Unknown layer: ${layerKey}` };
        }
        if (!config.isVector) {
            return { success: false, error: `Layer '${layerKey}' is a raster layer and does not support filtering` };
        }

        const filter = this.activeFilters[layerKey] || null;
        return {
            success: true,
            layer: layerKey,
            displayName: config.displayName,
            filter: filter,
            hasFilter: filter !== null,
            description: filter ? this.describeFilter(filter) : 'No filter applied'
        };
    },

    // Helper: Generate human-readable description of a filter
    describeFilter: function (filter) {
        if (!filter || !Array.isArray(filter)) return 'No filter';

        const op = filter[0];

        // Handle comparison operators
        if (['==', '!=', '>', '<', '>=', '<='].includes(op)) {
            const prop = filter[1];
            const val = filter[2];
            const opText = {
                '==': 'equals',
                '!=': 'not equals',
                '>': 'greater than',
                '<': 'less than',
                '>=': 'at least',
                '<=': 'at most'
            }[op];
            return `${prop} ${opText} ${val}`;
        }

        // Handle 'in' operator
        if (op === 'in') {
            const prop = filter[1];
            const vals = filter.slice(2);
            return `${prop} is one of: ${vals.join(', ')}`;
        }

        // Handle 'all' (AND)
        if (op === 'all') {
            const conditions = filter.slice(1).map(f => this.describeFilter(f));
            return conditions.join(' AND ');
        }

        // Handle 'any' (OR)
        if (op === 'any') {
            const conditions = filter.slice(1).map(f => this.describeFilter(f));
            return `(${conditions.join(' OR ')})`;
        }

        // Handle 'has' / '!has'
        if (op === 'has') {
            return `has property '${filter[1]}'`;
        }
        if (op === '!has') {
            return `missing property '${filter[1]}'`;
        }

        // Fallback
        return JSON.stringify(filter);
    },

    // Default paint properties for each vector layer (for reset functionality)
    defaultPaint: {
        'wdpa': {
            'fill-color': '#2E7D32',
            'fill-opacity': 0.5,
            'line-color': '#1B5E20',
            'line-width': 1.5
        },
        'ramsar': {
            'fill-color': '#0288D1',
            'fill-opacity': 0.4,
            'line-color': '#01579B',
            'line-width': 1.5
        },
        'hydrobasins': {
            'fill-color': 'transparent',
            'fill-opacity': 0.2,
            'line-color': '#1565C0',
            'line-width': 1
        }
    },

    // Set a paint property on a vector layer (for data-driven styling)
    setLayerPaint: function (layerKey, property, value) {
        const config = this.layers[layerKey];
        if (!config) {
            return { success: false, error: `Unknown layer: ${layerKey}. Available layers: ${Object.keys(this.layers).join(', ')}` };
        }
        if (!config.isVector) {
            return { success: false, error: `Layer '${layerKey}' is a raster layer and does not support paint styling. Only vector layers (ramsar, wdpa, hydrobasins) can be styled.` };
        }

        if (!window.map || !window.map.getLayer) {
            return { success: false, error: 'Map not yet initialized' };
        }

        try {
            // Determine which layer ID(s) to apply the property to
            // fill-* properties go to fill layers, line-* properties go to line/outline layers
            const isFillProperty = property.startsWith('fill-');
            const isLineProperty = property.startsWith('line-');

            for (const layerId of config.layerIds) {
                if (window.map.getLayer(layerId)) {
                    const layerType = window.map.getLayer(layerId).type;

                    // Apply fill properties to fill layers, line properties to line layers
                    if ((isFillProperty && layerType === 'fill') ||
                        (isLineProperty && layerType === 'line')) {
                        window.map.setPaintProperty(layerId, property, value);
                        console.log(`[MapController] Paint property '${property}' set on layer '${layerId}':`, value);
                    }
                }
            }

            // Build a human-readable description
            let description;
            if (Array.isArray(value) && value[0] === 'match') {
                const prop = value[1][1]; // ["get", "property_name"] -> property_name
                description = `Coloring by ${prop}`;
            } else if (Array.isArray(value) && value[0] === 'interpolate') {
                const prop = value[2][1]; // ["get", "property_name"]
                description = `Gradient coloring by ${prop}`;
            } else if (Array.isArray(value) && value[0] === 'step') {
                const prop = value[1][1]; // ["get", "property_name"]
                description = `Stepped coloring by ${prop}`;
            } else {
                description = `Set ${property} to ${typeof value === 'string' ? value : JSON.stringify(value)}`;
            }

            return {
                success: true,
                layer: layerKey,
                displayName: config.displayName,
                property: property,
                value: value,
                description: description
            };
        } catch (error) {
            console.error('[MapController] Error setting paint property:', error);
            return { success: false, error: `Failed to apply paint property: ${error.message}` };
        }
    },

    // Reset paint properties to defaults for a vector layer
    resetLayerPaint: function (layerKey) {
        const config = this.layers[layerKey];
        if (!config) {
            return { success: false, error: `Unknown layer: ${layerKey}` };
        }
        if (!config.isVector) {
            return { success: false, error: `Layer '${layerKey}' is a raster layer and does not support paint styling` };
        }

        if (!window.map || !window.map.getLayer) {
            return { success: false, error: 'Map not yet initialized' };
        }

        const defaults = this.defaultPaint[layerKey];
        if (!defaults) {
            return { success: false, error: `No default paint properties defined for layer: ${layerKey}` };
        }

        try {
            for (const layerId of config.layerIds) {
                if (window.map.getLayer(layerId)) {
                    const layerType = window.map.getLayer(layerId).type;

                    if (layerType === 'fill') {
                        if (defaults['fill-color']) {
                            window.map.setPaintProperty(layerId, 'fill-color', defaults['fill-color']);
                        }
                        if (defaults['fill-opacity']) {
                            window.map.setPaintProperty(layerId, 'fill-opacity', defaults['fill-opacity']);
                        }
                    } else if (layerType === 'line') {
                        if (defaults['line-color']) {
                            window.map.setPaintProperty(layerId, 'line-color', defaults['line-color']);
                        }
                        if (defaults['line-width']) {
                            window.map.setPaintProperty(layerId, 'line-width', defaults['line-width']);
                        }
                    }
                    console.log(`[MapController] Paint reset to defaults on layer '${layerId}'`);
                }
            }

            return {
                success: true,
                layer: layerKey,
                displayName: config.displayName,
                message: 'Paint properties reset to defaults'
            };
        } catch (error) {
            console.error('[MapController] Error resetting paint:', error);
            return { success: false, error: error.message };
        }
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

        // Add click popup for Ramsar sites
        map.on('click', 'ramsar-layer', (e) => {
            const coordinates = e.lngLat;
            const properties = e.features[0].properties;

            new maplibregl.Popup()
                .setLngLat(coordinates)
                .setHTML(`
                    <strong>${properties["Site name"] || 'Ramsar Site'}</strong><br>
                    ${properties.ramsarid ? 'ID: ' + properties.ramsarid + '<br>' : ''}
                    ${properties["Area (ha)"] ? 'Area: ' + properties["Area (ha)"] + ' ha<br>' : ''}
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
                'fill-opacity': 0.5
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
                    ${properties.OWN_TYPE ? 'Ownership: ' + properties.OWN_TYPE + '<br>' : ''}
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

        // Add HydroBASINS PMTiles sources for all levels (3-6)
        const hydrobasinsLevels = ['3', '4', '5', '6'];
        hydrobasinsLevels.forEach(level => {
            const levelPadded = level.padStart(2, '0');
            map.addSource(`hydrobasins${level}-source`, {
                'type': 'vector',
                'url': `pmtiles://https://s3-west.nrp-nautilus.io/public-hydrobasins/level_${levelPadded}/hydrobasins_level_${levelPadded}.pmtiles`,
                'attribution': '<a href="https://www.hydrosheds.org/products/hydrobasins" target="_blank">HydroBASINS</a>'
            });
        });

        // Add HydroBASINS layers (initially using level 3)
        map.addLayer({
            'id': 'hydrobasins-fill',
            'type': 'fill',
            'source': 'hydrobasins3-source',
            'source-layer': 'hydrobasins_level_03',
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
            'source': 'hydrobasins3-source',
            'source-layer': 'hydrobasins_level_03',
            'minzoom': 0,
            'maxzoom': 22,
            'paint': {
                'line-color': '#1E88E5',
                'line-width': 3,
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
            const currentLevel = window.MapController.layers.hydrobasins.currentLevel;

            new maplibregl.Popup()
                .setLngLat(coordinates)
                .setHTML(`
                    <strong>Watershed Basin (Level ${currentLevel})</strong><br>
                    ${properties.PFAF_ID ? 'Pfafstetter ID: ' + properties.PFAF_ID + '<br>' : ''}
                    ${properties.UP_AREA ? 'Upstream Area: ' + properties.UP_AREA + ' km²<br>' : ''}
                    ${properties.SUB_AREA ? 'Sub-basin Area: ' + properties.SUB_AREA + ' km²<br>' : ''}
                `)
                .addTo(map);
        });

        // Change cursor on hover
        map.on('mouseenter', 'hydrobasins-fill', () => {
            map.getCanvas().style.cursor = 'pointer'
                ;
        });
        map.on('mouseleave', 'hydrobasins-fill', () => {
            map.getCanvas().style.cursor = '';
        });

        console.log('HydroBASINS layers added successfully (default: level 3)');

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
            });
        }

        // Set up WDPA layer toggle
        const wdpaCheckbox = document.getElementById('wdpa-layer');
        if (wdpaCheckbox) {
            wdpaCheckbox.addEventListener('change', function () {
                const visibility = this.checked ? 'visible' : 'none';
                map.setLayoutProperty('wdpa-layer', 'visibility', visibility);
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

        // Set up HydroBASINS level selector
        const hydrobasinsLevelDropdown = document.getElementById('hydrobasins-level');
        if (hydrobasinsLevelDropdown) {
            hydrobasinsLevelDropdown.addEventListener('change', function (e) {
                const level = this.value;
                console.log('Switching to HydroBASINS level', level);
                window.MapController.switchHydrobasinsLevel(level);
            });

            // Prevent clicking dropdown from toggling the checkbox
            hydrobasinsLevelDropdown.addEventListener('click', function (e) {
                e.stopPropagation();
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

        if (!ramsarVisible) {
            map.setLayoutProperty('ramsar-layer', 'visibility', 'none');
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
                'fill-opacity': 0.5
            }
        });

        if (!wdpaVisible) {
            map.setLayoutProperty('wdpa-layer', 'visibility', 'none');
            document.getElementById('wdpa-layer').checked = false;
        }

        // Re-add HydroBASINS layer with current level
        const currentLevel = window.MapController.layers.hydrobasins.currentLevel;
        const levelPadded = currentLevel.padStart(2, '0');
        const sourceKey = `hydrobasins${currentLevel}-source`;
        const sourceLayer = `hydrobasins_level_${levelPadded}`;

        map.addSource(sourceKey, {
            'type': 'vector',
            'url': `pmtiles://https://s3-west.nrp-nautilus.io/public-hydrobasins/level_${levelPadded}/hydrobasins_level_${levelPadded}.pmtiles`,
            'attribution': '<a href="https://www.hydrosheds.org/products/hydrobasins" target="_blank">HydroBASINS</a>'
        });

        map.addLayer({
            'id': 'hydrobasins-fill',
            'type': 'fill',
            'source': sourceKey,
            'source-layer': sourceLayer,
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
            'source': sourceKey,
            'source-layer': sourceLayer,
            'minzoom': 0,
            'maxzoom': 22,
            'paint': {
                'line-color': '#1E88E5',
                'line-width': currentLevel === '6' ? 1.5 : currentLevel === '5' ? 2 : currentLevel === '4' ? 2.5 : 3,
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
