/* Typed fetch helpers for the PharmRound API. */

export interface InventoryDrug {
  id: string
  name: string
  form: 'tab' | 'fluid' | 'supply'
  createdAt: string
}

export interface WardDrug {
  id: string
  name: string
  custom: boolean
  form: 'tab' | 'fluid' | 'supply'
  createdAt: string
}

export interface PatientDrug {
  id: string
  patientId: string
  drugId: string
  quantity: number
}

export interface Patient {
  id: string
  name: string
  createdAt: string
  drugs: PatientDrug[]
}

export async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { error?: string }).error || `Request failed (${res.status})`)
  }
  return res.json() as Promise<T>
}

/* ---- Inventory ---- */
export const getInventory = () =>
  fetchJSON<InventoryDrug[]>('/api/inventory')

/* ---- Ward drugs ---- */
export const getWardDrugs = () =>
  fetchJSON<WardDrug[]>('/api/ward-drugs')

export const addWardDrug = (data: {
  name: string
  custom?: boolean
  form?: 'tab' | 'fluid' | 'supply'
}) => fetchJSON<WardDrug>('/api/ward-drugs', {
  method: 'POST',
  body: JSON.stringify(data),
})

export const deleteWardDrug = (id: string) =>
  fetchJSON<{ ok: boolean }>(`/api/ward-drugs/${id}`, { method: 'DELETE' })

/* ---- Patients ---- */
export const getPatients = () =>
  fetchJSON<Patient[]>('/api/patients')

export const savePatient = (data: {
  name: string
  drugs: { drugId: string; quantity: number }[]
}) =>
  fetchJSON<Patient>('/api/patients', {
    method: 'POST',
    body: JSON.stringify(data),
  })

export const resetPatients = () =>
  fetchJSON<{ ok: boolean }>('/api/reset', { method: 'POST' })
