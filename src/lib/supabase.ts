import { createClient } from '@supabase/supabase-js'

/* Server-side Supabase client using the service_role key.
   Bypasses the DB password entirely — uses the PostgREST API.
   Works in serverless (Vercel) with no connection pool issues. */

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  'https://rqoduiprcymqlydztxmx.supabase.co'
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxb2R1aXByY3ltcWx5ZHp0eG14Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTU5MjIzOSwiZXhwIjoyMTA1MTY4MjM5fQ.mmDMo4R2YiNQ37FTZRRQiLwr0s1VbD6YaTLNftW0heQ'

export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
})
