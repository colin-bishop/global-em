import { readFileSync, writeFileSync } from 'fs';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createHash } from 'crypto';

const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ISO_MAP = JSON.parse(readFileSync(join(ROOT, 'data', 'country_iso_map.json'), 'utf8'));
const CENTROIDS = JSON.parse(readFileSync(join(ROOT, 'data', 'country_centroids.json'), 'utf8'));

const excelPath = join(ROOT, 'data', 'Inventory.xlsx.xlsx');
const outPath = join(ROOT, 'data', 'programs.json');

function normaliseCountry(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  const parts = s.replace(/;/g, ',').split(',').map(p => p.trim());
  for (const part of parts) {
    if (ISO_MAP[part]) return ISO_MAP[part];
  }
  return null;
}

function parseBool(value) {
  if (value == null) return null;
  const s = String(value).trim().toLowerCase();
  if (['yes', 'true', '1'].includes(s)) return true;
  if (['no', 'false', '0'].includes(s)) return false;
  return null;
}

function parseDate(value) {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  // openpyxl-style numeric serial dates are handled by xlsx library as Date objects
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return null;
}

function parseInt2(value) {
  if (value == null) return null;
  const n = parseInt(String(value).replace(/,/g, '').trim(), 10);
  return isNaN(n) ? null : n;
}

function parseArray(value, sep = ';') {
  if (!value) return null;
  const items = String(value).split(sep).map(s => s.trim()).filter(Boolean);
  return items.length ? items : null;
}

function parseCameras(value) {
  if (value == null) return [null, null];
  const s = String(value).trim();
  if (s.includes('-')) {
    const parts = s.split('-');
    const a = parseInt(parts[0], 10), b = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(a) && !isNaN(b)) return [a, b];
  }
  const v = parseInt(s, 10);
  return isNaN(v) ? [null, null] : [v, v];
}

function parseVideoType(value) {
  if (!value) return [null, null];
  const v = String(value).toLowerCase();
  const collects_video = v.includes('video') || null;
  const collects_images = (v.includes('image') || v.includes('still')) || null;
  return [collects_video, collects_images];
}

function first(...values) {
  for (const v of values) {
    if (v != null && String(v).trim()) return v;
  }
  return null;
}

function str(v) {
  return v != null && String(v).trim() ? String(v).trim() : null;
}

