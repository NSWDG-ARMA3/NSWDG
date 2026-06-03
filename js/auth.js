import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://lshdabctlaifkeptyfoz.supabase.co";
const SUPABASE_KEY = "sb_publishable_NpY_RXqnMC9UwNmkxCiK-Q_zNX6g6CH";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export async function requireLogin() {
  const { data, error } = await supabase.auth.getSession();

  if (error || !data.session) {
    window.location.href = "/login/";
    return null;
  }

  return data.session.user;
}

export async function logout() {
  await supabase.auth.signOut();
  window.location.href = "/login/";
}