'use client'

import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus,
  Minus,
  Search,
  Trash2,
  Printer,
  ArrowLeft,
  X,
  Pill,
  ClipboardList,
  RotateCcw,
  ChevronRight,
  Crosshair,
  Check,
  AlertCircle,
  FileSpreadsheet,
  LayoutGrid,
  UserPlus,
} from 'lucide-react'
import { toast } from 'sonner'

/* ----------------------------------------------------------------
   Pre-loaded ward inventory (24 items)
----------------------------------------------------------------- */
const INVENTORY: string[] = [
  'Tegretol 200mg Tab',
  'Phenytoin 250mg amp',
  'Haloperidol 10mg amp',
  'Heparin vial',
  'Clexane syringe 4000 IU',
  'Clexane syringe 6000 IU',
  'Decadrone 8mg Amp',
  'B1 amp',
  'KCl 15% amp',
  'Calcium amp',
  'Plasil 10mg Amp',
  'Lasix 20mg Amp',
  'Zofran ampoule 8mg',
  'Omeprazole 40mg vial',
  'Acupan amp',
  'Paracetamol 1g vial',
  'Azithromycin 500mg tab',
  'Methoprim 480mg Tab',
  'Fluconazole 150mg cap',
  'Voriconazole 200mg tab',
  'Ciprodar 200mg vial',
  'Flagyl 500mg Vial',
  'Vancomycin 1g vial',
  'Ceftriaxone 1g vial',
]

const MAX_PATIENTS = 50

interface DrugEntry {
  index: number
  quantity: number
}

interface Patient {
  id: string
  name: string
  drugs: DrugEntry[]
  createdAt: number
}

/* ----------------------------------------------------------------
   Small helper - highlight the matched portion of a drug name
----------------------------------------------------------------- */
function highlightMatch(name: string, query: string) {
  const q = query.trim().toLowerCase()
  if (!q) return name
  const idx = name.toLowerCase().indexOf(q)
  if (idx === -1) return name
  return (
    <>
      {name.slice(0, idx)}
      <mark className="bg-amber-200 text-emerald-900 rounded px-0.5 font-semibold">
        {name.slice(idx, idx + q.length)}
      </mark>
      {name.slice(idx + q.length)}
    </>
  )
}

