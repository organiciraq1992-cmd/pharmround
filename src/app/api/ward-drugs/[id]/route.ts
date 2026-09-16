import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// DELETE /api/ward-drugs/[id] — remove a drug from the ward list
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    // guard: refuse if any patient is using this drug
    const inUse = await db.patientDrug.findFirst({ where: { drugId: id } })
    if (inUse) {
      return NextResponse.json(
        { error: 'Cannot remove — drug is prescribed to a patient.' },
        { status: 409 },
      )
    }
    await db.wardDrug.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json(
      { error: 'Failed to delete ward drug' },
      { status: 500 },
    )
  }
}
