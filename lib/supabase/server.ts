import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '../../types'

/**
 * Server-side Supabase client — anon key, respects RLS.
 * Use in Server Components, Route Handlers, and Server Actions.
 * Reads/writes cookies from the incoming request context.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // setAll called from a Server Component — cookies can only be
            // mutated in a Route Handler or Server Action. Safe to ignore here
            // because the middleware refreshes the session cookie.
          }
        },
      },
    },
  )
}