export default function Home() {
  const [phase, setPhase] = useState<'entry' | 'matrix'>('entry')
  const [patients, setPatients] = useState<Patient[]>([])
  const [currentName, setCurrentName] = useState('')
  const [currentDrugs, setCurrentDrugs] = useState<DrugEntry[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)

  const nameRef = useRef<HTMLInputElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const suggestionsWrapRef = useRef<HTMLDivElement>(null)

  /* ----------------------------- suggestions ----------------------------- */
  /* First-letter / prefix autocomplete: filters inventory by the start of
     the drug name (case-insensitive). Typing "P" yields Phenytoin, Plasil,
     Paracetamol — exactly the ward-sheet fast filter workflow. */
  const suggestions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return INVENTORY.map((name, index) => ({ name, index }))
    return INVENTORY
      .map((name, index) => ({ name, index }))
      .filter((s) => s.name.toLowerCase().startsWith(q))
  }, [searchQuery])

  /* ----------------------------- drug actions ----------------------------- */
  const addDrug = useCallback((index: number) => {
    setCurrentDrugs((prev) => {
      const existing = prev.find((d) => d.index === index)
      if (existing) {
        return prev.map((d) =>
          d.index === index ? { ...d, quantity: d.quantity + 1 } : d,
        )
      }
      return [...prev, { index, quantity: 1 }]
    })
    setSearchQuery('')
    setShowSuggestions(false)
    setActiveIndex(-1)
    toast.success(`${INVENTORY[index]} added`, { duration: 1400 })
  }, [])

  const updateQuantity = (index: number, delta: number) => {
    setCurrentDrugs((prev) =>
      prev
        .map((d) =>
          d.index === index ? { ...d, quantity: d.quantity + delta } : d,
        )
        .filter((d) => d.quantity > 0),
    )
  }

  const setQuantity = (index: number, value: number) => {
    if (Number.isNaN(value) || value < 0) return
    setCurrentDrugs((prev) =>
      prev
        .map((d) => (d.index === index ? { ...d, quantity: value } : d))
        .filter((d) => d.quantity > 0),
    )
  }

  const removeDrug = (index: number) => {
    setCurrentDrugs((prev) => prev.filter((d) => d.index !== index))
  }

  /* ----------------------------- save & next ----------------------------- */
  const saveAndNext = () => {
    if (!currentName.trim()) {
      toast.error('Please enter the patient name', {
        description: 'Tap the name field at the top.',
      })
      nameRef.current?.focus()
      return
    }
    if (currentDrugs.length === 0) {
      toast.error('Add at least one drug before saving', {
        description: 'Search a drug by its first letter, e.g. "P".',
      })
      searchRef.current?.focus()
      return
    }
    if (patients.length >= MAX_PATIENTS) {
      toast.error(`Ward limit reached (${MAX_PATIENTS} patients)`)
      return
    }
    const patient: Patient = {
      id:
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `p-${Date.now()}`,
      name: currentName.trim(),
      drugs: currentDrugs,
      createdAt: Date.now(),
    }
    setPatients((prev) => [...prev, patient])
    setCurrentName('')
    setCurrentDrugs([])
    setSearchQuery('')
    setShowSuggestions(false)
    toast.success(`Patient ${patients.length + 1} saved`, {
      description: `${patient.drugs.length} drug(s) recorded.`,
    })
    setTimeout(() => nameRef.current?.focus(), 50)
  }

  /* ----------------------------- finish round ----------------------------- */
  const finishRound = () => {
    let savedCount = patients.length
    // commit any unsaved entry first
    if (currentName.trim() && currentDrugs.length > 0) {
      const patient: Patient = {
        id:
          typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : `p-${Date.now()}`,
        name: currentName.trim(),
        drugs: currentDrugs,
        createdAt: Date.now(),
      }
      setPatients((prev) => [...prev, patient])
      setCurrentName('')
      setCurrentDrugs([])
      savedCount += 1
    }
    if (savedCount === 0) {
      toast.error('No patients recorded yet', {
        description: 'Add at least one patient to generate the chart.',
      })
      return
    }
    setPhase('matrix')
    toast.success('Ward round chart generated', {
      description: `${savedCount} patient(s) compiled.`,
    })
  }

  const backToForm = () => {
    setPhase('entry')
    setTimeout(() => nameRef.current?.focus(), 120)
  }

  const resetAll = () => {
    setPatients([])
    setCurrentName('')
    setCurrentDrugs([])
    setSearchQuery('')
    setShowSuggestions(false)
    setPhase('entry')
    toast.success('All records cleared')
  }

  const handlePrint = () => {
    window.print()
  }

  /* ----------------------------- keyboard nav ----------------------------- */
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      if (suggestions.length === 0) return
      e.preventDefault()
      setShowSuggestions(true)
      setActiveIndex((prev) =>
        prev < 0 ? 0 : (prev + 1) % suggestions.length,
      )
    } else if (e.key === 'ArrowUp') {
      if (suggestions.length === 0) return
      e.preventDefault()
      setActiveIndex((prev) =>
        prev <= 0 ? suggestions.length - 1 : prev - 1,
      )
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (suggestions.length > 0) {
        const idx = activeIndex >= 0 ? activeIndex : 0
        addDrug(suggestions[idx].index)
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false)
      setActiveIndex(-1)
    }
  }

  /* close suggestions when clicking outside */
  useEffect(() => {
    if (!showSuggestions) return
    const handler = (e: MouseEvent) => {
      if (
        suggestionsWrapRef.current &&
        !suggestionsWrapRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false)
        setActiveIndex(-1)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showSuggestions])

  /* ----------------------------- matrix totals ----------------------------- */
  const totals = useMemo(() => {
    const t = new Array(INVENTORY.length).fill(0)
    patients.forEach((p) => {
      p.drugs.forEach((d) => {
        if (d.index >= 0 && d.index < INVENTORY.length) t[d.index] += d.quantity
      })
    })
    return t
  }, [patients])

  const grandTotal = totals.reduce((a, b) => a + b, 0)
  const distinctDrugsUsed = totals.filter((n) => n > 0).length

  /* quantity lookup for a given patient x drug */
  const qtyFor = (patient: Patient, drugIndex: number) =>
    patient.drugs.find((d) => d.index === drugIndex)?.quantity ?? 0

  const progressPct = Math.min(
    100,
    Math.round((patients.length / MAX_PATIENTS) * 100),
  )

  /* ============================================================== */
  /*                            RENDER                                */
  /* ============================================================== */
  return (
    <div
      className="flex h-[100dvh] flex-col bg-slate-100"
      data-phase={phase}
    >
      {/* ============================ HEADER ============================ */}
      <header className="no-print sticky top-0 z-30 shrink-0 border-b border-emerald-800/30 bg-gradient-to-r from-emerald-700 to-teal-600 text-white shadow-lg">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25 backdrop-blur">
              <Pill className="h-5 w-5" />
            </div>
            <div className="leading-tight">
              <h1 className="text-base font-bold tracking-tight sm:text-lg">
                PharmRound
              </h1>
              <p className="text-[11px] text-emerald-50/90 sm:text-xs">
                Clinical Ward Round Pharmacy
              </p>
            </div>
          </div>

          {phase === 'entry' ? (
            <div className="flex items-center gap-2">
              <div className="flex flex-col items-end">
                <span className="text-[10px] uppercase tracking-wider text-emerald-50/80">
                  Patients Added
                </span>
                <span className="font-mono text-lg font-bold leading-none sm:text-xl">
                  {patients.length}
                  <span className="text-emerald-200"> / {MAX_PATIENTS}</span>
                </span>
              </div>
              <div className="relative h-11 w-11">
                <svg
                  className="h-11 w-11 -rotate-90"
                  viewBox="0 0 44 44"
                  aria-hidden
                >
                  <circle
                    cx="22"
                    cy="22"
                    r="18"
                    fill="none"
                    stroke="rgba(255,255,255,0.2)"
                    strokeWidth="4"
                  />
                  <circle
                    cx="22"
                    cy="22"
                    r="18"
                    fill="none"
                    stroke="#fff"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray={`${(progressPct / 100) * 113} 113`}
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold">
                  {progressPct}%
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold ring-1 ring-white/25">
              <FileSpreadsheet className="h-4 w-4" />
              Ward Chart
            </div>
          )}
        </div>
      </header>

      {/* ============================ MAIN ============================ */}
      <main className="relative flex-1 overflow-hidden">
        {phase === 'entry' ? (
          <EntryView
            currentName={currentName}
            setCurrentName={setCurrentName}
            currentDrugs={currentDrugs}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            showSuggestions={showSuggestions}
            setShowSuggestions={setShowSuggestions}
            activeIndex={activeIndex}
            suggestions={suggestions}
            addDrug={addDrug}
            updateQuantity={updateQuantity}
            setQuantity={setQuantity}
            removeDrug={removeDrug}
            handleSearchKeyDown={handleSearchKeyDown}
            nameRef={nameRef}
            searchRef={searchRef}
            suggestionsWrapRef={suggestionsWrapRef}
            savedPatients={patients}
          />
        ) : (
          <MatrixView
            patients={patients}
            totals={totals}
            grandTotal={grandTotal}
            distinctDrugsUsed={distinctDrugsUsed}
            qtyFor={qtyFor}
            onBack={backToForm}
            onPrint={handlePrint}
            onReset={resetAll}
          />
        )}
      </main>

      {/* ============================ FOOTER (entry only) ============================ */}
      {phase === 'entry' && (
        <footer className="no-print sticky bottom-0 z-30 shrink-0 border-t border-slate-200 bg-white/95 backdrop-blur shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
          <div className="mx-auto flex w-full max-w-6xl gap-2 px-4 py-3 sm:px-6">
            <button
              onClick={finishRound}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3.5 text-sm font-semibold text-slate-700 transition active:scale-[0.98] hover:bg-slate-50 sm:flex-none sm:px-5"
            >
              <LayoutGrid className="h-4 w-4" />
              <span className="hidden sm:inline">Finish Round &amp; Generate Chart</span>
              <span className="sm:hidden">Finish &amp; Chart</span>
            </button>
            <button
              onClick={saveAndNext}
              className="flex flex-[2] items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3.5 text-sm font-bold text-white shadow-md shadow-emerald-600/30 transition active:scale-[0.98] hover:bg-emerald-700 sm:flex-1"
            >
              <UserPlus className="h-4 w-4" />
              Save &amp; Next Patient
            </button>
          </div>
        </footer>
      )}
    </div>
  )
}

