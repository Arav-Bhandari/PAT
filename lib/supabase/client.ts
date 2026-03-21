import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '../../types'

/**
 * Browser Supabase client — anon key, used in Client Components.
 * Call once per component; @supabase/ssr deduplicates under the hood.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
