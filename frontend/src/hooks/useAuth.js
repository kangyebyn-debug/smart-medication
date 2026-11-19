import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

export function useAuth() {
  const [auth, setAuth] = useState({ session: null, loading: Boolean(supabase), error: null });

  useEffect(() => {
    if (!supabase) return;

    let active = true;
    let receivedAuthEvent = false;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      receivedAuthEvent = true;
      if (active) setAuth({ session, loading: false, error: null });
    });

    supabase.auth.getSession().then(({ data, error }) => {
      if (active && !receivedAuthEvent) {
        setAuth({ session: data?.session ?? null, loading: false, error });
      }
    }).catch((error) => {
      if (active && !receivedAuthEvent) {
        setAuth({ session: null, loading: false, error });
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return {
    ...auth,
    configured: Boolean(supabase),
    signIn: (email, password) => supabase.auth.signInWithPassword({ email, password }),
    signUp: (email, password) => supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin },
    }),
    signOut: () => supabase.auth.signOut(),
  };
}
