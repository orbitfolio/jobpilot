"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { getBrowserSupabase } from "@/lib/account-sync";

export default function AuthCallbackPage() {
  const router = useRouter();
  useEffect(() => {
    const supabase = getBrowserSupabase();
    if (!supabase) {
      router.replace("/settings");
      return;
    }
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      router.replace("/");
    };
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) finish();
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) finish();
    });
    return () => data.subscription.unsubscribe();
  }, [router]);
  return <p className="p-8 text-sm">Signing you in…</p>;
}
