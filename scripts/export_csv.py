"""
export_csv.py — Export approved programs from Supabase and push data/programs.csv to GitHub.

Usage:
    python scripts/export_csv.py
    python scripts/export_csv.py --dry-run   # write CSV locally only; no GitHub push

Requires:
    pip install supabase python-dotenv PyGithub
    .env with SUPABASE_SERVICE_KEY, VITE_SUPABASE_URL, GITHUB_TOKEN, GITHUB_REPO, GITHUB_CSV_PATH
"""

import argparse
import base64
import csv
import io
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).parent.parent
load_dotenv(ROOT / '.env')

SUPABASE_URL = os.environ.get('VITE_SUPABASE_URL')
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_KEY')
GITHUB_TOKEN = os.environ.get('GITHUB_TOKEN')
GITHUB_REPO  = os.environ.get('GITHUB_REPO', 'colin-bishop/global-em')
GITHUB_PATH  = os.environ.get('GITHUB_CSV_PATH', 'data/programs.csv')

# Columns to export (omit internal fields like primary_contact)
EXPORT_COLUMNS = [
    'id', 'programme_name', 'country_iso', 'country_raw',
    'start_date', 'end_date', 'is_active', 'reference_year',
    'organizations', 'web_links',
    'target_species', 'bycatch_species', 'gear_types', 'areas_of_operation',
    'fleet_size_total', 'fleet_size_em', 'vessel_size_range', 'vessel_size_em',
    'trip_duration', 'flag_states',
    'em_regulation', 'programme_type', 'objectives', 'full_rem_coverage',
    'supplier_model', 'hardware_provider', 'procurement_entity', 'review_model',
    'data_transmission_primary', 'data_transmission_secondary', 'processed_data_submission',
    'additional_sensors', 'sensor_types', 'sensor_transmission_frequency',
    'collects_video', 'collects_images', 'cameras_per_vessel_min', 'cameras_per_vessel_max',
    'video_transmission_frequency', 'dcf_programme',
    'recording_config', 'video_recording_type', 'video_selection_method', 'quality_thresholds',
    'video_used_for_commercial_catch', 'programme_monitoring', 'review_objectives',
    'sampling_unit_primary', 'sampling_coverage_primary',
    'sampling_unit_secondary', 'sampling_coverage_secondary',
    'sampling_unit_tertiary', 'sampling_coverage_tertiary',
    'catch_observation_stage', 'target_species_sampled', 'bycatch_species_sampled',
    'species_id_resolution', 'length_measurements', 'sex_collected',
    'additional_characteristics', 'technical_challenges', 'primary_reviewer',
    'data_uses', 'used_in_stock_assessment', 'data_owner',
    'data_sharing_agreements', 'data_storage_location', 'data_retention_limit',
    'ai_in_development', 'ai_video_retained', 'ai_applications',
    'ai_image_subjects', 'ai_assets_available', 'ai_review_stage',
    'ai_developer', 'ai_training_data_size',
    'additional_notes', 'created_at', 'updated_at',
]


def records_to_csv(records):
    """Convert list of dicts to CSV string."""
    buf = io.StringIO()
    writer = csv.DictWriter(
        buf,
        fieldnames=EXPORT_COLUMNS,
        extrasaction='ignore',
        lineterminator='\n',
    )
    writer.writeheader()
    for r in records:
        # Flatten arrays to semicolon-delimited strings for CSV
        row = dict(r)
        for key in ('gear_types', 'programme_type'):
            if isinstance(row.get(key), list):
                row[key] = '; '.join(row[key])
        writer.writerow(row)
    return buf.getvalue()


def main():
    parser = argparse.ArgumentParser(description='Export GlobalEM programs to CSV → GitHub')
    parser.add_argument('--dry-run', action='store_true',
                        help='Write CSV locally only; skip GitHub push')
    args = parser.parse_args()

    if not SUPABASE_URL or not SUPABASE_KEY:
        sys.exit('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_KEY in .env')

    from supabase import create_client
    sb = create_client(SUPABASE_URL, SUPABASE_KEY)

    print('Fetching approved programs from Supabase...')
    result = sb.table('programs') \
               .select(','.join(EXPORT_COLUMNS)) \
               .eq('status', 'approved') \
               .order('country_iso') \
               .execute()

    records = result.data
    print(f'Fetched {len(records)} records.')

    csv_content = records_to_csv(records)

    # Always write locally as a backup
    local_path = ROOT / 'data' / 'programs.csv'
    local_path.write_text(csv_content, encoding='utf-8')
    print(f'Written locally: {local_path}')

    if args.dry_run:
        print('Dry run — skipping GitHub push.')
        return

    if not GITHUB_TOKEN:
        sys.exit('Missing GITHUB_TOKEN in .env — cannot push to GitHub.')

    from github import Github, GithubException
    gh = Github(GITHUB_TOKEN)
    repo = gh.get_repo(GITHUB_REPO)

    try:
        existing = repo.get_contents(GITHUB_PATH)
        sha = existing.sha
        repo.update_file(
            path=GITHUB_PATH,
            message=f'chore: export programs.csv ({len(records)} approved programmes)',
            content=csv_content,
            sha=sha,
        )
        print(f'Updated {GITHUB_PATH} on {GITHUB_REPO}')
    except GithubException as e:
        if e.status == 404:
            repo.create_file(
                path=GITHUB_PATH,
                message=f'chore: initial programs.csv export ({len(records)} programmes)',
                content=csv_content,
            )
            print(f'Created {GITHUB_PATH} on {GITHUB_REPO}')
        else:
            raise


if __name__ == '__main__':
    main()
