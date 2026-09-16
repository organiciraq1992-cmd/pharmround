import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/ward-drugs — the user's curated ward list
export async function GET() {
  try {
    const drugs = await db.wardDrug.findMany({
      orderBy: { createdAt: 'asc' },
    })
    return NextResponse.json(drugs)
  } catch (e) {
    return NextResponse.json(
      { error: 'Failed to load ward drugs' },
      { status: 500 },
    )
  }
}

// POST /api/ward-drugs — add one drug to the ward list
//   body: { name, custom?, form? }
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const name = String(body?.name ?? '').trim()
    if (!name)
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    const form = ['tab', 'fluid', 'supply'].includes(body?.form)
      ? body.form
      : (() => {
          const n = name.toLowerCase()
          if (n.includes('syringe')) return 'supply'
          if (n.includes('tab') || n.includes('cap')) return 'tab'
          return 'fluid'
        })()

    const drug = await db.wardDrug.create({
      data: {
        name,
        custom: Boolean(body?.custom),
        form,
      },
    })
    return NextResponse.json(drug, { status: 201 })
  } catch (e) {
    return NextResponse.json(
      { error: 'Failed to add ward drug' },
      { status: 500 },
    )
  }
}
