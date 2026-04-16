import React from 'react'

const REGULATION_BADGE = {
  'Under Regulation - Mandatory':  'bg-red-900/40 text-red-300 border-red-800',
  'Under Regulation - Optional':   'bg-yellow-900/40 text-yellow-300 border-yellow-800',
  'Non-Regulation - Voluntary':    'bg-green-900/40 text-green-300 border-green-800',
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Section({ title, children }) {
  const hasContent = React.Children.toArray(children).some(c => c !== null && c !== false)
  if (!hasContent) return null
  return (
    <div className="mt-4">
      <h3 className="text-xs font-semibold text-cyan-500 uppercase tracking-wider mb-2">{title}</h3>
      <dl className="space-y-1.5">{children}</dl>
    </div>
  )
}

function Field({ label, value }) {
  if (value === null || value === undefined || value === '') return null
  if (Array.isArray(value) && value.length === 0) return null

  let display
  if (typeof value === 'boolean') display = value ? 'Yes' : 'No'
  else if (Array.isArray(value)) display = value.join(', ')
  else if (value instanceof Date) display = value.toLocaleDateString()
  else display = String(value)

  if (!display.trim()) return null

  return (
    <div className="grid gap-x-3 text-xs" style={{ gridTemplateColumns: '130px 1fr' }}>
      <dt className="text-slate-500 pt-0.5">{label}</dt>
      <dd className="text-slate-200 break-words leading-snug">{display}</dd>
    </div>
  )
}

function Badge({ children, className = '' }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded border ${className}`}>{children}</span>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ProgramDetail({ program: p, onClose }) {
  return (
    <div className="h-full flex flex-col">

      {/* ── Header ── */}
      <div className="flex-shrink-0 px-4 pt-4 pb-3 border-b border-[#1e3a5f]">
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-sm font-semibold text-white leading-snug">{p.programme_name}</h2>
          <button
            onClick={onClose}
            className="flex-shrink-0 text-slate-400 hover:text-white text-xl leading-none mt-0.5 transition-colors"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-2">
          <Badge className={p.is_active
            ? 'bg-green-900/40 text-green-300 border-green-800'
            : 'bg-slate-700/30 text-slate-400 border-slate-700'
          }>
            {p.is_active ? 'Active' : 'Inactive'}
          </Badge>

          {p.em_regulation && (
            <Badge className={REGULATION_BADGE[p.em_regulation] ?? 'bg-slate-700/30 text-slate-400 border-slate-700'}>
              {p.em_regulation.replace('Under Regulation - ', '').replace('Non-Regulation - ', '')}
            </Badge>
          )}
          {p.collects_video && (
            <Badge className="bg-blue-900/40 text-blue-300 border-blue-800">Video</Badge>
          )}
          {p.collects_images && (
            <Badge className="bg-indigo-900/40 text-indigo-300 border-indigo-800">Images</Badge>
          )}
          {p.ai_in_development && (
            <Badge className="bg-purple-900/40 text-purple-300 border-purple-800">AI</Badge>
          )}
          {p.dcf_programme && (
            <Badge className="bg-slate-700/40 text-slate-300 border-slate-600">DCF</Badge>
          )}
        </div>
      </div>

      {/* ── Scrollable body ── */}
      <div className="flex-1 overflow-y-auto px-4 pb-6">

        <Section title="Programme identity">
          <Field label="Country"        value={p.country_iso} />
          <Field label="Start date"     value={p.start_date} />
          <Field label="End date"       value={p.end_date} />
          <Field label="Reference year" value={p.reference_year} />
          <Field label="Organizations"  value={p.organizations} />
          {p.web_links && (
            <div className="grid gap-x-3 text-xs" style={{ gridTemplateColumns: '130px 1fr' }}>
              <dt className="text-slate-500 pt-0.5">Web links</dt>
              <dd>
                {p.web_links.split(/\s+/).filter(Boolean).map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                    className="block text-cyan-400 hover:text-cyan-300 underline break-all leading-snug"
                  >
                    {url}
                  </a>
                ))}
              </dd>
            </div>
          )}
        </Section>

        <Section title="Fleet & gear">
          <Field label="Fleet size (total)"  value={p.fleet_size_total} />
          <Field label="Vessels with EM"     value={p.fleet_size_em} />
          <Field label="Vessel size range"   value={p.vessel_size_range} />
          <Field label="EM vessel size"      value={p.vessel_size_em} />
          <Field label="Gear types"          value={p.gear_types} />
          <Field label="Flag states"         value={p.flag_states} />
          <Field label="Areas"               value={p.areas_of_operation} />
          <Field label="Trip duration"       value={p.trip_duration} />
          <Field label="Target species"      value={p.target_species} />
          <Field label="Bycatch species"     value={p.bycatch_species} />
        </Section>

        <Section title="Programme structure">
          <Field label="Type"              value={p.programme_type} />
          <Field label="Full REM"          value={p.full_rem_coverage} />
          <Field label="Supplier model"    value={p.supplier_model} />
          <Field label="Hardware provider" value={p.hardware_provider} />
          <Field label="Procurement"       value={p.procurement_entity} />
          <Field label="Review model"      value={p.review_model} />
          <Field label="Transmission"      value={p.data_transmission_primary} />
          <Field label="2nd transmission"  value={p.data_transmission_secondary} />
          <Field label="Processed data"    value={p.processed_data_submission} />
          <Field label="DCF programme"     value={p.dcf_programme} />
        </Section>

        <Section title="Data collection — video & imagery">
          <Field label="Collects video"    value={p.collects_video} />
          <Field label="Collects images"   value={p.collects_images} />
          <Field label="Cameras / vessel"  value={
            p.cameras_per_vessel_min != null
              ? (p.cameras_per_vessel_max && p.cameras_per_vessel_max !== p.cameras_per_vessel_min
                  ? `${p.cameras_per_vessel_min}–${p.cameras_per_vessel_max}`
                  : String(p.cameras_per_vessel_min))
              : null
          } />
          <Field label="Video frequency"   value={p.video_transmission_frequency} />
          <Field label="Recording config"  value={p.recording_config} />
          <Field label="Video type"        value={p.video_recording_type} />
          <Field label="Video selection"   value={p.video_selection_method} />
          <Field label="Quality threshold" value={p.quality_thresholds} />
          <Field label="Used for catch"    value={p.video_used_for_commercial_catch} />
        </Section>

        <Section title="Data collection — sensors">
          <Field label="Add. sensors"      value={p.additional_sensors} />
          <Field label="Sensor types"      value={p.sensor_types} />
          <Field label="Sensor frequency"  value={p.sensor_transmission_frequency} />
        </Section>

        <Section title="Sampling">
          <Field label="Monitoring focus"  value={p.programme_monitoring} />
          <Field label="Review objectives" value={p.review_objectives} />
          <Field label="Primary unit"      value={p.sampling_unit_primary} />
          <Field label="Primary coverage"  value={p.sampling_coverage_primary} />
          <Field label="Secondary unit"    value={p.sampling_unit_secondary} />
          <Field label="Secondary cover."  value={p.sampling_coverage_secondary} />
          <Field label="Tertiary unit"     value={p.sampling_unit_tertiary} />
          <Field label="Tertiary cover."   value={p.sampling_coverage_tertiary} />
          <Field label="Catch stage"       value={p.catch_observation_stage} />
          <Field label="Target sampled"    value={p.target_species_sampled} />
          <Field label="Bycatch sampled"   value={p.bycatch_species_sampled} />
          <Field label="Species resolution" value={p.species_id_resolution} />
          <Field label="Lengths"           value={p.length_measurements} />
          <Field label="Sex"               value={p.sex_collected} />
          <Field label="Add. chars."       value={p.additional_characteristics} />
          <Field label="Tech. challenges"  value={p.technical_challenges} />
          <Field label="Primary reviewer"  value={p.primary_reviewer} />
        </Section>

        <Section title="Data use & governance">
          <Field label="Current uses"      value={p.data_uses} />
          <Field label="Stock assessments" value={p.used_in_stock_assessment} />
          <Field label="Data owner"        value={p.data_owner} />
          <Field label="Sharing agreements" value={p.data_sharing_agreements} />
          <Field label="Storage location"  value={p.data_storage_location} />
          <Field label="Retention limit"   value={p.data_retention_limit} />
        </Section>

        {p.ai_in_development && (
          <Section title="AI components">
            <Field label="In development"  value={p.ai_in_development} />
            <Field label="Video retained"  value={p.ai_video_retained} />
            <Field label="Applications"    value={p.ai_applications} />
            <Field label="Image subjects"  value={p.ai_image_subjects} />
            <Field label="Assets available" value={p.ai_assets_available} />
            <Field label="Review stage"    value={p.ai_review_stage} />
            <Field label="Developer"       value={p.ai_developer} />
            <Field label="Training data"   value={p.ai_training_data_size} />
          </Section>
        )}

        {p.objectives && (
          <Section title="Objectives">
            <p className="text-xs text-slate-300 leading-relaxed">{p.objectives}</p>
          </Section>
        )}

        {p.additional_notes && (
          <Section title="Additional notes">
            <p className="text-xs text-slate-300 leading-relaxed">{p.additional_notes}</p>
          </Section>
        )}
      </div>
    </div>
  )
}
