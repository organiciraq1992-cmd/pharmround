'use client'

import {
  useState,
  useMemo,
  useRef,
  useEffect,
  useCallback,
} from 'react'
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
  ListPlus,
  Package,
  Lock,
  Sparkles,
} from 'lucide-react'
import { toast } from 'sonner'

/* ----------------------------------------------------------------
   Helpers
----------------------------------------------------------------- */
const uid = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`

/* ----------------------------------------------------------------
   Admin / Hospital Inventory (master list — managed by admin)
   Each hospital stocks a fixed set of drugs. Read-only for the
   pharmacist; used as the source pool when building the ward list.
----------------------------------------------------------------- */
interface InventoryDrug {
  id: string
  name: string
}

const INVENTORY: InventoryDrug[] = [
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
].map((name, i) => ({ id: `inv-${i}`, name }))

const MAX_PATIENTS = 50

/* ----------------------------------------------------------------
   Ward Side List (user-curated, per ward)
   The pharmacist builds this from the admin inventory (and can add
   custom drugs) before / during the round. Patient prescriptions
   are drawn from this list so entry stays fast & ward-relevant.
----------------------------------------------------------------- */
interface WardDrug {
  id: string
  name: string
  custom: boolean // true if not from the admin inventory
}

interface PatientDrug {
  drugId: string // references WardDrug.id
  quantity: number
}

interface Patient {
  id: string
  name: string
  drugs: PatientDrug[]
  createdAt: number
}

/* ----------------------------------------------------------------
   Small helper - highlight matched portion of a drug name
----------------------------------------------------------------- */
function highlightMatch(name: string, query: string) {
  const q = query.trim().toLowerCase()
  if (!q) return name
  const idx = name.toLowerCase().indexOf(q)
  if (idx === -1) return name
  return (
    <>
      {name.slice(0, idx)}
      <mark className="rounded bg-amber-200 px-0.5 font-semibold text-emerald-900">
        {name.slice(idx, idx + q.length)}
      </mark>
      {name.slice(idx + q.length)}
    </>
  )
}

/* ================================================================ */
/*                              APP                                  */
/* ================================================================ */
export default function Home() {
  const [phase, setPhase] = useState<'entry' | 'matrix'>('entry')

  // Ward side list (user)
  const [wardDrugs, setWardDrugs] = useState<WardDrug[]>([])
  const [wardDrawerOpen, setWardDrawerOpen] = useState(false)

  // Patients
  const [patients, setPatients] = useState<Patient[]>([])
  const [currentName, setCurrentName] = useState('')
  const [currentDrugs, setCurrentDrugs] = useState<PatientDrug[]>([])

  // Search
  const [searchQuery, setSearchQuery] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)

  const nameRef = useRef<HTMLInputElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const suggestionsWrapRef = useRef<HTMLDivElement>(null)

  /* --------------------------- ward list actions --------------------------- */
  const wardNameSet = useMemo(
    () => new Set(wardDrugs.map((d) => d.name.toLowerCase())),
    [wardDrugs],
  )

  const addToWardFromInventory = useCallback(
    (invId: string) => {
      const inv = INVENTORY.find((i) => i.id === invId)
      if (!inv) return
      setWardDrugs((prev) => {
        if (prev.some((d) => d.name.toLowerCase() === inv.name.toLowerCase()))
          return prev
        return [...prev, { id: uid(), name: inv.name, custom: false }]
      })
    },
    [],
  )

  const addCustomToWard = useCallback((name: string) => {
    const n = name.trim()
    if (!n) return
    setWardDrugs((prev) => {
      if (prev.some((d) => d.name.toLowerCase() === n.toLowerCase())) return prev
      return [...prev, { id: uid(), name: n, custom: true }]
    })
  }, [])

  const addAllInventory = useCallback(() => {
    setWardDrugs((prev) => {
      const existing = new Set(prev.map((d) => d.name.toLowerCase()))
      const toAdd = INVENTORY.filter(
        (i) => !existing.has(i.name.toLowerCase()),
      ).map((i) => ({ id: uid(), name: i.name, custom: false }))
      return [...prev, ...toAdd]
    })
    toast.success('All hospital drugs added to ward list', {
      description: `${INVENTORY.length} items available.`,
    })
  }, [])

  const isWardDrugInUse = useCallback(
    (drugId: string) =>
      patients.some((p) => p.drugs.some((d) => d.drugId === drugId)) ||
      currentDrugs.some((d) => d.drugId === drugId),
    [patients, currentDrugs],
  )

  const removeFromWard = useCallback(
    (drugId: string) => {
      if (isWardDrugInUse(drugId)) {
        toast.error('Cannot remove — drug is prescribed to a patient', {
          description: 'Remove it from all patients first.',
        })
        return
      }
      setWardDrugs((prev) => prev.filter((d) => d.id !== drugId))
    },
    [isWardDrugInUse],
  )

  /* --------------------------- patient drug actions --------------------------- */
  const addDrugToPatient = useCallback(
    (drugId: string) => {
      const wd = wardDrugs.find((d) => d.id === drugId)
      if (!wd) return
      setCurrentDrugs((prev) => {
        const existing = prev.find((d) => d.drugId === drugId)
        if (existing)
          return prev.map((d) =>
            d.drugId === drugId ? { ...d, quantity: d.quantity + 1 } : d,
          )
        return [...prev, { drugId, quantity: 1 }]
      })
      setSearchQuery('')
      setShowSuggestions(false)
      setActiveIndex(-1)
      toast.success(`${wd.name} added`, { duration: 1400 })
    },
    [wardDrugs],
  )

  const quickAddToWardAndPatient = useCallback(
    (name: string) => {
      const n = name.trim()
      if (!n) return
      // add to ward list (avoid dup by name)
      const existing = wardDrugs.find(
        (d) => d.name.toLowerCase() === n.toLowerCase(),
      )
      const drugId = existing ? existing.id : uid()
      if (!existing) {
        setWardDrugs((prev) => [
          ...prev,
          { id: drugId, name: n, custom: true },
        ])
      }
      // add to patient
      setCurrentDrugs((prev) => {
        const ex = prev.find((d) => d.drugId === drugId)
        if (ex)
          return prev.map((d) =>
            d.drugId === drugId ? { ...d, quantity: d.quantity + 1 } : d,
          )
        return [...prev, { drugId, quantity: 1 }]
      })
      setSearchQuery('')
      setShowSuggestions(false)
      setActiveIndex(-1)
      toast.success(`Added "${n}" to ward list & patient`, { duration: 1600 })
    },
    [wardDrugs],
  )

  const updateQuantity = (drugId: string, delta: number) => {
    setCurrentDrugs((prev) =>
      prev
        .map((d) =>
          d.drugId === drugId ? { ...d, quantity: d.quantity + delta } : d,
        )
        .filter((d) => d.quantity > 0),
    )
  }

  const setQuantity = (drugId: string, value: number) => {
    if (Number.isNaN(value) || value < 0) return
    setCurrentDrugs((prev) =>
      prev
        .map((d) =>
          d.drugId === drugId ? { ...d, quantity: value } : d,
        )
        .filter((d) => d.quantity > 0),
    )
  }

  const removeDrug = (drugId: string) => {
    setCurrentDrugs((prev) => prev.filter((d) => d.drugId !== drugId))
  }

  /* --------------------------- save & next --------------------------- */
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
        description: 'Search a drug by its first letter.',
      })
      searchRef.current?.focus()
      return
    }
    if (patients.length >= MAX_PATIENTS) {
      toast.error(`Ward limit reached (${MAX_PATIENTS} patients)`)
      return
    }
    const patient: Patient = {
      id: uid(),
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

  /* --------------------------- finish round --------------------------- */
  const finishRound = () => {
    let savedCount = patients.length
    if (currentName.trim() && currentDrugs.length > 0) {
      const patient: Patient = {
        id: uid(),
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

  const handlePrint = () => window.print()

  /* --------------------------- search keyboard nav --------------------------- */
  const suggestions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return wardDrugs
    return wardDrugs.filter((d) => d.name.toLowerCase().startsWith(q))
  }, [searchQuery, wardDrugs])

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
        addDrugToPatient(suggestions[idx].id)
      } else if (searchQuery.trim()) {
        quickAddToWardAndPatient(searchQuery.trim())
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false)
      setActiveIndex(-1)
    }
  }

  /* close suggestions on outside click */
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

  /* --------------------------- matrix derived data --------------------------- */
  // Only drugs actually used by >=1 patient become columns.
  const usedWardDrugs = useMemo(() => {
    const used = new Set<string>()
    patients.forEach((p) => p.drugs.forEach((d) => used.add(d.drugId)))
    return wardDrugs.filter((d) => used.has(d.id))
  }, [patients, wardDrugs])

  const totals = useMemo(() => {
    const m = new Map<string, number>()
    patients.forEach((p) =>
      p.drugs.forEach((d) =>
        m.set(d.drugId, (m.get(d.drugId) || 0) + d.quantity),
      ),
    )
    return usedWardDrugs.map((d) => m.get(d.id) || 0)
  }, [patients, usedWardDrugs])

  const grandTotal = totals.reduce((a, b) => a + b, 0)

  const qtyFor = (patient: Patient, drugId: string) =>
    patient.drugs.find((d) => d.drugId === drugId)?.quantity ?? 0

  const progressPct = Math.min(
    100,
    Math.round((patients.length / MAX_PATIENTS) * 100),
  )

  /* --------------------------- body scroll lock for drawer --------------------------- */
  useEffect(() => {
    if (wardDrawerOpen) {
      const prev = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = prev
      }
    }
  }, [wardDrawerOpen])

  /* ============================================================== */
  /*                            RENDER                                */
  /* ============================================================== */
  return (
    <div className="flex h-[100dvh] flex-col bg-slate-100" data-phase={phase}>
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
                <svg className="h-11 w-11 -rotate-90" viewBox="0 0 44 44" aria-hidden>
                  <circle cx="22" cy="22" r="18" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="4" />
                  <circle
                    cx="22" cy="22" r="18" fill="none" stroke="#fff" strokeWidth="4"
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
            addDrugToPatient={addDrugToPatient}
            quickAddToWardAndPatient={quickAddToWardAndPatient}
            updateQuantity={updateQuantity}
            setQuantity={setQuantity}
            removeDrug={removeDrug}
            handleSearchKeyDown={handleSearchKeyDown}
            nameRef={nameRef}
            searchRef={searchRef}
            suggestionsWrapRef={suggestionsWrapRef}
            savedPatients={patients}
            wardDrugs={wardDrugs}
            onOpenWardDrawer={() => setWardDrawerOpen(true)}
            onAddAllInventory={addAllInventory}
          />
        ) : (
          <MatrixView
            patients={patients}
            usedWardDrugs={usedWardDrugs}
            totals={totals}
            grandTotal={grandTotal}
            wardCount={wardDrugs.length}
            qtyFor={qtyFor}
            onBack={backToForm}
            onPrint={handlePrint}
            onReset={resetAll}
          />
        )}
      </main>

      {/* ============================ FOOTER (entry only) ============================ */}
      {phase === 'entry' && (
        <footer className="no-print sticky bottom-0 z-30 shrink-0 border-t border-slate-200 bg-white/95 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] backdrop-blur">
          <div className="mx-auto flex w-full max-w-6xl gap-2 px-4 py-3 sm:px-6">
            <button
              onClick={finishRound}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-[0.98] sm:flex-none sm:px-5"
            >
              <LayoutGrid className="h-4 w-4" />
              <span className="hidden sm:inline">Finish Round &amp; Generate Chart</span>
              <span className="sm:hidden">Finish &amp; Chart</span>
            </button>
            <button
              onClick={saveAndNext}
              className="flex flex-[2] items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3.5 text-sm font-bold text-white shadow-md shadow-emerald-600/30 transition hover:bg-emerald-700 active:scale-[0.98] sm:flex-1"
            >
              <UserPlus className="h-4 w-4" />
              Save &amp; Next Patient
            </button>
          </div>
        </footer>
      )}

      {/* ============================ WARD LIST DRAWER ============================ */}
      <WardDrawer
        open={wardDrawerOpen}
        onClose={() => setWardDrawerOpen(false)}
        wardDrugs={wardDrugs}
        onAddFromInventory={addToWardFromInventory}
        onAddCustom={addCustomToWard}
        onAddAllInventory={addAllInventory}
        onRemove={removeFromWard}
        isInUse={isWardDrugInUse}
        wardNameSet={wardNameSet}
      />
    </div>
  )
}

/* ================================================================== */
/*                       PHASE 1 - ENTRY VIEW                          */
/* ================================================================== */
interface EntryViewProps {
  currentName: string
  setCurrentName: (v: string) => void
  currentDrugs: PatientDrug[]
  searchQuery: string
  setSearchQuery: (v: string) => void
  showSuggestions: boolean
  setShowSuggestions: (v: boolean) => void
  activeIndex: number
  suggestions: WardDrug[]
  addDrugToPatient: (drugId: string) => void
  quickAddToWardAndPatient: (name: string) => void
  updateQuantity: (drugId: string, delta: number) => void
  setQuantity: (drugId: string, value: number) => void
  removeDrug: (drugId: string) => void
  handleSearchKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void
  nameRef: React.RefObject<HTMLInputElement | null>
  searchRef: React.RefObject<HTMLInputElement | null>
  suggestionsWrapRef: React.RefObject<HTMLDivElement | null>
  savedPatients: Patient[]
  wardDrugs: WardDrug[]
  onOpenWardDrawer: () => void
  onAddAllInventory: () => void
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
    addDrugToPatient,
    quickAddToWardAndPatient,
    updateQuantity,
    setQuantity,
    removeDrug,
    handleSearchKeyDown,
    nameRef,
    searchRef,
    suggestionsWrapRef,
    savedPatients,
    wardDrugs,
    onOpenWardDrawer,
    onAddAllInventory,
  } = props

  const wardEmpty = wardDrugs.length === 0

  // quick-letter chips from ward list
  const letters = useMemo(() => {
    const s = new Set<string>()
    wardDrugs.forEach((d) => {
      const ch = d.name.charAt(0).toUpperCase()
      if (/[A-Z]/.test(ch)) s.add(ch)
    })
    return [...s].sort().slice(0, 8)
  }, [wardDrugs])

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
            <label htmlFor="patient-name" className="text-sm font-semibold text-slate-700">
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

        {/* Ward list status bar */}
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.03 }}
          className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/70 px-3 py-2.5 sm:mt-4"
        >
          <ListPlus className="h-4 w-4 shrink-0 text-emerald-700" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-emerald-800">
              Ward Side List
            </p>
            <p className="truncate text-[11px] text-emerald-700/80">
              {wardEmpty
                ? 'No drugs yet — build your ward list to enable fast entry'
                : `${wardDrugs.length} drug${wardDrugs.length === 1 ? '' : 's'} ready for search`}
            </p>
          </div>
          <button
            onClick={onOpenWardDrawer}
            className="flex items-center gap-1 rounded-lg border border-emerald-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 active:scale-95"
          >
            {wardEmpty ? 'Build list' : 'Manage'}
          </button>
        </motion.section>

        {/* Ward setup CTA when empty */}
        <AnimatePresence>
          {wardEmpty && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-3 rounded-2xl border-2 border-dashed border-emerald-300 bg-white p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                    <Sparkles className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-800">
                      Set up your ward drug list
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Each ward uses a specific set of drugs. Add the ones your
                      ward commonly uses so patient entry is fast.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        onClick={onAddAllInventory}
                        className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700 active:scale-95"
                      >
                        <Package className="h-3.5 w-3.5" />
                        Add all {INVENTORY.length} hospital drugs
                      </button>
                      <button
                        onClick={onOpenWardDrawer}
                        className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-95"
                      >
                        <ListPlus className="h-3.5 w-3.5" />
                        Choose manually
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

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
            <label htmlFor="drug-search" className="text-sm font-semibold text-slate-700">
              Smart Drug Search
            </label>
            <button
              onClick={onOpenWardDrawer}
              className="ml-auto flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-200 transition hover:bg-emerald-100"
            >
              <ListPlus className="h-3 w-3" />
              {wardDrugs.length} in list
            </button>
          </div>

          <div ref={suggestionsWrapRef} className="relative">
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
                placeholder={
                  wardEmpty
                    ? 'Build your ward list first…'
                    : 'Type first letter, e.g. "P"…'
                }
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                disabled={wardEmpty}
                className="w-full rounded-xl border-2 border-slate-200 bg-slate-50 py-3.5 pl-11 pr-11 text-base text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-60"
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
              {showSuggestions && !wardEmpty && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="absolute left-0 right-0 top-full z-20 mt-2 max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl ring-1 ring-black/5"
                >
                  {suggestions.length === 0 ? (
                    <div className="px-3 py-3">
                      <button
                        type="button"
                        onClick={() => quickAddToWardAndPatient(searchQuery.trim())}
                        className="flex w-full items-center gap-3 rounded-lg bg-amber-50 px-3 py-2.5 text-left text-sm ring-1 ring-amber-200 transition hover:bg-amber-100"
                      >
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-amber-500 text-white">
                          <Plus className="h-4 w-4" />
                        </span>
                        <span className="flex-1 text-slate-800">
                          Add{' '}
                          <span className="font-bold">“{searchQuery.trim()}”</span>{' '}
                          to ward list &amp; patient
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowSuggestions(false)
                          onOpenWardDrawer()
                        }}
                        className="mt-1.5 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium text-emerald-700 transition hover:bg-emerald-50"
                      >
                        <ListPlus className="h-3.5 w-3.5" />
                        Open ward list manager
                      </button>
                    </div>
                  ) : (
                    <ul className="py-1">
                      {suggestions.map((s, i) => {
                        const alreadyAdded = currentDrugs.some(
                          (d) => d.drugId === s.id,
                        )
                        return (
                          <li key={s.id}>
                            <button
                              type="button"
                              onClick={() => addDrugToPatient(s.id)}
                              onMouseEnter={() => setActiveIndex(i)}
                              className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition ${
                                activeIndex === i ? 'bg-emerald-50' : 'hover:bg-slate-50'
                              }`}
                            >
                              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-emerald-600/10 text-xs font-bold text-emerald-700">
                                {s.name.charAt(0).toUpperCase()}
                              </span>
                              <span className="flex-1 text-slate-800">
                                {highlightMatch(s.name, searchQuery)}
                              </span>
                              {s.custom && (
                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                                  custom
                                </span>
                              )}
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
                      {searchQuery.trim() && (
                        <li className="border-t border-slate-100">
                          <button
                            type="button"
                            onClick={() => quickAddToWardAndPatient(searchQuery.trim())}
                            className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-amber-700 transition hover:bg-amber-50"
                          >
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-amber-500 text-white">
                              <Plus className="h-4 w-4" />
                            </span>
                            <span className="flex-1">
                              Add{' '}
                              <span className="font-bold">“{searchQuery.trim()}”</span>{' '}
                              as new ward drug
                            </span>
                          </button>
                        </li>
                      )}
                    </ul>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* quick-letter chips */}
          {!wardEmpty && letters.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {letters.map((ch) => (
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
          )}
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
              <p className="text-sm font-medium text-slate-500">No drugs added yet</p>
              <p className="mt-1 text-xs text-slate-400">
                Search a drug above to add it to this patient.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              <AnimatePresence initial={false}>
                {currentDrugs.map((d) => {
                  const wd = wardDrugs.find((w) => w.id === d.drugId)
                  const name = wd?.name ?? 'Unknown drug'
                  return (
                    <motion.li
                      key={d.drugId}
                      layout
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 12 }}
                      transition={{ duration: 0.18 }}
                      className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-xs font-bold text-white">
                        {name.charAt(0).toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-800">{name}</p>
                        <p className="text-[11px] text-slate-400">
                          {wd?.custom ? 'Custom ward drug' : 'From ward list'} · Qty
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => updateQuantity(d.drugId, -1)}
                          className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 active:scale-90"
                          aria-label="Decrease quantity"
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <input
                          value={d.quantity}
                          onChange={(e) =>
                            setQuantity(d.drugId, parseInt(e.target.value, 10))
                          }
                          inputMode="numeric"
                          className="h-9 w-12 rounded-lg border border-slate-200 bg-white text-center text-base font-bold text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                        />
                        <button
                          type="button"
                          onClick={() => updateQuantity(d.drugId, 1)}
                          className="flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 transition hover:bg-emerald-100 active:scale-90"
                          aria-label="Increase quantity"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeDrug(d.drugId)}
                          className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-400 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 active:scale-90"
                          aria-label="Remove drug"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </motion.li>
                  )
                })}
              </AnimatePresence>
            </ul>
          )}
        </section>

        {/* saved patients mini-list */}
        {savedPatients.length > 0 && (
          <section className="mt-5">
            <div className="mb-2 flex items-center gap-2 px-1">
              <Check className="h-4 w-4 text-emerald-600" />
              <h2 className="text-sm font-semibold text-slate-700">Saved this round</h2>
              <span className="ml-auto text-xs font-medium text-slate-400">
                {savedPatients.length} / {MAX_PATIENTS}
              </span>
            </div>
            <div className="max-h-44 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-sm">
              <ul className="divide-y divide-slate-100">
                {savedPatients.map((p, i) => (
                  <li key={p.id} className="flex items-center gap-3 px-3 py-2.5">
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
/*                  WARD LIST DRAWER (bottom sheet)                    */
/* ================================================================== */
interface WardDrawerProps {
  open: boolean
  onClose: () => void
  wardDrugs: WardDrug[]
  onAddFromInventory: (invId: string) => void
  onAddCustom: (name: string) => void
  onAddAllInventory: () => void
  onRemove: (drugId: string) => void
  isInUse: (drugId: string) => boolean
  wardNameSet: Set<string>
}

function WardDrawer({
  open,
  onClose,
  wardDrugs,
  onAddFromInventory,
  onAddCustom,
  onAddAllInventory,
  onRemove,
  isInUse,
  wardNameSet,
}: WardDrawerProps) {
  const [invQuery, setInvQuery] = useState('')
  const [customName, setCustomName] = useState('')

  // inventory items not yet in the ward list, filtered by search
  const addableInventory = useMemo(() => {
    const q = invQuery.trim().toLowerCase()
    return INVENTORY.filter((i) => {
      const inWard = wardNameSet.has(i.name.toLowerCase())
      if (inWard) return false
      if (!q) return true
      return i.name.toLowerCase().includes(q)
    })
  }, [invQuery, wardNameSet])

  const remainingInventory = INVENTORY.length - wardDrugs.filter((d) => !d.custom).length

  // escape to close
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <div className="no-print fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label="Ward drug list manager">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 320 }}
            className="relative z-10 flex max-h-[88vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:max-w-lg sm:rounded-2xl"
          >
            {/* drag handle */}
            <div className="flex justify-center pt-2 sm:hidden">
              <div className="h-1.5 w-10 rounded-full bg-slate-300" />
            </div>

            {/* header */}
            <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                <ListPlus className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-bold text-slate-800">Ward Drug List</h3>
                <p className="text-[11px] text-slate-400">
                  {wardDrugs.length} drug{wardDrugs.length === 1 ? '' : 's'} · {INVENTORY.length} in hospital inventory
                </p>
              </div>
              <button
                onClick={onClose}
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* body */}
            <div className="flex-1 overflow-y-auto px-4 py-3">
              {/* Section: current ward list */}
              <section className="mb-4">
                <div className="mb-2 flex items-center gap-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Your ward list
                  </h4>
                  <span className="ml-auto rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                    {wardDrugs.length}
                  </span>
                </div>
                {wardDrugs.length === 0 ? (
                  <p className="rounded-lg bg-slate-50 px-3 py-3 text-xs text-slate-400">
                    Empty. Add drugs from the hospital inventory below, or create a
                    custom one.
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    <AnimatePresence initial={false}>
                      {wardDrugs.map((d) => {
                        const inUse = isInUse(d.id)
                        return (
                          <motion.li
                            key={d.id}
                            layout
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 8 }}
                            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2"
                          >
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-emerald-600/10 text-xs font-bold text-emerald-700">
                              {d.name.charAt(0).toUpperCase()}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-slate-800">{d.name}</p>
                              <p className="text-[10px] text-slate-400">
                                {d.custom ? 'Custom drug' : 'Hospital inventory'}
                                {inUse && ' · in use'}
                              </p>
                            </div>
                            {inUse ? (
                              <span className="flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-700 ring-1 ring-amber-200">
                                <Lock className="h-3 w-3" />
                                in use
                              </span>
                            ) : (
                              <button
                                onClick={() => onRemove(d.id)}
                                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 active:scale-90"
                                aria-label={`Remove ${d.name}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </motion.li>
                        )
                      })}
                    </AnimatePresence>
                  </ul>
                )}
              </section>

              {/* Section: add from inventory */}
              <section className="mb-4">
                <div className="mb-2 flex items-center gap-2">
                  <Package className="h-3.5 w-3.5 text-slate-500" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Add from hospital inventory
                  </h4>
                  {remainingInventory > 0 && (
                    <button
                      onClick={onAddAllInventory}
                      className="ml-auto rounded-md bg-emerald-600 px-2 py-1 text-[10px] font-bold text-white transition hover:bg-emerald-700 active:scale-95"
                    >
                      Add all ({remainingInventory})
                    </button>
                  )}
                </div>
                <div className="relative mb-2">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={invQuery}
                    onChange={(e) => setInvQuery(e.target.value)}
                    placeholder="Search hospital drugs…"
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-800 outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/15"
                  />
                </div>
                <ul className="max-h-52 space-y-1 overflow-y-auto">
                  {addableInventory.length === 0 ? (
                    <li className="rounded-lg bg-slate-50 px-3 py-2.5 text-xs text-slate-400">
                      {invQuery
                        ? 'No matching inventory drugs.'
                        : 'All hospital drugs are already in your ward list.'}
                    </li>
                  ) : (
                    addableInventory.map((i) => (
                      <li key={i.id}>
                        <button
                          onClick={() => onAddFromInventory(i.id)}
                          className="flex w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left transition hover:border-emerald-300 hover:bg-emerald-50 active:scale-[0.99]"
                        >
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-100 text-[10px] font-bold text-slate-600">
                            {i.name.charAt(0).toUpperCase()}
                          </span>
                          <span className="flex-1 truncate text-sm text-slate-700">{i.name}</span>
                          <Plus className="h-4 w-4 text-emerald-600" />
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              </section>

              {/* Section: add custom */}
              <section>
                <div className="mb-2 flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-slate-500" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Add custom drug
                  </h4>
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    if (customName.trim()) {
                      onAddCustom(customName)
                      setCustomName('')
                    }
                  }}
                  className="flex gap-2"
                >
                  <input
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="e.g. Insulin glargine 100IU/ml"
                    className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/15"
                  />
                  <button
                    type="submit"
                    disabled={!customName.trim()}
                    className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Plus className="h-4 w-4" />
                    Add
                  </button>
                </form>
              </section>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

/* ================================================================== */
/*                     PHASE 2 - MATRIX VIEW                          */
/* ================================================================== */
interface MatrixViewProps {
  patients: Patient[]
  usedWardDrugs: WardDrug[]
  totals: number[]
  grandTotal: number
  wardCount: number
  qtyFor: (patient: Patient, drugId: string) => number
  onBack: () => void
  onPrint: () => void
  onReset: () => void
}

function MatrixView({
  patients,
  usedWardDrugs,
  totals,
  grandTotal,
  wardCount,
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
          <StatCard label="Patients" value={String(patients.length)} tone="emerald" />
          <StatCard
            label="Drugs Used"
            value={`${usedWardDrugs.length}/${wardCount}`}
            tone="teal"
          />
          <StatCard label="Total Units" value={String(grandTotal)} tone="amber" />
        </div>

        {usedWardDrugs.length === 0 && (
          <p className="mx-auto mt-3 w-full max-w-6xl text-center text-xs text-slate-400">
            No drugs prescribed yet — columns will appear as drugs are added to
            patients.
          </p>
        )}
      </div>

      {/* Matrix scroll area */}
      <div className="min-h-0 flex-1 p-3 sm:p-4">
        <div className="mx-auto h-full w-full max-w-6xl">
          <div className="matrix-wrapper print-area h-full rounded-xl border border-slate-200 bg-white shadow-sm">
            {usedWardDrugs.length === 0 ? (
              <div className="flex h-full items-center justify-center p-8 text-center">
                <div>
                  <FileSpreadsheet className="mx-auto mb-3 h-10 w-10 text-slate-300" />
                  <p className="text-sm font-medium text-slate-500">
                    No drug data to display
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Add drugs to patients to populate the chart.
                  </p>
                </div>
              </div>
            ) : (
              <table className="matrix-table">
                <thead>
                  <tr>
                    <th className="corner-cell sticky left-0 top-0 z-20 min-w-[120px] text-left text-xs font-bold uppercase tracking-wide">
                      Patient
                    </th>
                    {usedWardDrugs.map((drug) => (
                      <th key={drug.id} className="drug-header-cell" title={drug.name}>
                        {drug.name}
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
                      {usedWardDrugs.map((drug) => {
                        const q = qtyFor(p, drug.id)
                        return (
                          <td key={drug.id} className={`matrix-cell ${q > 0 ? 'filled' : ''}`}>
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
            )}
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
    <div className={`rounded-lg px-3 py-2 ring-1 ${tones[tone]}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wider opacity-70">
        {label}
      </p>
      <p className="font-mono text-lg font-bold leading-tight">{value}</p>
    </div>
  )
}
