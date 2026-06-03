import React, { useEffect, useRef, useCallback, useState } from 'react'
import maplibregl from 'maplibre-gl'
import { fetchPrograms, applyFilters } from '../../lib/programs'

const BASEMAP_STYLE = 'https://tiles.openfreemap.org/styles/positron'

// ColorBrewer Blues sequential (7 steps) — accessible, print-safe
const BLUES = ['#eff3ff', '#c6dbef', '#9ecae1', '#6baed6', '#4292c6', '#2171b5', '#084594']

// Color for countries with programmes but no vessel count data
const HAS_PROGRAMS_COLOR = '#9ecae1'

// Vessel range labels in ascending order — used to bucket aggregated midpoint sums
const VESSEL_RANGE_BUCKETS = [
  { label: '<5',          min: 0,    max: 4    },
  { label: '5–10',        min: 5,    max: 10   },
  { label: '10–20',       min: 10,   max: 20   },
  { label: '20–50',       min: 20,   max: 50   },
  { label: '50–100',      min: 50,   max: 100  },
  { label: '100–200',     min: 100,  max: 200  },
  { label: '200–500',     min: 200,  max: 500  },
  { label: '500–1,000',   min: 500,  max: 1000 },
  { label: '1,000–2,000', min: 1000, max: 2000 },
  { label: '2,000+',      min: 2000, max: null },
]

function vesselRangeLabel(total) {
  if (!total || total <= 0) return null
  const bucket = VESSEL_RANGE_BUCKETS.find(b => b.max == null ? total >= b.min : total <= b.max)
  return bucket?.label ?? '2,000+'
}

function parseVessels(program) {
  if (program.fleet_size_em != null && program.fleet_size_em > 0) return program.fleet_size_em
  // Fall back to fleet_size_total when fleet_size_em is missing — parse plain numbers only,
  // ignore range strings like "100–300" since we can't reliably pick a midpoint
  if (program.fleet_size_total) {
    const n = parseInt(String(program.fleet_size_total).replace(/,/g, ''), 10)
    if (!isNaN(n) && n > 0) return n
  }
  return 0
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
  if (pairs.length === 0) return 'rgba(0,0,0,0)'
  return ['match', ['get', 'iso3'], ...pairs, 'rgba(0,0,0,0)']
}

function buildOutlineExpression(countryData) {
  const isos = Object.keys(countryData)
  if (isos.length === 0) return 'rgba(0,0,0,0)'
  return ['match', ['get', 'iso3'], ...isos.flatMap(iso => [iso, '#4292c6']), 'rgba(0,0,0,0)']
}

function countryTooltipHTML(programs) {
  const totalVessels = programs.reduce((sum, p) => sum + parseVessels(p), 0)
  const rangeLabel = vesselRangeLabel(totalVessels)
  const vesselStr = rangeLabel ? ` &middot; ~${rangeLabel} EM vessels` : ''
  const names = programs.slice(0, 3).map(p => `<li style="color:#cbd5e1">${p.programme_name}</li>`).join('')
  const more = programs.length > 3 ? `<li style="color:#64748b">+ ${programs.length - 3} more…</li>` : ''
  return `
    <div style="min-width:190px;font-family:sans-serif">
      <div style="font-weight:600;font-size:12px;margin-bottom:6px;color:#f1f5f9">
        ${programs.length} programme${programs.length > 1 ? 's' : ''}${vesselStr}
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

      const firstSymbolId = map.getStyle().layers.find(l => l.type === 'symbol')?.id

      // ── Country fill layers ────────────────────────────────────────────────
      const countriesUrl = `${import.meta.env.BASE_URL}countries.geojson`
      map.addSource('countries', { type: 'geojson', data: countriesUrl })

      map.addLayer({
        id: 'countries-fill',
        type: 'fill',
        source: 'countries',
        paint: { 'fill-color': 'rgba(0,0,0,0)', 'fill-opacity': 0.7 },
      }, firstSymbolId)

      map.addLayer({
        id: 'countries-outline',
        type: 'line',
        source: 'countries',
        paint: { 'line-color': 'rgba(0,0,0,0)', 'line-width': 1.5, 'line-opacity': 0.9 },
      }, firstSymbolId)

      map.addLayer({
        id: 'countries-hover',
        type: 'fill',
        source: 'countries',
        paint: { 'fill-color': '#2171b5', 'fill-opacity': 0.2 },
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
          onSelectProgram(data.programs[0])
        } else {
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

    try {
      const all = await fetchPrograms()
      const data = applyFilters(all, filters)

      const total = data.length
      const byCountry = buildCountryData(data)
      countryDataRef.current = byCountry

      const countryCount = Object.keys(byCountry).length
      const totalVessels = data.reduce((sum, p) => sum + parseVessels(p), 0)
      const vesselLabel  = totalVessels > 0 ? ` · ~${vesselRangeLabel(totalVessels) ?? totalVessels.toLocaleString()} EM vessels` : ''
      setStatus(`${total} programme${total !== 1 ? 's' : ''} across ${countryCount} countr${countryCount !== 1 ? 'ies' : 'y'}${vesselLabel}`)

      const maxVessels = Math.max(...Object.values(byCountry).map(d => d.vessels), 1)
      const colorExpr = buildColorExpression(byCountry, maxVessels)
      const outlineExpr = buildOutlineExpression(byCountry)

      if (mapRef.current?.getLayer('countries-fill')) {
        mapRef.current.setPaintProperty('countries-fill', 'fill-color', colorExpr)
      }
      if (mapRef.current?.getLayer('countries-outline')) {
        mapRef.current.setPaintProperty('countries-outline', 'line-color', outlineExpr)
      }
    } catch (err) {
      console.error('[GlobalEM] Failed to load programmes:', err)
      setStatus(`Error loading programmes: ${err.message}`)
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
