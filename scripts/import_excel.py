"""
import_excel.py — Import inventory.xlsx into Supabase programs table.

Usage:
    python scripts/import_excel.py
    python scripts/import_excel.py --file "path/to/inventory.xlsx" --dry-run

Requires:
    pip install openpyxl supabase python-dotenv
    A .env file in the project root with SUPABASE_SERVICE_KEY and VITE_SUPABASE_URL.
"""

import argparse
import json
import os
import sys
from datetime import datetime, date
from pathlib import Path

from dotenv import load_dotenv
import openpyxl

# ── Load env ──────────────────────────────────────────────────────────────────
ROOT = Path(__file__).parent.parent
load_dotenv(ROOT / '.env')

SUPABASE_URL = os.environ.get('VITE_SUPABASE_URL')
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_KEY')

DEFAULT_EXCEL = ROOT / 'data' / 'inventory.xlsx'

# ── Lookup tables ─────────────────────────────────────────────────────────────
with open(ROOT / 'data' / 'country_iso_map.json') as f:
    ISO_MAP = json.load(f)

with open(ROOT / 'data' / 'country_centroids.json') as f:
    CENTROIDS = json.load(f)

# ── Helpers ───────────────────────────────────────────────────────────────────

def normalise_country(raw):
    """Return ISO-3 code or None."""
    if not raw:
        return None
    raw = str(raw).strip()
    # Handle multi-country entries like "CA; USA"
    parts = [p.strip() for p in raw.replace(';', ',').split(',')]
    for part in parts:
        iso = ISO_MAP.get(part)
        if iso:
            return iso
    return None


def parse_bool(value):
    if value is None:
        return None
    s = str(value).strip().lower()
    if s in ('yes', 'true', '1'):
        return True
    if s in ('no', 'false', '0'):
        return False
    return None


def parse_date(value):
    if value is None:
        return None
    if isinstance(value, (datetime, date)):
        return value.strftime('%Y-%m-%d')
    try:
        return datetime.strptime(str(value).strip(), '%Y-%m-%d').strftime('%Y-%m-%d')
    except ValueError:
        return None


def parse_int(value):
    if value is None:
        return None
    try:
        return int(str(value).replace(',', '').strip())
    except (ValueError, TypeError):
        return None


def parse_array(value, sep=';'):
    """Split a semicolon-delimited string into a cleaned list."""
    if not value:
        return None
    items = [item.strip() for item in str(value).split(sep) if item.strip()]
    return items if items else None


def parse_cameras(value):
    """Parse camera count — handle ranges like '2-4' or single values."""
    if value is None:
        return None, None
    s = str(value).strip()
    if '-' in s:
        parts = s.split('-')
        try:
            return int(parts[0]), int(parts[-1])
        except ValueError:
            pass
    try:
        v = int(s)
        return v, v
    except ValueError:
        return None, None


def parse_video_type(value):
    """Map the 'Does this programme collect video or imagery?' field."""
    if not value:
        return None, None
    v = str(value).lower()
    collects_video = 'video' in v
    collects_images = 'image' in v or 'still' in v
    return collects_video if collects_video else None, collects_images if collects_images else None


def first(*values):
    """Return the first non-None, non-empty value."""
    for v in values:
        if v is not None and str(v).strip():
            return v
    return None


# ── Row → record mapping ──────────────────────────────────────────────────────

