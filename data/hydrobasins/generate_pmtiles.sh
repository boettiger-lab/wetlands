#!/bin/bash
# Script to generate PMTiles from HydroBasins GeoPackage
# Requires: tippecanoe (https://github.com/felt/tippecanoe)
# Requires: gdal/ogr2ogr for GeoPackage conversion

set -e  # Exit on error

wget https://minio.carlboettiger.info/public-hydrobasins/combined_hydrobasins.gpkg

GPKG="combined_hydrobasins.gpkg"
OUTPUT_DIR="pmtiles"

# Create output directory
mkdir -p "$OUTPUT_DIR"

echo "Starting PMTiles generation from $GPKG"
echo "Output directory: $OUTPUT_DIR"
echo ""

# Check if GPKG exists
if [ ! -f "$GPKG" ]; then
    echo "Error: $GPKG not found!"
    exit 1
fi

# Define zoom ranges for each level (coarser levels = lower max zoom)
declare -A ZOOM_CONFIG=(
    ["level_01"]="0-4"
    ["level_02"]="0-5"
    ["level_03"]="0-6"
    ["level_04"]="0-7"
    ["level_05"]="0-8"
    ["level_06"]="0-9"
    ["level_07"]="0-10"
    ["level_08"]="0-11"
    ["level_09"]="0-12"
    ["level_10"]="0-13"
    ["level_11"]="0-14"
    ["level_12"]="0-14"
)

# Process each level
for level in {01..09}; do
    LAYER="level_$level"
    OUTPUT="$OUTPUT_DIR/${LAYER}.pmtiles"
    ZOOM="${ZOOM_CONFIG[$LAYER]}"
    
    echo "Processing $LAYER (zoom range: $ZOOM)..."
    
    # Convert GeoPackage layer to GeoJSON and pipe to tippecanoe
    ogr2ogr -f GeoJSON /vsistdout/ "$GPKG" "$LAYER" | \
    tippecanoe \
        --output="$OUTPUT" \
        --layer="$LAYER" \
        --name="HydroBasins $LAYER" \
        --attribution="HydroSHEDS/HydroBasins" \
        --minimum-zoom="${ZOOM%-*}" \
        --maximum-zoom="${ZOOM#*-}" \
        --drop-densest-as-needed \
        --extend-zooms-if-still-dropping \
        --simplification=10 \
        --no-tile-size-limit \
        --force
    
    # Get file size for reporting
    SIZE=$(du -h "$OUTPUT" | cut -f1)
    echo "  ✓ Generated $OUTPUT ($SIZE)"
    echo ""
done

echo "PMTiles generation complete!"

"mc cp $OUTPUT_DIR/ s3://public-hydrobasins/ --recursive"
