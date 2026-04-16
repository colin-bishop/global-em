-- GlobalEM Dashboard — initial schema
-- Run via Supabase dashboard: SQL Editor → New query → paste & run

-- ─────────────────────────────────────────────────────────────────────────────
-- Programs table  (publicly readable — approved programmes only)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.programs (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at                  TIMESTAMPTZ DEFAULT now(),
  updated_at                  TIMESTAMPTZ DEFAULT now(),

  -- Programme identity
  programme_name              TEXT NOT NULL,
  country_raw                 TEXT,                   -- original submitted value
  country_iso                 TEXT,                   -- normalised ISO-3166-1 alpha-3
  latitude                    DOUBLE PRECISION,       -- centroid for map marker
  longitude                   DOUBLE PRECISION,
  start_date                  DATE,
  end_date                    DATE,
  is_active                   BOOLEAN,
  organizations               TEXT,
  primary_contact             TEXT,                   -- internal; not exposed to anon
  web_links                   TEXT,
  reference_year              INTEGER,

  -- Fleet & operations
  target_species              TEXT,
  bycatch_species             TEXT,
  gear_types                  TEXT[],
  areas_of_operation          TEXT,
  fleet_size_total            TEXT,                   -- text: values are mixed e.g. "100–300"
  fleet_size_em               INTEGER,
  vessel_size_range           TEXT,
  vessel_size_em              TEXT,
  trip_duration               TEXT,
  flag_states                 TEXT,

  -- EM programme structure
  em_regulation               TEXT,                   -- Mandatory / Optional / Voluntary / Other
  programme_type              TEXT[],
  objectives                  TEXT,
  full_rem_coverage           BOOLEAN,

  -- Technical configuration
  supplier_model              TEXT,
  hardware_provider           TEXT,
  procurement_entity          TEXT,
  review_model                TEXT,
  data_transmission_primary   TEXT,
  data_transmission_secondary TEXT,
  processed_data_submission   TEXT,

  -- Sensors
  additional_sensors          BOOLEAN,
  sensor_types                TEXT,
  sensor_transmission_frequency TEXT,

  -- Video / imagery
  collects_video              BOOLEAN,
  collects_images             BOOLEAN,
  cameras_per_vessel_min      INTEGER,
  cameras_per_vessel_max      INTEGER,
  video_transmission_frequency TEXT,
  dcf_programme               BOOLEAN,
  recording_config            TEXT,
  video_recording_type        TEXT,
  image_capture_config        TEXT,
  video_selection_method      TEXT,
  quality_thresholds          TEXT,
  video_used_for_commercial_catch BOOLEAN,

  -- Review & sampling
  programme_monitoring        TEXT,
  review_objectives           TEXT,
  sampling_unit_primary       TEXT,
  sampling_coverage_primary   TEXT,
  sampling_unit_secondary     TEXT,
  sampling_coverage_secondary TEXT,
  sampling_unit_tertiary      TEXT,
  sampling_coverage_tertiary  TEXT,
  catch_observation_stage     TEXT,
  target_species_sampled      TEXT,
  bycatch_species_sampled     TEXT,
  species_id_resolution       TEXT,
  length_measurements         TEXT,
  sex_collected               TEXT,
  additional_characteristics  TEXT,
  technical_challenges        TEXT,
  primary_reviewer            TEXT,

  -- Data use & governance
  data_uses                   TEXT,
  used_in_stock_assessment    BOOLEAN,
  data_owner                  TEXT,
  data_sharing_agreements     TEXT,
  data_storage_location       TEXT,
  data_retention_limit        TEXT,

  -- AI
  ai_in_development           BOOLEAN,
  ai_video_retained           BOOLEAN,
  ai_applications             TEXT,
  ai_image_subjects           TEXT,
  ai_assets_available         TEXT,
  ai_review_stage             TEXT,
  ai_developer                TEXT,
  ai_training_data_size       TEXT,

  -- Metadata
  additional_notes            TEXT,
  status                      TEXT DEFAULT 'approved'
                                CHECK (status IN ('approved', 'pending', 'rejected'))
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Submissions table  (anon INSERT only; no public read)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.submissions (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at                  TIMESTAMPTZ DEFAULT now(),

  -- Submitter contact (internal only — never exposed via anon key)
  submitter_name              TEXT NOT NULL,
  submitter_email             TEXT NOT NULL,
  submitter_organization      TEXT,

  -- Duplicate resolution
  is_update                   BOOLEAN DEFAULT FALSE,
  existing_program_id         UUID REFERENCES public.programs(id) ON DELETE SET NULL,

  -- Mirror all program fields (same definitions as programs table above)
  programme_name              TEXT NOT NULL,
  country_raw                 TEXT,
  country_iso                 TEXT,
  start_date                  DATE,
  end_date                    DATE,
  is_active                   BOOLEAN,
  organizations               TEXT,
  primary_contact             TEXT,
  web_links                   TEXT,
  reference_year              INTEGER,
  target_species              TEXT,
  bycatch_species             TEXT,
  gear_types                  TEXT[],
  areas_of_operation          TEXT,
  fleet_size_total            TEXT,
  fleet_size_em               INTEGER,
  vessel_size_range           TEXT,
  vessel_size_em              TEXT,
  trip_duration               TEXT,
  flag_states                 TEXT,
  em_regulation               TEXT,
  programme_type              TEXT[],
  objectives                  TEXT,
  full_rem_coverage           BOOLEAN,
  supplier_model              TEXT,
  hardware_provider           TEXT,
  procurement_entity          TEXT,
  review_model                TEXT,
  data_transmission_primary   TEXT,
  data_transmission_secondary TEXT,
  processed_data_submission   TEXT,
  additional_sensors          BOOLEAN,
  sensor_types                TEXT,
  sensor_transmission_frequency TEXT,
  collects_video              BOOLEAN,
  collects_images             BOOLEAN,
  cameras_per_vessel_min      INTEGER,
  cameras_per_vessel_max      INTEGER,
  video_transmission_frequency TEXT,
  dcf_programme               BOOLEAN,
  recording_config            TEXT,
  video_recording_type        TEXT,
  image_capture_config        TEXT,
  video_selection_method      TEXT,
  quality_thresholds          TEXT,
  video_used_for_commercial_catch BOOLEAN,
  programme_monitoring        TEXT,
  review_objectives           TEXT,
  sampling_unit_primary       TEXT,
  sampling_coverage_primary   TEXT,
  sampling_unit_secondary     TEXT,
  sampling_coverage_secondary TEXT,
  sampling_unit_tertiary      TEXT,
  sampling_coverage_tertiary  TEXT,
  catch_observation_stage     TEXT,
  target_species_sampled      TEXT,
  bycatch_species_sampled     TEXT,
  species_id_resolution       TEXT,
  length_measurements         TEXT,
  sex_collected               TEXT,
  additional_characteristics  TEXT,
  technical_challenges        TEXT,
  primary_reviewer            TEXT,
  data_uses                   TEXT,
  used_in_stock_assessment    BOOLEAN,
  data_owner                  TEXT,
  data_sharing_agreements     TEXT,
  data_storage_location       TEXT,
  data_retention_limit        TEXT,
  ai_in_development           BOOLEAN,
  ai_video_retained           BOOLEAN,
  ai_applications             TEXT,
  ai_image_subjects           TEXT,
  ai_assets_available         TEXT,
  ai_review_stage             TEXT,
  ai_developer                TEXT,
  ai_training_data_size       TEXT,
  additional_notes            TEXT,

  -- Review
  status                      TEXT DEFAULT 'pending'
                                CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewer_notes              TEXT
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.programs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;

-- Anyone can read approved programmes (the public map data)
CREATE POLICY "Public read approved programs"
  ON public.programs FOR SELECT
  USING (status = 'approved');

-- Anyone can submit a new programme (INSERT into submissions)
CREATE POLICY "Public can submit"
  ON public.submissions FOR INSERT
  WITH CHECK (true);

-- No public read on submissions — admin reads via service-role key (bypasses RLS)

-- ─────────────────────────────────────────────────────────────────────────────
-- updated_at trigger
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER programs_updated_at
  BEFORE UPDATE ON public.programs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- Useful indexes
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX idx_programs_country    ON public.programs (country_iso);
CREATE INDEX idx_programs_status     ON public.programs (status);
CREATE INDEX idx_programs_active     ON public.programs (is_active);
CREATE INDEX idx_programs_regulation ON public.programs (em_regulation);
CREATE INDEX idx_submissions_status  ON public.submissions (status);
CREATE INDEX idx_submissions_created ON public.submissions (created_at DESC);
