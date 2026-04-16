import React, { useEffect, useRef, useCallback, useState } from 'react'
import maplibregl from 'maplibre-gl'
import { supabase } from '../../lib/supabase'

const BASEMAP_STYLE = 'https://tiles.openfreemap.org/styles/positron'

// ColorBrewer Blues sequential (7 steps) — accessible, print-safe
const BLUES = ['#eff3ff', '#c6dbef', '#9ecae1', '#6baed6', '#4292c6', '#2171b5', '#084594']

// Color for countries with programmes but no vessel count data
const HAS_PROGRAMS_COLOR = '#9ecae1'

function parseVessels(program) {
  // Use only the integer fleet_size_em column — fleet_size_total is free text (ranges, notes)
  // and cannot be reliably parsed for summation.
  return (program.fleet_size_em != null && program.fleet_size_em > 0) ? program.fleet_size_em : 0
}

function buildCountryData(programs) {
  const byCountry = {}
  for (const p of programs) {
    const iso = p.country_iso
    if (!iso) continue
    if (!byCountry[iso]) byCountry[iso] = { programs: [], vessels: 0 }
    byCountry[iso].programs.push(p)
    byCountry[iso].vessels += parseVessels(p)
  }
  return byCountry
}

function vesselColor(vessels, maxVessels) {
  if (!vessels || !maxVessels) return HAS_PROGRAMS_COLOR
  const idx = Math.min(BLUES.length - 1, Math.floor((vessels / maxVessels) * (BLUES.length - 1)))
  return BLUES[idx]
}

function buildColorExpression(countryData, maxVessels) {
  const pairs = []
  for (const [iso, { vessels }] of Object.entries(countryData)) {
    pairs.push(iso, vesselColor(vessels, maxVessels))
  }
  if (pairs.length === 0) return '#e8eaed'
  return ['match', ['get', 'iso3'], ...pairs, '#e8eaed']
}

function countryTooltipHTML(programs) {
  const vessels = programs.reduce((sum, p) => sum + parseVessels(p), 0)
  const names = programs.slice(0, 3).map(p => `<li style="color:#cbd5e1">${p.programme_name}</li>`).join('')
  const more = programs.length > 3 ? `<li style="color:#64748b">+ ${programs.length - 3} more…</li>` : ''
  return `
    <div style="min-width:190px;font-family:sans-serif">
      <div style="font-weight:600;font-size:12px;margin-bottom:6px;color:#f1f5f9">
        ${programs.length} programme${programs.length > 1 ? 's' : ''}${vessels ? ` &middot; ${vessels} EM vessels` : ''}
      </div>
      <ul style="margin:0;padding-left:14px;font-size:11px;line-height:1.6">
        ${names}${more}
      </ul>
      <div style="margin-top:6px;font-size:10.5px;color:#64748b">Click for details</div>
    </div>
  `
}

