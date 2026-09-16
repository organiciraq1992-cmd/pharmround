/* Seed the hospital Inventory with the 24 default drugs.
   Run with: bun prisma/seed.ts  (or via `bun run db:seed`) */
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

const INVENTORY: { name: string; form: 'tab' | 'fluid' | 'supply' }[] = [
  { name: 'Tegretol 200mg Tab', form: 'tab' },
  { name: 'Phenytoin 250mg amp', form: 'fluid' },
  { name: 'Haloperidol 10mg amp', form: 'fluid' },
  { name: 'Heparin vial', form: 'fluid' },
  { name: 'Clexane syringe 4000 IU', form: 'supply' },
  { name: 'Clexane syringe 6000 IU', form: 'supply' },
  { name: 'Decadrone 8mg Amp', form: 'fluid' },
  { name: 'B1 amp', form: 'fluid' },
  { name: 'KCl 15% amp', form: 'fluid' },
  { name: 'Calcium amp', form: 'fluid' },
  { name: 'Plasil 10mg Amp', form: 'fluid' },
  { name: 'Lasix 20mg Amp', form: 'fluid' },
  { name: 'Zofran ampoule 8mg', form: 'fluid' },
  { name: 'Omeprazole 40mg vial', form: 'fluid' },
  { name: 'Acupan amp', form: 'fluid' },
  { name: 'Paracetamol 1g vial', form: 'fluid' },
  { name: 'Azithromycin 500mg tab', form: 'tab' },
  { name: 'Methoprim 480mg Tab', form: 'tab' },
  { name: 'Fluconazole 150mg cap', form: 'tab' },
  { name: 'Voriconazole 200mg tab', form: 'tab' },
  { name: 'Ciprodar 200mg vial', form: 'fluid' },
  { name: 'Flagyl 500mg Vial', form: 'fluid' },
  { name: 'Vancomycin 1g vial', form: 'fluid' },
  { name: 'Ceftriaxone 1g vial', form: 'fluid' },
]

async function main() {
  console.log('Seeding inventory…')
  for (const item of INVENTORY) {
    await db.inventory.upsert({
      where: { name: item.name },
      update: { form: item.form },
      create: item,
    })
  }
  const count = await db.inventory.count()
  console.log(`Inventory seeded: ${count} drugs.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
