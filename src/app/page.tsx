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
  FileSpreadsheet,
  LayoutGrid,
  UserPlus,
  ListPlus,
  Package,
  Lock,
  Sparkles,
  Eraser,
  Droplets,
  Syringe,
  ChevronDown,
  ChevronUp,
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
   Drug form categories — used as icon filters on the ward list
     tab    → oral tablets & capsules
     fluid  → ampoules, vials, ampoules (injectable liquids)
     supply → pre-filled syringes / consumables
----------------------------------------------------------------- */
type DrugForm = 'tab' | 'fluid' | 'supply'

function categorizeDrug(name: string): DrugForm {
  const n = name.toLowerCase()
  if (n.includes('syringe')) return 'supply'
  if (n.includes('tab') || n.includes('cap')) return 'tab'
  // amp, ampoule, vial → injectable fluids
  return 'fluid'
}

const CATEGORIES: {
  id: 'all' | DrugForm
  label: string
  icon: typeof Pill
}[] = [
  { id: 'all', label: 'All', icon: LayoutGrid },
  { id: 'tab', label: 'Tabs', icon: Pill },
  { id: 'fluid', label: 'Fluids', icon: Droplets },
  { id: 'supply', label: 'Supplies', icon: Syringe },
]

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
  form: DrugForm // tab | fluid | supply — used by the icon filter
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

  const nameRef = useRef<HTMLInputElement>(null)

  /* --------------------------- ward list actions --------------------------- */
  const wardNameSet = useMemo(
    () => new Set(wardDrugs.map((d) => d.name.toLowerCase())),
    [wardDrugs],
  )

  const addToWardFromInventory = useCallback((invId: string) => {
    const inv = INVENTORY.find((i) => i.id === invId)
    if (!inv) return
    setWardDrugs((prev) => {
      if (prev.some((d) => d.name.toLowerCase() === inv.name.toLowerCase()))
        return prev
      return [
        ...prev,
        { id: uid(), name: inv.name, custom: false, form: categorizeDrug(inv.name) },
      ]
    })
  }, [])

  const addCustomToWard = useCallback((name: string) => {
    const n = name.trim()
    if (!n) return
    setWardDrugs((prev) => {
      if (prev.some((d) => d.name.toLowerCase() === n.toLowerCase())) return prev
      return [...prev, { id: uid(), name: n, custom: true, form: categorizeDrug(n) }]
    })
  }, [])

  const addAllInventory = useCallback(() => {
    setWardDrugs((prev) => {
      const existing = new Set(prev.map((d) => d.name.toLowerCase()))
      const toAdd = INVENTORY.filter(
        (i) => !existing.has(i.name.toLowerCase()),
      ).map((i) => ({
          id: uid(),
          name: i.name,
          custom: false,
          form: categorizeDrug(i.name),
        }))
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

  /* --------------------------- patient column actions --------------------------- */
  // currentDrugs is a SPARSE list of { drugId, quantity } for qty > 0 only.
  const getQty = useCallback(
    (drugId: string) =>
      currentDrugs.find((d) => d.drugId === drugId)?.quantity ?? 0,
    [currentDrugs],
  )

  const setQty = useCallback((drugId: string, value: number) => {
    const v = Math.max(0, Math.floor(Number.isNaN(value) ? 0 : value))
    setCurrentDrugs((prev) => {
      const filtered = prev.filter((d) => d.drugId !== drugId)
      return v > 0 ? [...filtered, { drugId, quantity: v }] : filtered
    })
  }, [])

  const bumpQty = useCallback(
    (drugId: string, delta: number) => {
      const next = (getQty(drugId) || 0) + delta
      setQty(drugId, next)
    },
    [getQty, setQty],
  )

  const clearColumn = useCallback(() => {
    setCurrentDrugs([])
  }, [])

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
      toast.error('Enter a quantity for at least one drug', {
        description: 'Type the number next to a drug in the list.',
      })
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
    toast.success(`Patient ${patients.length + 1} saved`, {
      description: `${patient.drugs.length} drug(s) recorded — column cleared.`,
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
    setPhase('entry')
    toast.success('All records cleared')
  }

  const handlePrint = () => window.print()

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
            getQty={getQty}
            setQty={setQty}
            bumpQty={bumpQty}
            clearColumn={clearColumn}
            nameRef={nameRef}
            savedPatients={patients}
            wardDrugs={wardDrugs}
            onOpenWardDrawer={() => setWardDrawerOpen(true)}
            onAddAllInventory={addAllInventory}
            onReset={resetAll}
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
/*   Sticky, scrollable ward list + single editable patient column    */
/* ================================================================== */
interface EntryViewProps {
  currentName: string
  setCurrentName: (v: string) => void
  currentDrugs: PatientDrug[]
  getQty: (drugId: string) => number
  setQty: (drugId: string, value: number) => void
  bumpQty: (drugId: string, delta: number) => void
  clearColumn: () => void
  nameRef: React.RefObject<HTMLInputElement | null>
  savedPatients: Patient[]
  wardDrugs: WardDrug[]
  onOpenWardDrawer: () => void
  onAddAllInventory: () => void
  onReset: () => void
}

function EntryView(props: EntryViewProps) {
  const {
    currentName,
    setCurrentName,
    currentDrugs,
    getQty,
    setQty,
    bumpQty,
    clearColumn,
    nameRef,
    savedPatients,
    wardDrugs,
    onOpenWardDrawer,
    onAddAllInventory,
    onReset,
  } = props

  const [letterFilter, setLetterFilter] = useState('')
  const [catFilter, setCatFilter] = useState<'all' | DrugForm>('all')
  const [savedOpen, setSavedOpen] = useState(false)
  const wardEmpty = wardDrugs.length === 0
  const prescribedCount = currentDrugs.length

  // category + letter combine; ALL ward drugs available when both cleared
  const visibleDrugs = useMemo(() => {
    let list = wardDrugs
    if (catFilter !== 'all') list = list.filter((d) => d.form === catFilter)
    const q = letterFilter.trim().toLowerCase()
    if (q) list = list.filter((d) => d.name.toLowerCase().startsWith(q))
    return list
  }, [wardDrugs, catFilter, letterFilter])

  // letters derived from the category-filtered set (stable within category)
  const letters = useMemo(() => {
    const s = new Set<string>()
    let pool = wardDrugs
    if (catFilter !== 'all') pool = pool.filter((d) => d.form === catFilter)
    pool.forEach((d) => {
      const ch = d.name.charAt(0).toUpperCase()
      if (/[A-Z]/.test(ch)) s.add(ch)
    })
    return [...s].sort().slice(0, 12)
  }, [wardDrugs, catFilter])

  // per-category counts (for the icon badges)
  const catCounts = useMemo(() => {
    const c = { all: wardDrugs.length, tab: 0, fluid: 0, supply: 0 }
    wardDrugs.forEach((d) => {
      c[d.form] += 1
    })
    return c
  }, [wardDrugs])

  const totalUnits = useMemo(
    () => savedPatients.reduce((s, p) => s + p.drugs.reduce((a, d) => a + d.quantity, 0), 0),
    [savedPatients],
  )

  const visiblePrescribed = useMemo(
    () => visibleDrugs.filter((d) => getQty(d.id) > 0).length,
    [visibleDrugs, getQty],
  )

  return (
    <div className="flex h-full flex-col">
      {/* ---------- Patient name bar ---------- */}
      <div className="shrink-0 bg-white px-4 pb-3 pt-3 shadow-sm sm:px-6 sm:pt-4">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-2">
          <div className="relative flex-1">
            <input
              ref={nameRef}
              value={currentName}
              onChange={(e) => setCurrentName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  // focus the first qty input
                  const first = document.querySelector<HTMLInputElement>(
                    '[data-qty-input="1"]',
                  )
                  first?.focus()
                }
              }}
              placeholder="Patient name  ·  e.g. John Doe / Bed 14"
              autoComplete="off"
              className="w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-4 py-3 text-base font-semibold text-slate-800 outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 sm:text-lg"
            />
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {prescribedCount > 0 && (
              <button
                onClick={clearColumn}
                className="flex h-11 items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-500 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 active:scale-95"
                title="Clear all quantities in this column"
              >
                <Eraser className="h-4 w-4" />
                <span className="hidden sm:inline">Clear</span>
              </button>
            )}
            <button
              onClick={onOpenWardDrawer}
              className="flex h-11 items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100 active:scale-95"
            >
              <ListPlus className="h-4 w-4" />
              <span className="hidden sm:inline">Ward list</span>
              <span className="rounded-full bg-emerald-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                {wardDrugs.length}
              </span>
            </button>
          </div>
        </div>
        {/* prescribed chips line */}
        <div className="mx-auto mt-2 flex w-full max-w-6xl items-center gap-2">
          <span className="text-[11px] font-medium text-slate-400">
            Patient {savedPatients.length + 1}
          </span>
          <span className="text-slate-300">·</span>
          <span className="text-[11px] font-medium text-slate-400">
            {prescribedCount > 0 ? (
              <span className="font-bold text-emerald-700">
                {prescribedCount} drug{prescribedCount === 1 ? '' : 's'} prescribed
              </span>
            ) : (
              'Type a number next to each prescribed drug'
            )}
          </span>
        </div>
      </div>

      {/* ---------- Ward setup CTA when empty ---------- */}
      <AnimatePresence>
        {wardEmpty && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="shrink-0 overflow-hidden px-4 pt-3 sm:px-6"
          >
            <div className="mx-auto w-full max-w-6xl rounded-2xl border-2 border-dashed border-emerald-300 bg-white p-4 sm:p-5">
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
                    ward commonly uses — they become the rows of this patient
                    column.
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

      {/* ---------- Filter bar: category icons + letter chips ---------- */}
      {!wardEmpty && (
        <div className="no-print shrink-0 border-b border-slate-100 bg-slate-50/60 px-4 py-2 sm:px-6">
          <div className="mx-auto flex w-full max-w-6xl items-center gap-1.5 overflow-x-auto pb-0.5">
            {/* category icon filters */}
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon
              const active = catFilter === cat.id
              const count = catCounts[cat.id]
              return (
                <button
                  key={cat.id}
                  onClick={() => setCatFilter(active ? 'all' : cat.id)}
                  className={`flex min-h-8 shrink-0 items-center gap-1 rounded-lg px-2.5 text-xs font-bold transition ${
                    active
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'border border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700'
                  }`}
                  title={`${cat.label} (${count})`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{cat.label}</span>
                  <span
                    className={`rounded-full px-1 text-[10px] ${
                      active ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              )
            })}

            {/* divider */}
            {letters.length > 0 && (
              <span className="mx-1 h-5 w-px shrink-0 bg-slate-200" aria-hidden />
            )}

            {/* letter chips */}
            {letters.map((ch) => {
              const active = letterFilter === ch
              return (
                <button
                  key={ch}
                  onClick={() => setLetterFilter(active ? '' : ch)}
                  className={`min-h-8 min-w-8 shrink-0 rounded-lg px-2 text-xs font-bold transition ${
                    active
                      ? 'bg-emerald-600 text-white'
                      : 'border border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700'
                  }`}
                >
                  {ch}
                </button>
              )
            })}
          </div>
          <div className="mx-auto mt-1 flex w-full max-w-6xl items-center justify-between">
            <span className="text-[11px] font-medium text-slate-400">
              {catFilter !== 'all' || letterFilter
                ? `Showing ${visibleDrugs.length} of ${wardDrugs.length}`
                : `${wardDrugs.length} drugs in ward list`}
            </span>
            <span className="text-[11px] font-medium text-slate-400">
              {visiblePrescribed} filled
            </span>
          </div>
        </div>
      )}

      {/* ---------- Column header ---------- */}
      {!wardEmpty && visibleDrugs.length > 0 && (
        <div className="no-print sticky top-0 z-10 shrink-0 border-y border-slate-200 bg-slate-100/95 px-4 py-1.5 backdrop-blur sm:px-6">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">
            <span>Drug · Ward list</span>
            <span className="text-emerald-700">This patient (qty)</span>
          </div>
        </div>
      )}

      {/* ---------- Scrollable ward list + single patient column ---------- */}
      <div className="no-print min-h-0 flex-1 overflow-y-auto px-4 py-2 sm:px-6">
        <div className="mx-auto w-full max-w-6xl">
          {wardEmpty ? (
            <p className="py-8 text-center text-sm text-slate-400">
              Add ward drugs above to start filling patient quantities.
            </p>
          ) : visibleDrugs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Search className="mb-2 h-8 w-8 text-slate-300" />
              <p className="text-sm font-medium text-slate-500">
                No drug matches this filter
              </p>
              <button
                onClick={() => {
                  setCatFilter('all')
                  setLetterFilter('')
                }}
                className="mt-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Show all drugs
              </button>
            </div>
          ) : (
            <ul className="space-y-1.5 pb-4">
              <AnimatePresence initial={false}>
                {visibleDrugs.map((drug) => {
                  const q = getQty(drug.id)
                  const filled = q > 0
                  return (
                    <motion.li
                      key={drug.id}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className={`flex items-center gap-2.5 rounded-xl border bg-white p-2 transition ${
                        filled
                          ? 'border-emerald-300 bg-emerald-50/50 ring-1 ring-emerald-200'
                          : 'border-slate-200'
                      }`}
                    >
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                          filled
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {drug.name.charAt(0).toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-800">
                          {drug.name}
                        </p>
                        {drug.custom && (
                          <span className="text-[10px] font-medium text-slate-400">
                            Custom ward drug
                          </span>
                        )}
                      </div>

                      {/* single-patient quantity column */}
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => bumpQty(drug.id, -1)}
                          className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 active:scale-90"
                          aria-label={`Decrease ${drug.name}`}
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <input
                          data-qty-input="1"
                          value={q > 0 ? String(q) : ''}
                          onChange={(e) =>
                            setQty(drug.id, parseInt(e.target.value, 10))
                          }
                          onFocus={(e) => e.currentTarget.select()}
                          inputMode="numeric"
                          placeholder="0"
                          className={`h-9 w-12 rounded-lg border text-center text-base font-bold outline-none transition focus:ring-2 ${
                            filled
                              ? 'border-emerald-500 bg-white text-emerald-700 focus:ring-emerald-500/25'
                              : 'border-slate-200 bg-slate-50 text-slate-700 focus:border-emerald-500 focus:bg-white focus:ring-emerald-500/20'
                          }`}
                          aria-label={`Quantity for ${drug.name}`}
                        />
                        <button
                          type="button"
                          onClick={() => bumpQty(drug.id, 1)}
                          className="flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 transition hover:bg-emerald-100 active:scale-90"
                          aria-label={`Increase ${drug.name}`}
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                    </motion.li>
                  )
                })}
              </AnimatePresence>
            </ul>
          )}
        </div>
      </div>

      {/* ---------- Collapsible "Saved this round" summary ---------- */}
      {savedPatients.length > 0 && (
        <div className="no-print shrink-0 border-t border-slate-200 bg-white px-4 py-1.5 sm:px-6">
          <div className="mx-auto w-full max-w-6xl">
            <button
              onClick={() => setSavedOpen((v) => !v)}
              className="flex w-full items-center gap-2 py-0.5 text-left"
              aria-expanded={savedOpen}
            >
              {savedOpen ? (
                <ChevronUp className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              )}
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Saved this round
              </span>
              <span className="rounded-full bg-emerald-100 px-1.5 text-[10px] font-bold text-emerald-700">
                {savedPatients.length}/{MAX_PATIENTS}
              </span>
              <span className="ml-auto text-[11px] font-medium text-slate-400">
                {totalUnits} units
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onReset()
                }}
                className="ml-1 rounded px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                title="Clear all saved patients"
              >
                Reset
              </button>
            </button>
            <AnimatePresence initial={false}>
              {savedOpen && (
                <motion.ul
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  className="max-h-40 space-y-1 overflow-y-auto pt-1"
                >
                  {savedPatients.map((p, i) => (
                    <li key={p.id} className="flex items-center gap-2 text-xs">
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-[9px] font-bold text-white">
                        {i + 1}
                      </span>
                      <span className="flex-1 truncate font-medium text-slate-700">
                        {p.name}
                      </span>
                      <span className="text-slate-400">
                        {p.drugs.reduce((s, d) => s + d.quantity, 0)} units
                      </span>
                    </li>
                  ))}
                </motion.ul>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}
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

  const remainingInventory =
    INVENTORY.length - wardDrugs.filter((d) => !d.custom).length

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
        <div
          className="no-print fixed inset-0 z-50 flex items-end justify-center sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label="Ward drug list manager"
        >
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
            <div className="flex justify-center pt-2 sm:hidden">
              <div className="h-1.5 w-10 rounded-full bg-slate-300" />
            </div>

            <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                <ListPlus className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-bold text-slate-800">Ward Drug List</h3>
                <p className="text-[11px] text-slate-400">
                  {wardDrugs.length} drug{wardDrugs.length === 1 ? '' : 's'} ·{' '}
                  {INVENTORY.length} in hospital inventory
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
                              <p className="truncate text-sm font-medium text-slate-800">
                                {d.name}
                              </p>
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
                          <span className="flex-1 truncate text-sm text-slate-700">
                            {i.name}
                          </span>
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