function stableId(name, country, startDate) {
  const key = `${name ?? ''}|${country ?? ''}|${startDate ?? ''}`;
  const hex = createHash('sha256').update(key).digest('hex');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20,32)}`;
}

function rowToRecord(c) {
  const country_raw = c[6];
  const country_iso = normaliseCountry(country_raw);
  const centroid = country_iso && CENTROIDS[country_iso] ? CENTROIDS[country_iso] : null;
  const [lat, lon] = centroid || [null, null];

  const [collects_video, collects_images] = parseVideoType(c[42]);
  const [cam_min_a, cam_max_a] = parseCameras(c[43]);
  const [cam_min_b, cam_max_b] = parseCameras(c[44]);
  const [cam_min_c, cam_max_c] = parseCameras(c[45]);
  const cam_min = first(cam_min_a, cam_min_b, cam_min_c);
  const cam_max = first(cam_max_a, cam_max_b, cam_max_c);

  const gear_raw = first(c[16], c[29]);
  const transmission_raw = first(c[34], c[35], c[36]);
  const video_freq = first(c[46], c[47]);
  const video_recording = first(c[53], c[54]);
  const image_config = first(c[55], c[56]);
  const review_objectives = first(c[61], c[62]);

  const ai_dev_raw = c[86] ? String(c[86]).trim().toLowerCase() : '';
  const ai_in_development =
    ai_dev_raw.includes('development') || ai_dev_raw === 'yes' ? true :
    ai_dev_raw === 'no' ? false : null;

  const name = str(c[5]);
  const startDate = parseDate(c[7]);
  return {
    id:                           stableId(name, country_iso, startDate),
    programme_name:               name,
    country_raw:                  str(country_raw),
    country_iso,
    latitude:                     lat,
    longitude:                    lon,
    start_date:                   startDate,
    is_active:                    parseBool(c[8]),
    end_date:                     parseDate(c[9]),
    organizations:                str(c[10]),
    primary_contact:              str(c[11]),
    web_links:                    str(c[12]),
    reference_year:               parseInt2(c[13]),
    target_species:               str(c[14]),
    bycatch_species:              str(c[15]),
    gear_types:                   parseArray(gear_raw),
    areas_of_operation:           str(c[17]),
    fleet_size_total:             str(c[18]),
    vessel_size_range:            str(c[19]),
    trip_duration:                str(c[20]),
    additional_notes:             str(c[21]),
    flag_states:                  str(c[22]),
    em_regulation:                str(c[23]),
    programme_type:               parseArray(c[24]),
    objectives:                   str(c[25]),
    full_rem_coverage:            parseBool(c[26]),
    fleet_size_em:                parseInt2(c[27]),
    vessel_size_em:               str(c[28]),
    supplier_model:               str(c[30]),
    hardware_provider:            str(c[31]),
    procurement_entity:           str(c[32]),
    review_model:                 str(c[33]),
    data_transmission_primary:    str(transmission_raw),
    data_transmission_secondary:  str(c[37]),
    processed_data_submission:    str(c[38]),
    additional_sensors:           parseBool(c[39]),
    sensor_types:                 str(c[40]),
    sensor_transmission_frequency: str(c[41]),
    collects_video,
    collects_images,
    cameras_per_vessel_min:       cam_min,
    cameras_per_vessel_max:       cam_max,
    video_transmission_frequency: str(video_freq),
    dcf_programme:                parseBool(c[49]),
    recording_config:             str(c[52]),
    video_recording_type:         str(video_recording),
    image_capture_config:         str(image_config),
    video_selection_method:       str(c[57]),
    quality_thresholds:           str(c[58]),
    video_used_for_commercial_catch: parseBool(c[59]),
    programme_monitoring:         str(c[60]),
    review_objectives:            str(review_objectives),
    sampling_unit_primary:        str(c[63]),
    sampling_coverage_primary:    str(c[64]),
    sampling_unit_secondary:      str(c[65]),
    sampling_coverage_secondary:  str(c[66]),
    sampling_unit_tertiary:       str(c[67]),
    sampling_coverage_tertiary:   str(c[68]),
    catch_observation_stage:      str(c[69]),
    target_species_sampled:       str(c[70]),
    bycatch_species_sampled:      str(c[71]),
    species_id_resolution:        str(c[72]),
    length_measurements:          str(c[73]),
    sex_collected:                str(c[74]),
    additional_characteristics:   str(c[75]),
    technical_challenges:         str(c[76]),
    primary_reviewer:             str(c[77]),
    data_uses:                    str(c[79]),
    used_in_stock_assessment:     parseBool(c[80]),
    data_owner:                   str(c[81]),
    data_sharing_agreements:      str(c[82]),
    data_storage_location:        str(c[83]),
    data_retention_limit:         str(c[84]),
    ai_in_development,
    ai_video_retained:            parseBool(c[87]),
    ai_applications:              str(c[88]),
    ai_image_subjects:            str(c[89]),
    ai_assets_available:          str(c[90]),
    ai_review_stage:              str(c[91]),
    ai_developer:                 str(c[92]),
    ai_training_data_size:        str(c[93]),
    status:                       'approved',
  };
}

const wb = XLSX.readFile(excelPath, { cellDates: true });
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

const records = [];
let skipped = 0;
for (const row of rows.slice(1)) {
  if (!row[5]) { skipped++; continue; }
  records.push(rowToRecord(row));
}

const geocoded = records.filter(r => r.latitude != null).length;
const unknownCountry = records.filter(r => r.country_iso == null).length;

console.log(`Parsed ${records.length} records (${skipped} skipped — no programme name)`);
console.log(`Geocoded: ${geocoded}/${records.length}  |  Unknown country: ${unknownCountry}`);
if (unknownCountry > 0) {
  const missing = [...new Set(records.filter(r => r.country_iso == null && r.country_raw).map(r => r.country_raw))];
  console.log(`  Unmatched countries: ${missing.join(', ')}`);
}

writeFileSync(outPath, JSON.stringify(records, null, 2));
console.log(`Written to ${outPath}`);