export default function MapView({ filters, onSelectProgram }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const mapLoadedRef = useRef(false)
  const popupRef = useRef(null)
  const countryDataRef = useRef({})

  const [status, setStatus] = useState('Initialising map…')

  // ── Initialise map ────────────────────────────────────────────────────────
  useEffect(() => {
    if (mapRef.current) return

    setStatus('Loading basemap…')

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: BASEMAP_STYLE,
      center: [0, 20],
      zoom: 1.8,
      minZoom: 1,
    })
    mapRef.current = map

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), 'top-right')
    map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-right')

    popupRef.current = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      maxWidth: '300px',
      offset: 12,
    })

    map.on('error', (e) => {
      console.error('[MapLibre error]', e)
      setStatus(`Map error: ${e.error?.message ?? 'unknown'}`)
    })

    map.on('load', () => {
      mapLoadedRef.current = true
      setStatus('Map loaded — fetching programmes…')

      // Insert country layers below the first symbol (label) layer so labels stay on top
      const firstSymbolId = map.getStyle().layers.find(l => l.type === 'symbol')?.id

      // ── Country fill layers ────────────────────────────────────────────────
      const countriesUrl = `${import.meta.env.BASE_URL}countries.geojson`
      map.addSource('countries', { type: 'geojson', data: countriesUrl })

      map.addLayer({
        id: 'countries-fill',
        type: 'fill',
        source: 'countries',
        paint: { 'fill-color': '#e8eaed', 'fill-opacity': 0.9 },
      }, firstSymbolId)

      map.addLayer({
        id: 'countries-line',
        type: 'line',
        source: 'countries',
        paint: { 'line-color': '#ffffff', 'line-width': 0.5, 'line-opacity': 0.8 },
      }, firstSymbolId)

      map.addLayer({
        id: 'countries-hover',
        type: 'fill',
        source: 'countries',
        paint: { 'fill-color': '#2171b5', 'fill-opacity': 0.25 },
        filter: ['==', ['get', 'iso3'], ''],
      }, firstSymbolId)

      // ── EEZ layer (optional) ───────────────────────────────────────────────
      const eezUrl = `${import.meta.env.BASE_URL}eez_simplified.geojson`
      fetch(eezUrl)
        .then(r => { if (!r.ok) throw new Error('not found'); return r.json() })
        .then(data => {
          map.addSource('eez', { type: 'geojson', data })
          map.addLayer({ id: 'eez-line', type: 'line', source: 'eez',
            paint: { 'line-color': '#0096c7', 'line-width': 0.8, 'line-opacity': 0.5 } }, firstSymbolId)
        })
        .catch(() => console.info('[GlobalEM] No EEZ file — run scripts/prepare_eez.py'))

      // ── Country interaction ────────────────────────────────────────────────
      map.on('mousemove', 'countries-fill', e => {
        if (!e.features?.length) return
        const iso = e.features[0].properties.iso3
        const data = countryDataRef.current[iso]
        if (!data) {
          map.setFilter('countries-hover', ['==', ['get', 'iso3'], ''])
          popupRef.current.remove()
          map.getCanvas().style.cursor = ''
          return
        }
        map.setFilter('countries-hover', ['==', ['get', 'iso3'], iso])
        map.getCanvas().style.cursor = 'pointer'
        popupRef.current.setLngLat(e.lngLat).setHTML(countryTooltipHTML(data.programs)).addTo(map)
      })

      map.on('mouseleave', 'countries-fill', () => {
        map.setFilter('countries-hover', ['==', ['get', 'iso3'], ''])
        popupRef.current.remove()
        map.getCanvas().style.cursor = ''
      })

      map.on('click', 'countries-fill', async e => {
        if (!e.features?.length) return
        const iso = e.features[0].properties.iso3
        const data = countryDataRef.current[iso]
        if (!data?.programs?.length) return
        if (data.programs.length === 1) {
          // Single programme — fetch full record and open detail
          const { data: full, error } = await supabase.from('programs').select('*').eq('id', data.programs[0].id).single()
          if (!error && full) onSelectProgram(full)
        } else {
          // Multiple programmes — pass array; App will show a list
          onSelectProgram(data.programs)
        }
      })
    })

    return () => {
      mapRef.current?.remove()
      mapRef.current = null
      mapLoadedRef.current = false
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load programmes when filters change ───────────────────────────────────
  const loadPrograms = useCallback(async () => {
    setStatus('Fetching programmes…')

    let q = supabase
      .from('programs')
      .select('id, programme_name, country_iso, is_active, em_regulation, gear_types, fleet_size_total, fleet_size_em, programme_type, collects_video, ai_in_development')
      .eq('status', 'approved')

    if (filters.isActive !== null)      q = q.eq('is_active', filters.isActive)
    if (filters.countries?.length)      q = q.in('country_iso', filters.countries)
    if (filters.emRegulation?.length)   q = q.in('em_regulation', filters.emRegulation)
    if (filters.fullRem !== null)       q = q.eq('full_rem_coverage', filters.fullRem)
    if (filters.collectsVideo !== null) q = q.eq('collects_video', filters.collectsVideo)
    if (filters.aiDevelopment !== null) q = q.eq('ai_in_development', filters.aiDevelopment)
    if (filters.dcfProgramme !== null)  q = q.eq('dcf_programme', filters.dcfProgramme)
    if (filters.reviewModel?.length)    q = q.in('review_model', filters.reviewModel)
    if (filters.gearTypes?.length)      q = q.overlaps('gear_types', filters.gearTypes)
    if (filters.programmeTypes?.length) q = q.overlaps('programme_type', filters.programmeTypes)

    const { data, error } = await q

    if (error) {
      console.error('[GlobalEM] Supabase error:', error)
      setStatus(`Supabase error: ${error.message}`)
      return
    }

    const total = data?.length ?? 0
    const byCountry = buildCountryData(data ?? [])
    countryDataRef.current = byCountry

    const countryCount = Object.keys(byCountry).length
    setStatus(`${total} programme${total !== 1 ? 's' : ''} across ${countryCount} countr${countryCount !== 1 ? 'ies' : 'y'}`)

    const maxVessels = Math.max(...Object.values(byCountry).map(d => d.vessels), 1)
    const colorExpr = buildColorExpression(byCountry, maxVessels)

    if (mapRef.current?.getLayer('countries-fill')) {
      mapRef.current.setPaintProperty('countries-fill', 'fill-color', colorExpr)
    }
  }, [filters])

  useEffect(() => {
    if (mapLoadedRef.current) {
      loadPrograms()
    } else {
      const onLoad = () => loadPrograms()
      mapRef.current?.on('load', onLoad)
      return () => mapRef.current?.off('load', onLoad)
    }
  }, [loadPrograms])

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />

      {/* Legend */}
      <div className="absolute bottom-16 right-12 z-10 pointer-events-none">
        <div className="bg-white/95 border border-gray-200 rounded shadow-sm px-3 py-2 text-xs text-gray-600">
          <div className="font-semibold mb-1.5 text-gray-700">EM Vessels</div>
          <div className="flex items-center gap-0.5">
            <span className="mr-1 text-gray-400">fewer</span>
            {BLUES.map((c, i) => (
              <div key={i} style={{ background: c, width: 13, height: 13, borderRadius: 2, border: '1px solid #e5e7eb' }} />
            ))}
            <span className="ml-1 text-gray-400">more</span>
          </div>
        </div>
      </div>

      {/* Status bar */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
        <div className="bg-[#0d1f3c]/90 border border-[#1e3a5f] rounded px-3 py-1 text-xs text-slate-300">
          {status}
        </div>
      </div>
    </div>
  )
}
