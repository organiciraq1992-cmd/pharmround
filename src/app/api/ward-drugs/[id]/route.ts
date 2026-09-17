import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// DELETE /api/ward-drugs/[id] — remove a drug from the ward list
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    // guard: refuse if any patient is using this drug
    const { count } = await supabase
      .from('PatientDrug')
      .select('id', { count: 'exact', head: true })
      .eq('drugId', id)
    if (count && count > 0) {
      return NextResponse.json(
        { error: 'Cannot remove — drug is prescribed to a patient.' },
        { status: 409 },
      )
    }
    const { error } = await supabase.from('WardDrug').delete().eq('id', id)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json(
      { error: 'Failed to delete ward drug' },
      { status: 500 },
    )
  }
}
