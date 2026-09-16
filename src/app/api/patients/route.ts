import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/patients — all saved patients with their drugs
export async function GET() {
  try {
    const patients = await db.patient.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        drugs: true,
      },
    })
    return NextResponse.json(patients)
  } catch (e) {
    return NextResponse.json(
      { error: 'Failed to load patients' },
      { status: 500 },
    )
  }
}

// POST /api/patients — save a patient (with their drugs)
//   body: { name, drugs: [{ drugId, quantity }] }
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

    const patient = await db.patient.create({
      data: {
        name,
        drugs: { create: drugs },
      },
      include: { drugs: true },
    })
    return NextResponse.json(patient, { status: 201 })
  } catch (e) {
    return NextResponse.json(
      { error: 'Failed to save patient' },
      { status: 500 },
    )
  }
}
