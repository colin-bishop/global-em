import React, { useState } from 'react'
import { supabase } from '../../lib/supabase'
import DuplicateCheck from './DuplicateCheck'

// ── Option lists ──────────────────────────────────────────────────────────────

const GEAR_OPTIONS = [
  'Bottom trawls [OTB, OTT, PTB, TBB]',
  'Pelagic trawls [OTM, PTM]',
  'Seines [SSC, SDN, SPR]',
  'Longlines [LLD, LLS]',
  'Nets [GTR, GNS, GND]',
  'Dredges [DRB]',
  'Traps [FPO, FYK, FPN]',
  'Rods and lines [LHP, LHM, LTL]',
  'Other',
]

const PROGRAMME_TYPE_OPTIONS = [
  'Offshore commercial',
  'Onshore commercial',
  'Research surveys at sea',
]

const EM_REGULATION_OPTIONS = [
  'Under Regulation - Mandatory',
  'Under Regulation - Optional',
  'Non-Regulation - Voluntary',
  'Other please specify in additional information',
]

const SUPPLIER_MODEL_OPTIONS = [
  'Agency selected/Approved - Single supplier',
  'Agency selected/Approved - Multiple suppliers',
  'Industry selected - Single supplier',
  'Industry selected - Multiple suppliers',
]

const REVIEW_MODEL_OPTIONS = [
  'Agency only',
  '3rd party only',
  '3rd party & Agency',
  'Vendor-Agency',
]

const SAMPLING_UNIT_OPTIONS = [
  'Vessel trip (s)',
  'Haul (s)',
  'Set (s)',
  'Day (s)',
  'Other',
]

const VIDEO_SELECTION_OPTIONS = [
  'Random sampling',
  'Stratified random sampling',
  'Quota-based',
  'All footage reviewed',
  'Other',
]

// ── Form helpers ──────────────────────────────────────────────────────────────

function Label({ children, required }) {
  return (
    <label className="block text-xs text-slate-400 mb-1">
      {children}{required && <span className="text-red-400 ml-0.5">*</span>}
    </label>
  )
}

function Input({ label, required, value, onChange, type = 'text', placeholder, className = '' }) {
  return (
    <div className={className}>
      <Label required={required}>{label}</Label>
      <input
        type={type}
        value={value ?? ''}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded px-3 py-1.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-600 transition-colors"
      />
    </div>
  )
}

