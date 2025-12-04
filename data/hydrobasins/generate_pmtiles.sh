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

OUTPUT="$OUTPUT_DIR/hydrobasins.pmtiles"

echo "Generating single PMTiles file with all HydroBasins levels..."
echo "Each zoom level will use the appropriate detail level:"
echo "  Zoom 0-4:   level_01 (coarsest)"
echo "  Zoom 5:     level_02"
echo "  Zoom 6:     level_03"
echo "  Zoom 7:     level_04"
echo "  Zoom 8:     level_05"
echo "  Zoom 9:     level_06"
echo "  Zoom 10:    level_07"
echo "  Zoom 11:    level_08"
echo "  Zoom 12+:   level_09 (finest available)"
echo ""

# Create temporary directory for GeoJSON files
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

# Convert each level to GeoJSON with zoom range metadata
for level in {01..09}; do
    LAYER="level_$level"
    echo "Extracting $LAYER..."
    ogr2ogr -f GeoJSON "$TEMP_DIR/${LAYER}.geojson" "$GPKG" "$LAYER"
done

# Combine all levels into single PMTiles with appropriate zoom ranges
# Use -z/-Z flags per layer to control which detail level appears at which zoom
tippecanoe \
    --output="$OUTPUT" \
    --name="HydroBasins" \
    --attribution="HydroSHEDS/HydroBasins" \
    --minimum-zoom=0 \
    --maximum-zoom=14 \
    --no-tile-size-limit \
    --drop-densest-as-needed \
    --extend-zooms-if-still-dropping \
    --force \
    --layer=hydrobasins:minzoom=0:maxzoom=4:"$TEMP_DIR/level_01.geojson" \
    --layer=hydrobasins:minzoom=5:maxzoom=5:"$TEMP_DIR/level_02.geojson" \
    --layer=hydrobasins:minzoom=6:maxzoom=6:"$TEMP_DIR/level_03.geojson" \
    --layer=hydrobasins:minzoom=7:maxzoom=7:"$TEMP_DIR/level_04.geojson" \
    --layer=hydrobasins:minzoom=8:maxzoom=8:"$TEMP_DIR/level_05.geojson" \
    --layer=hydrobasins:minzoom=9:maxzoom=9:"$TEMP_DIR/level_06.geojson" \
    --layer=hydrobasins:minzoom=10:maxzoom=10:"$TEMP_DIR/level_07.geojson" \
    --layer=hydrobasins:minzoom=11:maxzoom=11:"$TEMP_DIR/level_08.geojson" \
    --layer=hydrobasins:minzoom=12:maxzoom=14:"$TEMP_DIR/level_09.geojson"

# Get file size for reporting
SIZE=$(du -h "$OUTPUT" | cut -f1)
echo ""
echo "  ✓ Generated $OUTPUT ($SIZE)"
echo ""

echo "PMTiles generation complete!"

# Configure mc alias for S3 upload
echo "Configuring MinIO client..."
mc alias set s3 "http://${AWS_S3_ENDPOINT}" "${MINIO_KEY}" "${MINIO_SECRET}"

# Upload to S3
echo "Uploading to S3..."
mc cp $OUTPUT_DIR/ s3/public-hydrobasins/ --recursive
