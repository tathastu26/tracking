import { createClient } from '@supabase/supabase-js'

export async function createServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase configuration', { hasUrl: !!supabaseUrl, hasKey: !!supabaseKey })
    throw new Error('Missing Supabase configuration')
  }

  try {
    return createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    })
  } catch (err) {
    console.error('Failed to create Supabase client:', err)
    throw err
  }
}

// default export for compatibility with some server code
export default createServerClient