def row_to_record(row):
    """Map a worksheet row (0-indexed tuple) to a programs table dict."""
    # Convenience alias
    c = row  # c[i] = column i (0-based)

    country_raw = c[6]
    country_iso = normalise_country(country_raw)
    lat, lon = None, None
    if country_iso and country_iso in CENTROIDS:
        lat, lon = CENTROIDS[country_iso]

    collects_video, collects_images = parse_video_type(c[42])

    cam_min_a, cam_max_a = parse_cameras(c[43])
    cam_min_b, cam_max_b = parse_cameras(c[44])
    cam_min_c, cam_max_c = parse_cameras(c[45])
    cam_min = first(cam_min_a, cam_min_b, cam_min_c)
    cam_max = first(cam_max_a, cam_max_b, cam_max_c)

    # Some fields appear in duplicate columns — take first non-empty
    gear_raw = first(c[16], c[29])
    transmission_raw = first(c[34], c[35], c[36])
    video_freq = first(c[46], c[47])
    video_recording = first(c[53], c[54])
    image_config = first(c[55], c[56])
    review_objectives = first(c[61], c[62])

    # AI field — col 86 is the main toggle
    ai_dev_raw = str(c[86]).strip().lower() if c[86] else ''
    ai_in_development = True if 'development' in ai_dev_raw or ai_dev_raw == 'yes' else (
        False if ai_dev_raw == 'no' else None
    )

    return {
        'programme_name':              str(c[5]).strip() if c[5] else None,
        'country_raw':                 str(country_raw).strip() if country_raw else None,
        'country_iso':                 country_iso,
        'latitude':                    lat,
        'longitude':                   lon,
        'start_date':                  parse_date(c[7]),
        'is_active':                   parse_bool(c[8]),
        'end_date':                    parse_date(c[9]),
        'organizations':               str(c[10]).strip() if c[10] else None,
        'primary_contact':             str(c[11]).strip() if c[11] else None,
        'web_links':                   str(c[12]).strip() if c[12] else None,
        'reference_year':              parse_int(c[13]),
        'target_species':              str(c[14]).strip() if c[14] else None,
        'bycatch_species':             str(c[15]).strip() if c[15] else None,
        'gear_types':                  parse_array(gear_raw),
        'areas_of_operation':          str(c[17]).strip() if c[17] else None,
        'fleet_size_total':            str(c[18]).strip() if c[18] else None,
        'vessel_size_range':           str(c[19]).strip() if c[19] else None,
        'trip_duration':               str(c[20]).strip() if c[20] else None,
        'additional_notes':            str(c[21]).strip() if c[21] else None,
        'flag_states':                 str(c[22]).strip() if c[22] else None,
        'em_regulation':               str(c[23]).strip() if c[23] else None,
        'programme_type':              parse_array(c[24]),
        'objectives':                  str(c[25]).strip() if c[25] else None,
        'full_rem_coverage':           parse_bool(c[26]),
        'fleet_size_em':               parse_int(c[27]),
        'vessel_size_em':              str(c[28]).strip() if c[28] else None,
        'supplier_model':              str(c[30]).strip() if c[30] else None,
        'hardware_provider':           str(c[31]).strip() if c[31] else None,
        'procurement_entity':          str(c[32]).strip() if c[32] else None,
        'review_model':                str(c[33]).strip() if c[33] else None,
        'data_transmission_primary':   str(transmission_raw).strip() if transmission_raw else None,
        'data_transmission_secondary': str(c[37]).strip() if c[37] else None,
        'processed_data_submission':   str(c[38]).strip() if c[38] else None,
        'additional_sensors':          parse_bool(c[39]),
        'sensor_types':                str(c[40]).strip() if c[40] else None,
        'sensor_transmission_frequency': str(c[41]).strip() if c[41] else None,
        'collects_video':              collects_video,
        'collects_images':             collects_images,
        'cameras_per_vessel_min':      cam_min,
        'cameras_per_vessel_max':      cam_max,
        'video_transmission_frequency': str(video_freq).strip() if video_freq else None,
        'dcf_programme':               parse_bool(c[49]),
        'recording_config':            str(c[52]).strip() if c[52] else None,
        'video_recording_type':        str(video_recording).strip() if video_recording else None,
        'image_capture_config':        str(image_config).strip() if image_config else None,
        'video_selection_method':      str(c[57]).strip() if c[57] else None,
        'quality_thresholds':          str(c[58]).strip() if c[58] else None,
        'video_used_for_commercial_catch': parse_bool(c[59]),
        'programme_monitoring':        str(c[60]).strip() if c[60] else None,
        'review_objectives':           str(review_objectives).strip() if review_objectives else None,
        'sampling_unit_primary':       str(c[63]).strip() if c[63] else None,
        'sampling_coverage_primary':   str(c[64]).strip() if c[64] else None,
        'sampling_unit_secondary':     str(c[65]).strip() if c[65] else None,
        'sampling_coverage_secondary': str(c[66]).strip() if c[66] else None,
        'sampling_unit_tertiary':      str(c[67]).strip() if c[67] else None,
        'sampling_coverage_tertiary':  str(c[68]).strip() if c[68] else None,
        'catch_observation_stage':     str(c[69]).strip() if c[69] else None,
        'target_species_sampled':      str(c[70]).strip() if c[70] else None,
        'bycatch_species_sampled':     str(c[71]).strip() if c[71] else None,
        'species_id_resolution':       str(c[72]).strip() if c[72] else None,
        'length_measurements':         str(c[73]).strip() if c[73] else None,
        'sex_collected':               str(c[74]).strip() if c[74] else None,
        'additional_characteristics':  str(c[75]).strip() if c[75] else None,
        'technical_challenges':        str(c[76]).strip() if c[76] else None,
        'primary_reviewer':            str(c[77]).strip() if c[77] else None,
        'data_uses':                   str(c[79]).strip() if c[79] else None,
        'used_in_stock_assessment':    parse_bool(c[80]),
        'data_owner':                  str(c[81]).strip() if c[81] else None,
        'data_sharing_agreements':     str(c[82]).strip() if c[82] else None,
        'data_storage_location':       str(c[83]).strip() if c[83] else None,
        'data_retention_limit':        str(c[84]).strip() if c[84] else None,
        'ai_in_development':           ai_in_development,
        'ai_video_retained':           parse_bool(c[87]),
        'ai_applications':             str(c[88]).strip() if c[88] else None,
        'ai_image_subjects':           str(c[89]).strip() if c[89] else None,
        'ai_assets_available':         str(c[90]).strip() if c[90] else None,
        'ai_review_stage':             str(c[91]).strip() if c[91] else None,
        'ai_developer':                str(c[92]).strip() if c[92] else None,
        'ai_training_data_size':       str(c[93]).strip() if c[93] else None,
        'status':                      'approved',
    }


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description='Import GlobalEM inventory.xlsx → Supabase')
    parser.add_argument('--file', default=str(DEFAULT_EXCEL), help='Path to inventory.xlsx')
    parser.add_argument('--dry-run', action='store_true', help='Parse only; do not write to Supabase')
    args = parser.parse_args()

    excel_path = Path(args.file)
    if not excel_path.exists():
        sys.exit(f'Excel file not found: {excel_path}')

    print(f'Reading {excel_path}...')
    wb = openpyxl.load_workbook(excel_path)
    ws = wb.active

    records = []
    skipped = 0
    for row in ws.iter_rows(min_row=2, values_only=True):
        if not row[5]:   # skip rows with no programme name
            skipped += 1
            continue
        records.append(row_to_record(row))

    print(f'Parsed {len(records)} records ({skipped} skipped — no programme name)')

    # Summary of geocoding
    geocoded = sum(1 for r in records if r['latitude'] is not None)
    unknown  = sum(1 for r in records if r['country_iso'] is None)
    print(f'Geocoded: {geocoded}/{len(records)}  |  Unknown country: {unknown}')

    if args.dry_run:
        print('\nDry run — first record:')
        import pprint
        pprint.pprint(records[0])
        return

    if not SUPABASE_URL or not SUPABASE_KEY:
        sys.exit('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_KEY in .env')

    from supabase import create_client
    sb = create_client(SUPABASE_URL, SUPABASE_KEY)

    print(f'\nUpserting {len(records)} records to Supabase...')
    # Insert in batches of 20
    batch_size = 20
    for i in range(0, len(records), batch_size):
        batch = records[i:i + batch_size]
        result = sb.table('programs').insert(batch).execute()
        print(f'  Inserted rows {i+1}–{min(i+batch_size, len(records))}')

    print('\nDone.')


if __name__ == '__main__':
    main()
