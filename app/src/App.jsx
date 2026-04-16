import React, { useState, useCallback } from 'react'
import MapView from './components/Map/MapView'
import FilterPanel from './components/Filters/FilterPanel'
import ProgramDetail from './components/Programs/ProgramDetail'
import ProgramList from './components/Programs/ProgramList'
import SubmitForm from './components/Submit/SubmitForm'

export const INITIAL_FILTERS = {
  isActive: null,       // null = all, true, false
  countries: [],        // ISO codes
  gearTypes: [],
  programmeTypes: [],
  emRegulation: [],
  fullRem: null,
  collectsVideo: null,
  aiDevelopment: null,
  dcfProgramme: null,
  reviewModel: [],
}

export default function App() {
  const [activeTab, setActiveTab] = useState('map')
  const [filters, setFilters] = useState(INITIAL_FILTERS)
  const [selectedProgram, setSelectedProgram] = useState(null)
  const [filtersOpen, setFiltersOpen] = useState(true)

  const handleFilterChange = useCallback((key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }, [])

  const clearFilters = useCallback(() => setFilters(INITIAL_FILTERS), [])

  return (
    <div className="h-screen flex flex-col bg-[#0a1628] text-slate-200 overflow-hidden">

      {/* ── Header ── */}
      <header className="flex-shrink-0 bg-[#0d1f3c] border-b border-[#1e3a5f] px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img
            src="https://www.ices.dk/_layouts/15/1033/images/icesimg/iceslogo.png?rev=40"
            alt="ICES"
            className="h-8 w-auto"
          />
          <div>
            <h1 className="text-base font-semibold text-white leading-none">Global EM Dashboard</h1>
            <p className="text-xs text-slate-400 mt-0.5">Electronic Monitoring Programme Inventory</p>
          </div>
        </div>
        <nav className="flex gap-1">
          {[
            { key: 'map', label: 'Map View' },
            { key: 'submit', label: 'Add / Edit Programme' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
                activeTab === key
                  ? 'bg-cyan-700 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-[#1e3a5f]'
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>

      {/* ── Map tab ── */}
      {activeTab === 'map' && (
        <div className="flex-1 flex overflow-hidden">

          {/* Filter sidebar */}
          <div
            className="flex-shrink-0 bg-[#0d1f3c] border-r border-[#1e3a5f] overflow-hidden transition-all duration-200"
            style={{ width: filtersOpen ? '17rem' : 0 }}
          >
            <FilterPanel
              filters={filters}
              onFilterChange={handleFilterChange}
              onClear={clearFilters}
            />
          </div>

          {/* Map */}
          <div className="flex-1 relative min-w-0">
            <button
              onClick={() => setFiltersOpen(f => !f)}
              className="absolute top-3 left-3 z-10 bg-[#0d1f3c] border border-[#1e3a5f] rounded px-2 py-1 text-xs text-slate-300 hover:text-white hover:border-cyan-500 transition-colors"
            >
              {filtersOpen ? '◀ Filters' : '▶ Filters'}
            </button>
            <MapView
              filters={filters}
              onSelectProgram={setSelectedProgram}
            />
          </div>

          {/* Detail panel */}
          {selectedProgram && (
            <div className="flex-shrink-0 w-96 bg-[#0d1f3c] border-l border-[#1e3a5f] overflow-y-auto">
              {Array.isArray(selectedProgram) ? (
                <ProgramList
                  programs={selectedProgram}
                  onSelect={setSelectedProgram}
                  onClose={() => setSelectedProgram(null)}
                />
              ) : (
                <ProgramDetail
                  program={selectedProgram}
                  onClose={() => setSelectedProgram(null)}
                />
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Submit tab ── */}
      {activeTab === 'submit' && (
        <div className="flex-1 overflow-auto">
          <SubmitForm />
        </div>
      )}
    </div>
  )
}
