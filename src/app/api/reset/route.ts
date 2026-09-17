import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// POST /api/reset — clear all saved patients (ward list kept intact)
export async function POST() {
  try {
    // PatientDrug has ON DELETE CASCADE, so deleting patients clears their drugs
    const { error } = await supabase.from('Patient').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json(
      { error: 'Failed to reset records' },
      { status: 500 },
    )
  }
}
