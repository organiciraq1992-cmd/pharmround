import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// GET /api/inventory — admin hospital inventory (read-only)
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('Inventory')
      .select('id, name, form, createdAt')
      .order('name')
    if (error) throw error
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json(
      { error: 'Failed to load inventory' },
      { status: 500 },
    )
  }
}
