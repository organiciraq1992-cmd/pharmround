import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

function categorizeDrug(name: string): string {
  const n = name.toLowerCase()
  if (n.includes('syringe')) return 'supply'
  if (n.includes('tab') || n.includes('cap')) return 'tab'
  return 'fluid'
}

// GET /api/ward-drugs — the user's curated ward list
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('WardDrug')
      .select('id, name, custom, form, createdAt')
      .order('createdAt')
    if (error) throw error
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json(
      { error: 'Failed to load ward drugs' },
      { status: 500 },
    )
  }
}

// POST /api/ward-drugs — add one drug to the ward list
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const name = String(body?.name ?? '').trim()
    if (!name)
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    const form = ['tab', 'fluid', 'supply'].includes(body?.form)
      ? body.form
      : categorizeDrug(name)

    const { data, error } = await supabase
      .from('WardDrug')
      .insert({ id: crypto.randomUUID(), name, custom: Boolean(body?.custom), form })
      .select('id, name, custom, form, createdAt')
      .single()
    if (error) throw error
    return NextResponse.json(data, { status: 201 })
  } catch (e) {
    return NextResponse.json(
      { error: 'Failed to add ward drug' },
      { status: 500 },
    )
  }
}
