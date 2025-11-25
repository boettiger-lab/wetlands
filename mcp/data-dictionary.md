# Wetlands Data Dictionary and LLM Context

This file provides the schema documentation and encoding information for the wetlands datasets accessible through the MCP server.

## Data Sources

### 1. Wetlands Data (`s3://public-wetlands/hex/**`)

**Source**: Global Lakes and Wetlands Database (GLWD) v2.0, aggregated to H3 hexagons
**Format**: GeoParquet
**Endpoint**: `minio.carlboettiger.info`

**Schema**:
- `Z` (INTEGER): Wetland classification code (0-33, see classification table below)
- `h8` (VARCHAR): H3 hexagon index at resolution 8 (from https://h3geo.org)
- `h0` (VARCHAR): H3 hexagon index at resolution 0 (coarsest resolution)

**H3 Geospatial Indexing**:
The `h8` column uses the H3 hierarchical geospatial indexing system (https://h3geo.org):
- Each H3 resolution 8 hexagon covers **73.7327598 hectares** (approximately 0.737 km²)
- Hexagons are approximately uniform in size globally
- Hexagons tile the Earth's surface with minimal overlap/gaps

**Area Calculations**:
To calculate wetland areas from hexagon counts:
```sql
-- Area in hectares
SELECT COUNT(*) * 73.7327598 as area_hectares FROM ...

-- Area in square kilometers
SELECT COUNT(*) * 0.737327598 as area_km2 FROM ...

-- Area in square miles
SELECT COUNT(*) * 0.284679 as area_sq_miles FROM ...
```

**Required S3 Secret Setup**:
```sql
CREATE OR REPLACE SECRET s3 (
    TYPE S3,
    ENDPOINT 'minio.carlboettiger.info',
    URL_STYLE 'path'
);
```

**Wetland Classification Codes**:

| Code | Name | Description | Category |
|------|------|-------------|----------|
| 0 | No data | Transparent - no wetland data | null |
| 1 | Freshwater lake | Freshwater lake - deep blue | Open Water |
| 2 | Saline lake | Saline lake - cyan | Open Water |
| 3 | Reservoir | Reservoir - dark blue | Open Water |
| 4 | Large river | Large river - very dark blue | Open Water |
| 5 | Small river | Small river - medium blue | Open Water |
| 6 | Coastal lagoon | Coastal lagoon - light blue | Coastal & Other |
| 7 | Delta | Delta - blue-green | Coastal & Other |
| 8 | Estuary | Estuary - teal | Coastal & Other |
| 9 | Reef | Reef - aqua | Coastal & Other |
| 10 | Salt marsh | Salt marsh - dark green | Coastal & Other |
| 11 | Mangrove | Mangrove - olive green | Coastal & Other |
| 12 | Coastal wetland | Coastal wetland - sea green | Coastal & Other |
| 13 | Freshwater marsh | Freshwater marsh - bright green | Palustrine Wetlands |
| 14 | Swamp forest | Swamp forest - forest green | Palustrine Wetlands |
| 15 | Flooded forest | Flooded forest - dark olive | Palustrine Wetlands |
| 16 | Floodplain | Floodplain - tan | Riverine Wetlands |
| 17 | Oxbow lake | Oxbow lake - light brown | Riverine Wetlands |
| 18 | Riverine wetland | Riverine wetland - brown | Riverine Wetlands |
| 19 | Lacustrine fringe | Lacustrine fringe - light gray | Lacustrine Wetlands |
| 20 | Lacustrine marsh | Lacustrine marsh - medium gray | Lacustrine Wetlands |
| 21 | Pan | Pan - light pink | Ephemeral Wetlands |
| 22 | Intermittent wetland | Intermittent wetland - pink | Ephemeral Wetlands |
| 23 | Seasonal wetland | Seasonal wetland - rose | Ephemeral Wetlands |
| 24 | Bog | Bog - purple | Peatlands |
| 25 | Fen | Fen - lavender | Peatlands |
| 26 | Mire | Mire - violet | Peatlands |
| 27 | String bog | String bog - plum | Peatlands |
| 28 | Palsa | Palsa - burgundy | Peatlands |
| 29 | Peatland forest | Peatland forest - maroon | Peatlands |
| 30 | Tundra wetland | Tundra wetland - slate | Peatlands |
| 31 | Alpine wetland | Alpine wetland - charcoal | Peatlands |
| 32 | Wetland complex | Wetland complex - dark gray | Coastal & Other |
| 33 | Unknown wetland | Unknown wetland - black | Coastal & Other |

### 2. Species Richness Data

**Source**: Mobile Observation Biodiversity Initiative (MOBI)
**URL**: `https://minio.carlboettiger.info/public-mobi/hex/all-richness-h8.parquet`

**Schema**:
- `richness` (INTEGER): Number of species observed in this hexagon
- `h8` (VARCHAR): H3 hexagon index at resolution 8

### 3. Social Vulnerability Data

**Source**: CDC Social Vulnerability Index (SVI) 2022
**URL**: `https://minio.carlboettiger.info/public-social-vulnerability/2022-tracts-h3-z8.parquet`

**Schema**:
- `h8` (VARCHAR): H3 hexagon index at resolution 8 (lowercase)
- Additional SVI metrics (TBD - needs schema inspection)

## Common Query Patterns

### Count wetlands by type:
```sql
CREATE OR REPLACE SECRET s3 (TYPE S3, ENDPOINT 'minio.carlboettiger.info', URL_STYLE 'path');

SELECT 
    Z as wetland_code,
    COUNT(*) as hexagon_count
FROM read_parquet('s3://public-wetlands/hex/**')
GROUP BY Z
ORDER BY hexagon_count DESC;
```

### Join wetlands with species richness:
```sql
CREATE OR REPLACE SECRET s3 (TYPE S3, ENDPOINT 'minio.carlboettiger.info', URL_STYLE 'path');

SELECT 
    w.Z as wetland_type,
    w.h8,
    s.richness
FROM read_parquet('s3://public-wetlands/hex/**') w
INNER JOIN read_parquet('https://minio.carlboettiger.info/public-mobi/hex/all-richness-h8.parquet') s
ON w.h8 = s.h8
LIMIT 10;
```

### Analyze wetlands by species reicgness

```sql
CREATE OR REPLACE SECRET s3 (TYPE S3, ENDPOINT 'minio.carlboettiger.info', URL_STYLE 'path');

SELECT 
    w.Z as wetland_type,
    COUNT(*) as count,
    AVG(s.richness) as avg_species_richness
FROM read_parquet('s3://public-wetlands/hex/**') w
LEFT JOIN read_parquet('https://minio.carlboettiger.info/public-mobi/hex/all-richness-h8.parquet') s
ON w.h8 = s.h8
GROUP BY w.Z
ORDER BY avg_species_richness DESC;
```

## Important Notes

1. **Always set up the S3 secret first** in your query before accessing S3 data
2. **H3 hexagons** (https://h3geo.org) are a geospatial indexing system:
   - Resolution 8 (`h8`): **73.7327598 hectares** per hexagon (0.737 km²)
   - Approximately uniform size globally
   - Use COUNT(*) × 73.7327598 to calculate hectares
3. **Join key**: Use `h8` column to join across datasets
4. **Case sensitivity**: The social vulnerability data has lowercase `h8`, wetlands has regular case
5. **Wetland codes**: 0 = no data, 1-33 = specific wetland types (see table above)

## LLM Instructions

When answering questions about wetlands data:
1. **Always include the S3 secret setup** in your queries
2. **Always calculate and report areas** - Convert hexagon counts to hectares or km² using:
   - Hectares: `COUNT(*) * 73.7327598`
   - Square kilometers: `COUNT(*) * 0.737327598`
   - Square miles: `COUNT(*) * 0.284679`
3. **Translate wetland codes** (Z values) to human-readable names using the classification table
4. **Aggregate by category** for broader questions (e.g., "peatlands" = codes 24-31)
5. **Join datasets** using the `h8` column as the key
6. **Format responses** with both hexagon counts AND areas (e.g., "15,000 hexagons covering 1,105,991 hectares")
