import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// GET /api/patients — all saved patients with their drugs
export async function GET() {
  try {
    const { data: patients, error } = await supabase
      .from('Patient')
      .select('id, name, createdAt, drugs(id, patientId, drugId, quantity)')
      .order('createdAt')
    if (error) throw error
    return NextResponse.json(patients || [])
  } catch (e) {
    return NextResponse.json(
      { error: 'Failed to load patients' },
      { status: 500 },
    )
  }
}

// POST /api/patients — save a patient (with their drugs)
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const name = String(body?.name ?? '').trim()
    if (!name)
      return NextResponse.json({ error: 'name is required' }, { status: 400 })

    const incoming = Array.isArray(body?.drugs) ? body.drugs : []
    const drugs = incoming
      .filter(
        (d: { drugId?: string; quantity?: number }) =>
          typeof d.drugId === 'string' &&
          Number.isInteger(d.quantity) &&
          (d.quantity as number) > 0,
      )
      .map((d: { drugId: string; quantity: number }) => ({
        drugId: d.drugId,
        quantity: d.quantity,
      }))

    // insert patient
    const patientId = crypto.randomUUID()
    const { data: patient, error: pErr } = await supabase
      .from('Patient')
      .insert({ id: patientId, name })
      .select('id, name, createdAt')
      .single()
    if (pErr) throw pErr

    // insert drugs if any
    if (drugs.length > 0) {
      const rows = drugs.map((d: { drugId: string; quantity: number }) => ({
        id: crypto.randomUUID(),
        patientId,
        drugId: d.drugId,
        quantity: d.quantity,
      }))
      const { error: dErr } = await supabase
        .from('PatientDrug')
        .insert(rows)
      if (dErr) throw dErr
    }

    return NextResponse.json(
      { ...patient, drugs },
      { status: 201 },
    )
  } catch (e) {
    return NextResponse.json(
      { error: 'Failed to save patient' },
      { status: 500 },
    )
  }
}
