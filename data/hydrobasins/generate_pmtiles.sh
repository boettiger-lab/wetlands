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
# Process each level with its own zoom range, then merge
# Unfortunately tippecanoe doesn't support per-layer zoom in a single command,
# so we need to create them separately and merge

echo "Creating zoom 0-4 tiles from level_01..."
tippecanoe -o "$TEMP_DIR/z0-4.pmtiles" -Z0 -z4 -l hydrobasins --force \
    --name="HydroBasins" --attribution="HydroSHEDS/HydroBasins" \
    --no-tile-size-limit --drop-densest-as-needed \
    "$TEMP_DIR/level_01.geojson"

echo "Creating zoom 5 tiles from level_02..."
tippecanoe -o "$TEMP_DIR/z5.pmtiles" -Z5 -z5 -l hydrobasins --force \
    --no-tile-size-limit --drop-densest-as-needed \
    "$TEMP_DIR/level_02.geojson"

echo "Creating zoom 6 tiles from level_03..."
tippecanoe -o "$TEMP_DIR/z6.pmtiles" -Z6 -z6 -l hydrobasins --force \
    --no-tile-size-limit --drop-densest-as-needed \
    "$TEMP_DIR/level_03.geojson"

echo "Creating zoom 7 tiles from level_04..."
tippecanoe -o "$TEMP_DIR/z7.pmtiles" -Z7 -z7 -l hydrobasins --force \
    --no-tile-size-limit --drop-densest-as-needed \
    "$TEMP_DIR/level_04.geojson"

echo "Creating zoom 8 tiles from level_05..."
tippecanoe -o "$TEMP_DIR/z8.pmtiles" -Z8 -z8 -l hydrobasins --force \
    --no-tile-size-limit --drop-densest-as-needed \
    "$TEMP_DIR/level_05.geojson"

echo "Creating zoom 9 tiles from level_06..."
tippecanoe -o "$TEMP_DIR/z9.pmtiles" -Z9 -z9 -l hydrobasins --force \
    --no-tile-size-limit --drop-densest-as-needed \
    "$TEMP_DIR/level_06.geojson"

echo "Creating zoom 10 tiles from level_07..."
tippecanoe -o "$TEMP_DIR/z10.pmtiles" -Z10 -z10 -l hydrobasins --force \
    --no-tile-size-limit --drop-densest-as-needed \
    "$TEMP_DIR/level_07.geojson"

echo "Creating zoom 11 tiles from level_08..."
tippecanoe -o "$TEMP_DIR/z11.pmtiles" -Z11 -z11 -l hydrobasins --force \
    --no-tile-size-limit --drop-densest-as-needed \
    "$TEMP_DIR/level_08.geojson"

echo "Creating zoom 12-14 tiles from level_09..."
tippecanoe -o "$TEMP_DIR/z12-14.pmtiles" -Z12 -z14 -l hydrobasins --force \
    --no-tile-size-limit --drop-densest-as-needed \
    "$TEMP_DIR/level_09.geojson"

echo "Merging all zoom levels into single PMTiles..."
tile-join -o "$OUTPUT" --force \
    "$TEMP_DIR/z0-4.pmtiles" \
    "$TEMP_DIR/z5.pmtiles" \
    "$TEMP_DIR/z6.pmtiles" \
    "$TEMP_DIR/z7.pmtiles" \
    "$TEMP_DIR/z8.pmtiles" \
    "$TEMP_DIR/z9.pmtiles" \
    "$TEMP_DIR/z10.pmtiles" \
    "$TEMP_DIR/z11.pmtiles" \
    "$TEMP_DIR/z12-14.pmtiles"

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
