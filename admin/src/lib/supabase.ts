import { createClient } from '@supabase/supabase-js';
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const supabase = createClient(url || 'https://placeholder.supabase.co', key || 'placeholder');
export const ADMIN_ALLOWLIST = ['prajwalgowda0538@gmail.com', 'shashankbl1520@gmail.com'];
export const isAllowedAdmin = (email: string) => ADMIN_ALLOWLIST.includes(email.toLowerCase().trim());