function Textarea({ label, value, onChange, rows = 3, placeholder }) {
  return (
    <div>
      <Label>{label}</Label>
      <textarea
        value={value ?? ''}
        onChange={e => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded px-3 py-1.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-600 transition-colors resize-y"
      />
    </div>
  )
}

function Select({ label, options, value, onChange, required }) {
  return (
    <div>
      <Label required={required}>{label}</Label>
      <select
        value={value ?? ''}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-[#0a1628] border border-[#1e3a5f] rounded px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-cyan-600 transition-colors"
      >
        <option value="">— select —</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )
}

function MultiCheckbox({ label, options, value = [], onChange }) {
  const toggle = opt => onChange(value.includes(opt) ? value.filter(v => v !== opt) : [...value, opt])
  return (
    <div>
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-1.5">
        {options.map(opt => (
          <button
            key={opt}
            type="button"
            onClick={() => toggle(opt)}
            className={`text-xs px-2 py-0.5 rounded border transition-colors ${
              value.includes(opt)
                ? 'border-cyan-500 bg-cyan-900/30 text-cyan-300'
                : 'border-[#1e3a5f] text-slate-400 hover:border-slate-500 hover:text-white'
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  )
}

function TriToggle({ label, value, onChange }) {
  return (
    <div className="flex items-center justify-between">
      <Label>{label}</Label>
      <div className="flex rounded overflow-hidden border border-[#1e3a5f]">
        {[null, true, false].map((v, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onChange(v)}
            className={`text-xs px-2.5 py-1 transition-colors ${
              value === v ? 'bg-cyan-700 text-white' : 'bg-[#0a1628] text-slate-400 hover:text-white'
            }`}
          >
            {v === null ? 'Unknown' : v ? 'Yes' : 'No'}
          </button>
        ))}
      </div>
    </div>
  )
}

function SectionHeader({ step, title, subtitle }) {
  return (
    <div className="mb-4">
      <div className="text-xs text-cyan-500 font-semibold uppercase tracking-wider mb-0.5">
        Step {step}
      </div>
      <h2 className="text-base font-semibold text-white">{title}</h2>
      {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
    </div>
  )
}

// ── Initial form state ────────────────────────────────────────────────────────

const EMPTY = {
  // Contact (not stored in programs table)
  submitter_name: '',
  submitter_email: '',
  submitter_organization: '',

  // Identity
  programme_name: '',
  country_raw: '',
  country_iso: '',
  start_date: '',
  end_date: '',
  is_active: null,
  organizations: '',
  primary_contact: '',
  web_links: '',
  reference_year: '',

  // Fleet
  target_species: '',
  bycatch_species: '',
  gear_types: [],
  areas_of_operation: '',
  fleet_size_total: '',
  fleet_size_em: '',
  vessel_size_range: '',
  vessel_size_em: '',
  trip_duration: '',
  flag_states: '',

  // EM structure
  em_regulation: '',
  programme_type: [],
  objectives: '',
  full_rem_coverage: null,
  supplier_model: '',
  hardware_provider: '',
  procurement_entity: '',
  review_model: '',
  data_transmission_primary: '',
  data_transmission_secondary: '',
  processed_data_submission: '',

  // Sensors
  additional_sensors: null,
  sensor_types: '',
  sensor_transmission_frequency: '',

  // Video
  collects_video: null,
  collects_images: null,
  cameras_per_vessel_min: '',
  cameras_per_vessel_max: '',
  video_transmission_frequency: '',
  dcf_programme: null,
  recording_config: '',
  video_recording_type: '',
  video_selection_method: '',
  quality_thresholds: '',
  video_used_for_commercial_catch: null,

  // Sampling
  programme_monitoring: '',
  review_objectives: '',
  sampling_unit_primary: '',
  sampling_coverage_primary: '',
  sampling_unit_secondary: '',
  sampling_coverage_secondary: '',
  sampling_unit_tertiary: '',
  sampling_coverage_tertiary: '',
  catch_observation_stage: '',
  target_species_sampled: '',
  bycatch_species_sampled: '',
  species_id_resolution: '',
  length_measurements: '',
  sex_collected: '',
  additional_characteristics: '',
  technical_challenges: '',
  primary_reviewer: '',

  // Data governance
  data_uses: '',
  used_in_stock_assessment: null,
  data_owner: '',
  data_sharing_agreements: '',
  data_storage_location: '',
  data_retention_limit: '',

  // AI
  ai_in_development: null,
  ai_video_retained: null,
  ai_applications: '',
  ai_image_subjects: '',
  ai_assets_available: '',
  ai_review_stage: '',
  ai_developer: '',
  ai_training_data_size: '',

  additional_notes: '',
}

const STEPS = ['Contact', 'Programme basics', 'Fleet & gear', 'EM configuration', 'Data collection', 'Data use & AI', 'Review & submit']

// ── Main form ─────────────────────────────────────────────────────────────────

export default function SubmitForm() {
  const [step, setStep] = useState(0)
  const [form, setForm] = useState(EMPTY)
  const [duplicateResult, setDuplicateResult] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState(null)

  const set = (key) => (value) => setForm(f => ({ ...f, [key]: value }))

  // ── Step validation ──────────────────────────────────────────────────────

  const stepValid = {
    0: form.submitter_name.trim() && form.submitter_email.trim().includes('@'),
    1: form.programme_name.trim().length >= 3,
    2: true,
    3: true,
    4: true,
    5: true,
    6: duplicateResult !== null, // user must explicitly confirm duplicate status
  }

  const canProceed = stepValid[step]

  // ── Submit ───────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    setSubmitting(true)
    setError(null)

    const isUpdate = duplicateResult !== null && duplicateResult !== 'new'
    const existingId = isUpdate ? duplicateResult.id : null

    const payload = {
      submitter_name: form.submitter_name.trim(),
      submitter_email: form.submitter_email.trim(),
      submitter_organization: form.submitter_organization.trim() || null,
      is_update: isUpdate,
      existing_program_id: existingId,

      programme_name: form.programme_name.trim(),
      country_raw: form.country_raw.trim() || null,
      country_iso: form.country_iso.trim().toUpperCase() || null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      is_active: form.is_active,
      organizations: form.organizations.trim() || null,
      primary_contact: form.primary_contact.trim() || null,
      web_links: form.web_links.trim() || null,
      reference_year: form.reference_year ? parseInt(form.reference_year) : null,
      target_species: form.target_species.trim() || null,
      bycatch_species: form.bycatch_species.trim() || null,
      gear_types: form.gear_types.length ? form.gear_types : null,
      areas_of_operation: form.areas_of_operation.trim() || null,
      fleet_size_total: form.fleet_size_total.trim() || null,
      fleet_size_em: form.fleet_size_em ? parseInt(form.fleet_size_em) : null,
      vessel_size_range: form.vessel_size_range.trim() || null,
      vessel_size_em: form.vessel_size_em.trim() || null,
      trip_duration: form.trip_duration.trim() || null,
      flag_states: form.flag_states.trim() || null,
      em_regulation: form.em_regulation || null,
      programme_type: form.programme_type.length ? form.programme_type : null,
      objectives: form.objectives.trim() || null,
      full_rem_coverage: form.full_rem_coverage,
      supplier_model: form.supplier_model || null,
      hardware_provider: form.hardware_provider.trim() || null,
      procurement_entity: form.procurement_entity.trim() || null,
      review_model: form.review_model || null,
      data_transmission_primary: form.data_transmission_primary.trim() || null,
      data_transmission_secondary: form.data_transmission_secondary.trim() || null,
      processed_data_submission: form.processed_data_submission.trim() || null,
      additional_sensors: form.additional_sensors,
      sensor_types: form.sensor_types.trim() || null,
      sensor_transmission_frequency: form.sensor_transmission_frequency.trim() || null,
      collects_video: form.collects_video,
      collects_images: form.collects_images,
      cameras_per_vessel_min: form.cameras_per_vessel_min ? parseInt(form.cameras_per_vessel_min) : null,
      cameras_per_vessel_max: form.cameras_per_vessel_max ? parseInt(form.cameras_per_vessel_max) : null,
      video_transmission_frequency: form.video_transmission_frequency.trim() || null,
      dcf_programme: form.dcf_programme,
      recording_config: form.recording_config.trim() || null,
      video_recording_type: form.video_recording_type.trim() || null,
      video_selection_method: form.video_selection_method || null,
      quality_thresholds: form.quality_thresholds.trim() || null,
      video_used_for_commercial_catch: form.video_used_for_commercial_catch,
      programme_monitoring: form.programme_monitoring.trim() || null,
      review_objectives: form.review_objectives.trim() || null,
      sampling_unit_primary: form.sampling_unit_primary || null,
      sampling_coverage_primary: form.sampling_coverage_primary.trim() || null,
      sampling_unit_secondary: form.sampling_unit_secondary || null,
      sampling_coverage_secondary: form.sampling_coverage_secondary.trim() || null,
      sampling_unit_tertiary: form.sampling_unit_tertiary || null,
      sampling_coverage_tertiary: form.sampling_coverage_tertiary.trim() || null,
      catch_observation_stage: form.catch_observation_stage.trim() || null,
      target_species_sampled: form.target_species_sampled.trim() || null,
      bycatch_species_sampled: form.bycatch_species_sampled.trim() || null,
      species_id_resolution: form.species_id_resolution.trim() || null,
      length_measurements: form.length_measurements.trim() || null,
      sex_collected: form.sex_collected.trim() || null,
      additional_characteristics: form.additional_characteristics.trim() || null,
      technical_challenges: form.technical_challenges.trim() || null,
      primary_reviewer: form.primary_reviewer.trim() || null,
      data_uses: form.data_uses.trim() || null,
      used_in_stock_assessment: form.used_in_stock_assessment,
      data_owner: form.data_owner.trim() || null,
      data_sharing_agreements: form.data_sharing_agreements.trim() || null,
      data_storage_location: form.data_storage_location.trim() || null,
      data_retention_limit: form.data_retention_limit.trim() || null,
      ai_in_development: form.ai_in_development,
      ai_video_retained: form.ai_video_retained,
      ai_applications: form.ai_applications.trim() || null,
      ai_image_subjects: form.ai_image_subjects.trim() || null,
      ai_assets_available: form.ai_assets_available.trim() || null,
      ai_review_stage: form.ai_review_stage.trim() || null,
      ai_developer: form.ai_developer.trim() || null,
      ai_training_data_size: form.ai_training_data_size.trim() || null,
      additional_notes: form.additional_notes.trim() || null,
    }

    const { error: err } = await supabase.from('submissions').insert([payload])
    setSubmitting(false)

    if (err) {
      setError(`Submission failed: ${err.message}`)
    } else {
      setSubmitted(true)
    }
  }

  // ── Success screen ────────────────────────────────────────────────────────

  if (submitted) {
    return (
      <div className="max-w-xl mx-auto px-6 py-16 text-center">
        <div className="w-14 h-14 rounded-full bg-green-900/40 border border-green-700 flex items-center justify-center mx-auto mb-4 text-2xl">✓</div>
        <h2 className="text-lg font-semibold text-white mb-2">Submission received</h2>
        <p className="text-sm text-slate-400 mb-6">
          Thank you, {form.submitter_name}. Your programme has been submitted for review.
          You may be contacted at {form.submitter_email} if clarification is needed.
        </p>
        <button
          onClick={() => { setSubmitted(false); setForm(EMPTY); setStep(0); setDuplicateResult(null) }}
          className="bg-cyan-700 hover:bg-cyan-600 text-white text-sm px-5 py-2 rounded transition-colors"
        >
          Submit another
        </button>
      </div>
    )
  }

  // ── Step progress bar ─────────────────────────────────────────────────────

  const StepBar = () => (
    <div className="flex items-center gap-1 mb-6">
      {STEPS.map((s, i) => (
        <React.Fragment key={s}>
          <div className={`flex items-center gap-1.5 ${i <= step ? 'text-cyan-400' : 'text-slate-600'}`}>
            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold border ${
              i < step ? 'bg-cyan-700 border-cyan-600 text-white'
              : i === step ? 'border-cyan-500 text-cyan-400'
              : 'border-slate-700 text-slate-600'
            }`}>{i < step ? '✓' : i + 1}</div>
            <span className={`text-xs hidden sm:block ${i === step ? 'text-cyan-400 font-medium' : ''}`}>{s}</span>
          </div>
          {i < STEPS.length - 1 && <div className={`flex-1 h-px ${i < step ? 'bg-cyan-800' : 'bg-[#1e3a5f]'}`} />}
        </React.Fragment>
      ))}
    </div>
  )

  // ── Step content ──────────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <StepBar />

      {/* Step 0: Contact */}
      {step === 0 && (
        <div className="space-y-4">
          <SectionHeader step={1} title="Your contact details"
            subtitle="Required for follow-up. Not published — stored internally only." />
          <Input label="Full name" required value={form.submitter_name} onChange={set('submitter_name')} />
          <Input label="Email address" required type="email" value={form.submitter_email} onChange={set('submitter_email')} />
          <Input label="Organisation" value={form.submitter_organization} onChange={set('submitter_organization')} />
        </div>
      )}

      {/* Step 1: Programme basics + duplicate check */}
      {step === 1 && (
        <div className="space-y-4">
          <SectionHeader step={2} title="Programme basics"
            subtitle="Enter core identity information. We will check for potential duplicates." />
          <Input label="Programme name" required value={form.programme_name} onChange={set('programme_name')} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Country (plain text)" value={form.country_raw} onChange={set('country_raw')} placeholder="e.g. Denmark" />
            <Input label="ISO-3 country code" value={form.country_iso} onChange={v => set('country_iso')(v.toUpperCase())} placeholder="e.g. DNK" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Start date" type="date" value={form.start_date} onChange={set('start_date')} />
            <Input label="End date (if ended)" type="date" value={form.end_date} onChange={set('end_date')} />
          </div>
          <TriToggle label="Currently active?" value={form.is_active} onChange={set('is_active')} />
          <Input label="Reference year" type="number" value={form.reference_year} onChange={set('reference_year')} placeholder="Year the data was current" />

          {/* Duplicate detection — fires once name is 4+ chars */}
          {form.programme_name.length >= 4 && (
            <DuplicateCheck
              programmeName={form.programme_name}
              country={form.country_iso || null}
              gearTypes={form.gear_types}
              startYear={form.start_date ? new Date(form.start_date).getFullYear() : null}
              onResult={setDuplicateResult}
            />
          )}
        </div>
      )}

      {/* Step 2: Fleet & gear */}
      {step === 2 && (
        <div className="space-y-4">
          <SectionHeader step={3} title="Fleet & gear" />
          <MultiCheckbox label="Gear types" options={GEAR_OPTIONS} value={form.gear_types} onChange={set('gear_types')} />
          <MultiCheckbox label="Programme type" options={PROGRAMME_TYPE_OPTIONS} value={form.programme_type} onChange={set('programme_type')} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Fleet size (total vessels)" value={form.fleet_size_total} onChange={set('fleet_size_total')} placeholder="e.g. 120 or 50–80" />
            <Input label="Vessels with EM installed" type="number" value={form.fleet_size_em} onChange={set('fleet_size_em')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Vessel size range (fleet)" value={form.vessel_size_range} onChange={set('vessel_size_range')} placeholder="e.g. 10–24m" />
            <Input label="Vessel size range (EM)" value={form.vessel_size_em} onChange={set('vessel_size_em')} />
          </div>
          <Input label="Flag states" value={form.flag_states} onChange={set('flag_states')} />
          <Input label="Areas of operation" value={form.areas_of_operation} onChange={set('areas_of_operation')} placeholder="e.g. ICES 7e, North Sea" />
          <Input label="Average trip duration" value={form.trip_duration} onChange={set('trip_duration')} />
          <Textarea label="Target species" value={form.target_species} onChange={set('target_species')} rows={2} />
          <Textarea label="Bycatch species" value={form.bycatch_species} onChange={set('bycatch_species')} rows={2} />
          <Input label="Organisations involved" value={form.organizations} onChange={set('organizations')} />
          <Input label="Primary contact (name & email)" value={form.primary_contact} onChange={set('primary_contact')} />
          <Input label="Web links" value={form.web_links} onChange={set('web_links')} placeholder="https://…" />
        </div>
      )}

      {/* Step 3: EM configuration */}
      {step === 3 && (
        <div className="space-y-4">
          <SectionHeader step={4} title="EM configuration" />
          <Select label="EM regulation status" options={EM_REGULATION_OPTIONS} value={form.em_regulation} onChange={set('em_regulation')} />
          <Textarea label="Programme objectives" value={form.objectives} onChange={set('objectives')} rows={3} />
          <TriToggle label="Full REM — all vessels in fishery have EM installed?" value={form.full_rem_coverage} onChange={set('full_rem_coverage')} />
          <Select label="Supplier model" options={SUPPLIER_MODEL_OPTIONS} value={form.supplier_model} onChange={set('supplier_model')} />
          <Input label="Hardware provider" value={form.hardware_provider} onChange={set('hardware_provider')} />
          <Input label="Who procures the systems?" value={form.procurement_entity} onChange={set('procurement_entity')} />
          <Select label="Review model" options={REVIEW_MODEL_OPTIONS} value={form.review_model} onChange={set('review_model')} />
          <Input label="Primary data transmission method" value={form.data_transmission_primary} onChange={set('data_transmission_primary')} placeholder="e.g. Physical receipt, Remote upload" />
          <Input label="Secondary data transmission" value={form.data_transmission_secondary} onChange={set('data_transmission_secondary')} />
          <Input label="Processed data submission method" value={form.processed_data_submission} onChange={set('processed_data_submission')} />
          <TriToggle label="DCF multiannual programme?" value={form.dcf_programme} onChange={set('dcf_programme')} />
        </div>
      )}

      {/* Step 4: Data collection */}
      {step === 4 && (
        <div className="space-y-4">
          <SectionHeader step={5} title="Data collection" />

          <div className="p-3 rounded border border-[#1e3a5f] space-y-3">
            <div className="text-xs font-semibold text-slate-300">Video & imagery</div>
            <TriToggle label="Collects video?" value={form.collects_video} onChange={set('collects_video')} />
            <TriToggle label="Collects still images?" value={form.collects_images} onChange={set('collects_images')} />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Cameras per vessel (min)" type="number" value={form.cameras_per_vessel_min} onChange={set('cameras_per_vessel_min')} />
              <Input label="Cameras per vessel (max)" type="number" value={form.cameras_per_vessel_max} onChange={set('cameras_per_vessel_max')} />
            </div>
            <Input label="Video transmission frequency" value={form.video_transmission_frequency} onChange={set('video_transmission_frequency')} />
            <Input label="Recording configuration" value={form.recording_config} onChange={set('recording_config')} />
            <Input label="Video recording type" value={form.video_recording_type} onChange={set('video_recording_type')} placeholder="e.g. Continuous, Event-triggered" />
            <Select label="Video/image selection method" options={VIDEO_SELECTION_OPTIONS} value={form.video_selection_method} onChange={set('video_selection_method')} />
            <Textarea label="Quality thresholds" value={form.quality_thresholds} onChange={set('quality_thresholds')} rows={2} />
            <TriToggle label="Used for commercial catch monitoring?" value={form.video_used_for_commercial_catch} onChange={set('video_used_for_commercial_catch')} />
          </div>

          <div className="p-3 rounded border border-[#1e3a5f] space-y-3">
            <div className="text-xs font-semibold text-slate-300">Sensors</div>
            <TriToggle label="Additional sensor data collected?" value={form.additional_sensors} onChange={set('additional_sensors')} />
            <Input label="Sensor types" value={form.sensor_types} onChange={set('sensor_types')} />
            <Input label="Sensor transmission frequency" value={form.sensor_transmission_frequency} onChange={set('sensor_transmission_frequency')} />
          </div>

          <div className="p-3 rounded border border-[#1e3a5f] space-y-3">
            <div className="text-xs font-semibold text-slate-300">Sampling</div>
            <Input label="Programme monitoring focus" value={form.programme_monitoring} onChange={set('programme_monitoring')} />
            <Textarea label="Review objectives" value={form.review_objectives} onChange={set('review_objectives')} rows={2} />
            <div className="grid grid-cols-2 gap-3">
              <Select label="Primary sampling unit" options={SAMPLING_UNIT_OPTIONS} value={form.sampling_unit_primary} onChange={set('sampling_unit_primary')} />
              <Input label="Coverage (%)" value={form.sampling_coverage_primary} onChange={set('sampling_coverage_primary')} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Select label="Secondary sampling unit" options={SAMPLING_UNIT_OPTIONS} value={form.sampling_unit_secondary} onChange={set('sampling_unit_secondary')} />
              <Input label="Coverage (%)" value={form.sampling_coverage_secondary} onChange={set('sampling_coverage_secondary')} />
            </div>
            <Input label="Catch observation stage" value={form.catch_observation_stage} onChange={set('catch_observation_stage')} placeholder="e.g. Pre-sorting, Sorting, Sorted" />
            <Input label="Species ID resolution" value={form.species_id_resolution} onChange={set('species_id_resolution')} />
            <Input label="Length measurements" value={form.length_measurements} onChange={set('length_measurements')} />
            <Textarea label="Technical challenges" value={form.technical_challenges} onChange={set('technical_challenges')} rows={2} />
            <Input label="Primary reviewer" value={form.primary_reviewer} onChange={set('primary_reviewer')} placeholder="e.g. Science agency, Third party" />
          </div>
        </div>
      )}

      {/* Step 5: Data use & AI */}
      {step === 5 && (
        <div className="space-y-4">
          <SectionHeader step={6} title="Data use & AI" />

          <div className="p-3 rounded border border-[#1e3a5f] space-y-3">
            <div className="text-xs font-semibold text-slate-300">Data governance</div>
            <Textarea label="Current uses of data" value={form.data_uses} onChange={set('data_uses')} rows={2} />
            <TriToggle label="Used in stock assessments?" value={form.used_in_stock_assessment} onChange={set('used_in_stock_assessment')} />
            <Input label="Data owner" value={form.data_owner} onChange={set('data_owner')} />
            <Textarea label="Data sharing agreements" value={form.data_sharing_agreements} onChange={set('data_sharing_agreements')} rows={2} />
            <Input label="Data storage location" value={form.data_storage_location} onChange={set('data_storage_location')} />
            <Input label="Retention limit" value={form.data_retention_limit} onChange={set('data_retention_limit')} />
          </div>

          <div className="p-3 rounded border border-[#1e3a5f] space-y-3">
            <div className="text-xs font-semibold text-slate-300">AI components</div>
            <TriToggle label="AI being developed or used?" value={form.ai_in_development} onChange={set('ai_in_development')} />
            {form.ai_in_development && (
              <>
                <TriToggle label="Video/imagery retained for AI?" value={form.ai_video_retained} onChange={set('ai_video_retained')} />
                <Textarea label="AI applications" value={form.ai_applications} onChange={set('ai_applications')} rows={2} />
                <Input label="Image subjects" value={form.ai_image_subjects} onChange={set('ai_image_subjects')} />
                <Input label="AI developer / provider" value={form.ai_developer} onChange={set('ai_developer')} />
                <Input label="Training data size" value={form.ai_training_data_size} onChange={set('ai_training_data_size')} placeholder="e.g. 50,000 images" />
                <Input label="Stage AI is applied to" value={form.ai_review_stage} onChange={set('ai_review_stage')} />
                <Input label="Assets available?" value={form.ai_assets_available} onChange={set('ai_assets_available')} placeholder="Yes / No / Upon request" />
              </>
            )}
          </div>

          <Textarea label="Additional notes" value={form.additional_notes} onChange={set('additional_notes')} rows={3} />
        </div>
      )}

      {/* Step 6: Review & submit */}
      {step === 6 && (
        <div className="space-y-4">
          <SectionHeader step={7} title="Review & submit"
            subtitle="Review your submission details, then submit for admin review." />

          <div className="p-4 rounded border border-[#1e3a5f] space-y-1 text-xs">
            <div className="grid grid-cols-[140px_1fr] gap-y-1.5">
              <span className="text-slate-500">Submitter</span>
              <span className="text-slate-200">{form.submitter_name} · {form.submitter_email}</span>
              <span className="text-slate-500">Programme</span>
              <span className="text-slate-200">{form.programme_name}</span>
              <span className="text-slate-500">Country</span>
              <span className="text-slate-200">{form.country_raw || form.country_iso || '—'}</span>
              <span className="text-slate-500">Regulation</span>
              <span className="text-slate-200">{form.em_regulation || '—'}</span>
              <span className="text-slate-500">Gear types</span>
              <span className="text-slate-200">{form.gear_types.join(', ') || '—'}</span>
              <span className="text-slate-500">Submission type</span>
              <span className={duplicateResult === 'new' || duplicateResult === null ? 'text-green-400' : 'text-yellow-400'}>
                {duplicateResult === 'new' || duplicateResult === null
                  ? 'New programme'
                  : `Update to: ${duplicateResult.name}`}
              </span>
            </div>
          </div>

          <p className="text-xs text-slate-400">
            Your submission will be reviewed by the GlobalEM team before being published.
            You may be contacted at <span className="text-slate-200">{form.submitter_email}</span> if clarification is needed.
          </p>

          {error && (
            <div className="p-3 rounded border border-red-800 bg-red-900/20 text-xs text-red-300">
              {error}
            </div>
          )}
        </div>
      )}

      {/* ── Navigation ── */}
      <div className="flex justify-between mt-8 pt-4 border-t border-[#1e3a5f]">
        <button
          onClick={() => setStep(s => s - 1)}
          disabled={step === 0}
          className="text-sm text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          ← Back
        </button>

        {step < STEPS.length - 1 ? (
          <button
            onClick={() => setStep(s => s + 1)}
            disabled={!canProceed}
            className="bg-cyan-700 hover:bg-cyan-600 disabled:bg-slate-700 disabled:cursor-not-allowed text-white text-sm px-5 py-2 rounded transition-colors"
          >
            Continue →
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="bg-green-700 hover:bg-green-600 disabled:bg-slate-700 disabled:cursor-not-allowed text-white text-sm px-6 py-2 rounded transition-colors"
          >
            {submitting ? 'Submitting…' : 'Submit programme'}
          </button>
        )}
      </div>
    </div>
  )
}
