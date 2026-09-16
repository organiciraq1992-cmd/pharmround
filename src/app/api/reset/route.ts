import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// POST /api/reset — clear all saved patients (ward list kept intact)
export async function POST() {
  try {
    // PatientDrug cascade-deletes with Patient; just delete patients.
    await db.patient.deleteMany()
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json(
      { error: 'Failed to reset records' },
      { status: 500 },
    )
  }
}
