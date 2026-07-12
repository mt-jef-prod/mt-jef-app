import { useEffect, useState } from "react";
import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

function authSessionDebug(step: string, details: Record<string, unknown>) {
  if (!import.meta.env.DEV || import.meta.env.MODE === "test") {
    return;
  }

  console.info("[mt-jef-auth-session]", step, details);
}

export function useAuthSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [authEvent, setAuthEvent] = useState<AuthChangeEvent | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let active = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) {
          return;
        }

        authSessionDebug("getSession:result", {
          hasSession: Boolean(data.session),
          userId: data.session?.user?.id ?? null
        });

        setSession(data.session);
        setUser(data.session?.user ?? null);
      })
      .catch((error) => {
        authSessionDebug("getSession:error", {
          error: error instanceof Error ? error.message : String(error)
        });
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      authSessionDebug("onAuthStateChange", {
        event,
        hasSession: Boolean(nextSession),
        userId: nextSession?.user?.id ?? null
      });
      setAuthEvent(event);
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setLoading(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return { session, user, authEvent, loading };
}
