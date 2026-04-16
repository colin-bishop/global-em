"""
prepare_eez.py — Simplify the VLIZ World EEZ GeoJSON and output it to app/public/.

The World EEZ v12 dataset must be downloaded manually from:
  https://www.marineregions.org/downloads.php#marineregions
  → "World EEZ v12" → choose GeoJSON (polygon) format
  → Accept the terms and download the zip

After unzipping you will have a file like:
  World_EEZ_v12_20231025/eez_v12.json  (or eez_boundaries_v12.json)

Usage:
    python scripts/prepare_eez.py --input "path/to/eez_v12.json"

Output:
    app/public/eez_simplified.geojson  (~3–6 MB depending on tolerance)

Requires:
    pip install geopandas shapely
"""

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent
OUTPUT = ROOT / 'app' / 'public' / 'eez_simplified.geojson'


def main():
    parser = argparse.ArgumentParser(description='Simplify VLIZ EEZ GeoJSON for web use')
    parser.add_argument('--input', required=True, help='Path to downloaded eez_v12.json')
    parser.add_argument('--tolerance', type=float, default=0.05,
                        help='Simplification tolerance in degrees (default 0.05 ≈ ~5 km)')
    args = parser.parse_args()

    input_path = Path(args.input)
    if not input_path.exists():
        sys.exit(f'Input file not found: {input_path}')

    try:
        import geopandas as gpd
    except ImportError:
        sys.exit('geopandas not installed. Run: pip install geopandas shapely')

    print(f'Reading {input_path} ...')
    gdf = gpd.read_file(input_path)

    print(f'Loaded {len(gdf)} EEZ features.')
    print(f'CRS: {gdf.crs}')

    # Ensure WGS84
    if gdf.crs and gdf.crs.to_epsg() != 4326:
        print('Reprojecting to WGS84...')
        gdf = gdf.to_crs(epsg=4326)

    # Keep only the columns useful for display/tooltips
    keep_cols = []
    for col in ('GEONAME', 'TERRITORY1', 'SOVEREIGN1', 'MRGID', 'POL_TYPE', 'AREA_KM2'):
        if col in gdf.columns:
            keep_cols.append(col)
    gdf = gdf[keep_cols + ['geometry']]

    print(f'Simplifying geometry (tolerance={args.tolerance})...')
    gdf['geometry'] = gdf['geometry'].simplify(args.tolerance, preserve_topology=True)

    # Drop empty/invalid geometries
    gdf = gdf[~gdf.geometry.is_empty & gdf.geometry.notna()]

    print(f'Writing {len(gdf)} features to {OUTPUT} ...')
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    gdf.to_file(OUTPUT, driver='GeoJSON')

    size_mb = OUTPUT.stat().st_size / 1_000_000
    print(f'Done. File size: {size_mb:.1f} MB')

    if size_mb > 10:
        print(f'Warning: file is {size_mb:.1f} MB — consider increasing --tolerance to 0.1')
    else:
        print('Size is good for web use.')


if __name__ == '__main__':
    main()
