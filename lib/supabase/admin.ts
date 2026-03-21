import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types'

/**
 * Admin Supabase client — service role key, bypasses RLS entirely.
 * Used ONLY in /admin/* server-side routes and Trigger.dev jobs.
 *
 * NEVER import this in browser code or expose SUPABASE_SERVICE_ROLE_KEY
 * to the client bundle. Call sites must re-verify admin role server-side
 * before invoking any mutation (PRD §11.3).
 */
export function createAdminClient() {
  if (typeof window !== 'undefined') {
    throw new Error(
      'createAdminClient() must not be called in browser code. ' +
      'Use createClient() from lib/supabase/client.ts instead.',
    )
  }

  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  )
}
