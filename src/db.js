import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://xupujdparrinvzyzowrx.supabase.co'
const supabaseAnonKey = 'sb_publishable_GVj6UOEHvymLAk5PFiwZXQ_9RDpCYJA'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)