/* ================================================================== */
/*                       PHASE 1 - ENTRY VIEW                          */
/* ================================================================== */
interface EntryViewProps {
  currentName: string
  setCurrentName: (v: string) => void
  currentDrugs: DrugEntry[]
  searchQuery: string
  setSearchQuery: (v: string) => void
  showSuggestions: boolean
  setShowSuggestions: (v: boolean) => void
  activeIndex: number
  suggestions: { name: string; index: number }[]
  addDrug: (index: number) => void
  updateQuantity: (index: number, delta: number) => void
  setQuantity: (index: number, value: number) => void
  removeDrug: (index: number) => void
  handleSearchKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void
  nameRef: React.RefObject<HTMLInputElement | null>
  searchRef: React.RefObject<HTMLInputElement | null>
  suggestionsWrapRef: React.RefObject<HTMLDivElement | null>
  savedPatients: Patient[]
}

function EntryView(props: EntryViewProps) {
  const {
    currentName,
    setCurrentName,
    currentDrugs,
    searchQuery,
    setSearchQuery,
    showSuggestions,
    setShowSuggestions,
    activeIndex,
    suggestions,
    addDrug,
    updateQuantity,
    setQuantity,
    removeDrug,
    handleSearchKeyDown,
    nameRef,
    searchRef,
    suggestionsWrapRef,
    savedPatients,
  } = props

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-6xl px-4 pb-6 pt-4 sm:px-6 sm:pt-6">
        {/* Patient name card */}
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
        >
          <div className="mb-2 flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
              <Crosshair className="h-4 w-4" />
            </span>
            <label
              htmlFor="patient-name"
              className="text-sm font-semibold text-slate-700"
            >
              Patient Name
            </label>
            <span className="ml-auto text-[11px] font-medium text-slate-400">
              Patient {savedPatients.length + 1}
            </span>
          </div>
          <input
            id="patient-name"
            ref={nameRef}
            value={currentName}
            onChange={(e) => setCurrentName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                searchRef.current?.focus()
              }
            }}
            placeholder="e.g.  John Doe  /  Bed 14"
            autoComplete="off"
            className="w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-4 py-4 text-lg font-semibold text-slate-800 outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 sm:text-xl"
          />
        </motion.section>

        {/* Drug search card */}
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.05 }}
          className="relative mt-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:mt-4 sm:p-5"
        >
          <div className="mb-2 flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
              <Search className="h-4 w-4" />
            </span>
            <label
              htmlFor="drug-search"
              className="text-sm font-semibold text-slate-700"
            >
              Smart Drug Search
            </label>
            <span className="ml-auto rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 ring-1 ring-amber-200">
              Type first letter
            </span>
          </div>

          <div
            ref={suggestionsWrapRef}
            className="relative"
          >
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                id="drug-search"
                ref={searchRef}
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setShowSuggestions(true)
                  setActiveIndex(-1)
                }}
                onKeyDown={handleSearchKeyDown}
                onFocus={() => setShowSuggestions(true)}
                placeholder='Type "P" for Paracetamol, Phenytoin, Plasil…'
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                className="w-full rounded-xl border-2 border-slate-200 bg-slate-50 py-3.5 pl-11 pr-11 text-base text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('')
                    setShowSuggestions(false)
                    searchRef.current?.focus()
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Suggestions dropdown */}
            <AnimatePresence>
              {showSuggestions && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="absolute left-0 right-0 top-full z-20 mt-2 max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl ring-1 ring-black/5"
                >
                  {suggestions.length === 0 ? (
                    <div className="flex items-center gap-2 px-4 py-5 text-sm text-slate-500">
                      <AlertCircle className="h-4 w-4 text-amber-500" />
                      No matching drug in ward inventory.
                    </div>
                  ) : (
                    <ul className="py-1">
                      {suggestions.map((s, i) => {
                        const alreadyAdded = currentDrugs.some(
                          (d) => d.index === s.index,
                        )
                        return (
                          <li key={s.index}>
                            <button
                              type="button"
                              onClick={() => addDrug(s.index)}
                              onMouseEnter={() => setActiveIndex(i)}
                              className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition ${
                                activeIndex === i
                                  ? 'bg-emerald-50'
                                  : 'hover:bg-slate-50'
                              }`}
                            >
                              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-emerald-600/10 text-xs font-bold text-emerald-700">
                                {s.name.charAt(0).toUpperCase()}
                              </span>
                              <span className="flex-1 text-slate-800">
                                {highlightMatch(s.name, searchQuery)}
                              </span>
                              {alreadyAdded && (
                                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                                  ADDED
                                </span>
                              )}
                              <Plus className="h-4 w-4 text-emerald-600" />
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* quick-letter chips */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {['P', 'C', 'L', 'V', 'F', 'A', 'H', 'B'].map((ch) => (
              <button
                key={ch}
                type="button"
                onClick={() => {
                  setSearchQuery(ch)
                  setShowSuggestions(true)
                  setActiveIndex(-1)
                  searchRef.current?.focus()
                }}
                className="min-h-9 min-w-9 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-sm font-semibold text-slate-600 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
              >
                {ch}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setSearchQuery('')
                setShowSuggestions(true)
                searchRef.current?.focus()
              }}
              className="min-h-9 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-sm font-semibold text-slate-500 transition hover:bg-slate-100"
            >
              All
            </button>
          </div>
        </motion.section>

        {/* Prescribed list */}
        <section className="mt-3 sm:mt-4">
          <div className="mb-2 flex items-center gap-2 px-1">
            <ClipboardList className="h-4 w-4 text-slate-500" />
            <h2 className="text-sm font-semibold text-slate-700">
              Prescribed for this patient
            </h2>
            <span className="ml-auto rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-700">
              {currentDrugs.length} drug{currentDrugs.length === 1 ? '' : 's'}
            </span>
          </div>

          {currentDrugs.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-white/60 px-4 py-10 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                <Pill className="h-6 w-6 text-slate-400" />
              </div>
              <p className="text-sm font-medium text-slate-500">
                No drugs added yet
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Search a drug above to add it to this patient.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              <AnimatePresence initial={false}>
                {currentDrugs.map((d) => (
                  <motion.li
                    key={d.index}
                    layout
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 12 }}
                    transition={{ duration: 0.18 }}
                    className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-xs font-bold text-white">
                      {INVENTORY[d.index].charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-800">
                        {INVENTORY[d.index]}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Qty prescribed
                      </p>
                    </div>

                    {/* Stepper */}
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => updateQuantity(d.index, -1)}
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600 transition active:scale-90 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600"
                        aria-label="Decrease quantity"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <input
                        value={d.quantity}
                        onChange={(e) =>
                          setQuantity(
                            d.index,
                            parseInt(e.target.value, 10),
                          )
                        }
                        inputMode="numeric"
                        className="h-9 w-12 rounded-lg border border-slate-200 bg-white text-center text-base font-bold text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                      />
                      <button
                        type="button"
                        onClick={() => updateQuantity(d.index, 1)}
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 transition active:scale-90 hover:bg-emerald-100"
                        aria-label="Increase quantity"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeDrug(d.index)}
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-400 transition active:scale-90 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600"
                        aria-label="Remove drug"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
        </section>

        {/* saved patients mini-list */}
        {savedPatients.length > 0 && (
          <section className="mt-5">
            <div className="mb-2 flex items-center gap-2 px-1">
              <Check className="h-4 w-4 text-emerald-600" />
              <h2 className="text-sm font-semibold text-slate-700">
                Saved this round
              </h2>
              <span className="ml-auto text-xs font-medium text-slate-400">
                {savedPatients.length} / {MAX_PATIENTS}
              </span>
            </div>
            <div className="max-h-44 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-sm">
              <ul className="divide-y divide-slate-100">
                {savedPatients.map((p, i) => (
                  <li
                    key={p.id}
                    className="flex items-center gap-3 px-3 py-2.5"
                  >
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-[11px] font-bold text-white">
                      {i + 1}
                    </span>
                    <span className="flex-1 truncate text-sm font-medium text-slate-700">
                      {p.name}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                      {p.drugs.reduce((s, d) => s + d.quantity, 0)} units
                    </span>
                    <ChevronRight className="h-4 w-4 text-slate-300" />
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

/* ================================================================== */
/*                     PHASE 2 - MATRIX VIEW                            */
/* ================================================================== */
interface MatrixViewProps {
  patients: Patient[]
  totals: number[]
  grandTotal: number
  distinctDrugsUsed: number
  qtyFor: (patient: Patient, drugIndex: number) => number
  onBack: () => void
  onPrint: () => void
  onReset: () => void
}

function MatrixView({
  patients,
  totals,
  grandTotal,
  distinctDrugsUsed,
  qtyFor,
  onBack,
  onPrint,
  onReset,
}: MatrixViewProps) {
  const today = useMemo(() => {
    const d = new Date()
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }, [])

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="no-print shrink-0 border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-95"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Form
            </button>
            <div>
              <h2 className="text-sm font-bold text-slate-800 sm:text-base">
                Ward Round Matrix
              </h2>
              <p className="text-[11px] text-slate-400">{today}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onReset}
              className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 active:scale-95"
            >
              <RotateCcw className="h-4 w-4" />
              <span className="hidden sm:inline">Clear All</span>
            </button>
            <button
              onClick={onPrint}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-md shadow-emerald-600/30 transition hover:bg-emerald-700 active:scale-95"
            >
              <Printer className="h-4 w-4" />
              Print / Export PDF
            </button>
          </div>
        </div>

        {/* stats */}
        <div className="mx-auto mt-3 grid w-full max-w-6xl grid-cols-3 gap-2">
          <StatCard
            label="Patients"
            value={String(patients.length)}
            tone="emerald"
          />
          <StatCard
            label="Drugs Used"
            value={`${distinctDrugsUsed}/${INVENTORY.length}`}
            tone="teal"
          />
          <StatCard
            label="Total Units"
            value={String(grandTotal)}
            tone="amber"
          />
        </div>
      </div>

      {/* Matrix scroll area */}
      <div className="min-h-0 flex-1 p-3 sm:p-4">
        <div className="mx-auto h-full w-full max-w-6xl">
          <div className="matrix-wrapper print-area h-full rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="matrix-table">
              <thead>
                <tr>
                  <th className="corner-cell sticky left-0 top-0 z-20 min-w-[120px] text-left text-xs font-bold uppercase tracking-wide">
                    Patient
                  </th>
                  {INVENTORY.map((drug) => (
                    <th
                      key={drug}
                      className="drug-header-cell"
                      title={drug}
                    >
                      {drug}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {patients.map((p, rowIdx) => (
                  <tr key={p.id} className="even:bg-slate-50/60">
                    <th className="patient-name-cell sticky left-0 z-10 min-w-[120px]">
                      <span className="flex items-center gap-2">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-bold text-white">
                          {rowIdx + 1}
                        </span>
                        <span className="truncate text-sm">{p.name}</span>
                      </span>
                    </th>
                    {INVENTORY.map((_, drugIdx) => {
                      const q = qtyFor(p, drugIdx)
                      return (
                        <td
                          key={drugIdx}
                          className={`matrix-cell ${q > 0 ? 'filled' : ''}`}
                        >
                          {q > 0 ? q : ''}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="totals-row">
                  <th className="totals-label-cell sticky left-0 z-20 text-left text-xs font-bold uppercase tracking-wide">
                    Total → Store
                  </th>
                  {totals.map((t, idx) => (
                    <td key={idx} className="matrix-cell">
                      {t > 0 ? t : ''}
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: 'emerald' | 'teal' | 'amber'
}) {
  const tones = {
    emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    teal: 'bg-teal-50 text-teal-700 ring-teal-200',
    amber: 'bg-amber-50 text-amber-700 ring-amber-200',
  }
  return (
    <div
      className={`rounded-lg px-3 py-2 ring-1 ${tones[tone]}`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wider opacity-70">
        {label}
      </p>
      <p className="font-mono text-lg font-bold leading-tight">{value}</p>
    </div>
  )
}
