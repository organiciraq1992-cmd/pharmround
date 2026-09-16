import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/inventory — admin hospital inventory (read-only)
export async function GET() {
  try {
    const items = await db.inventory.findMany({
      orderBy: { name: 'asc' },
    })
    return NextResponse.json(items)
  } catch (e) {
    return NextResponse.json(
      { error: 'Failed to load inventory' },
      { status: 500 },
    )
  }
}
