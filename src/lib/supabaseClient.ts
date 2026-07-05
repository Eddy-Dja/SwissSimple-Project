import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://fzqbraitdhilveyrwuew.supabase.co';
const supabaseAnonKey = 'sb_publishable_kpdhtVUBNYp13POEz4Jj1Q_b34-3ZLY';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
