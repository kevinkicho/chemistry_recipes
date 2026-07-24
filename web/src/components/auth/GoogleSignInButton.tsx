"use client";

import { useEffect, useState } from "react";
import {
  completeGoogleRedirect,
  isFirebaseWebConfigured,
  signInWithGoogle,
  signOut,
  subscribeAuth,
  type User,
} from "@/lib/firebase/auth";

/**
 * Compact Google sign-in / profile chip for the header.
 * Enable Google provider in Firebase Console → Authentication.
 */
export function GoogleSignInButton() {
  const [user, setUser] = useState<User | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const configured = isFirebaseWebConfigured();

  useEffect(() => {
    if (!configured) return;
    void completeGoogleRedirect().catch(() => undefined);
    return subscribeAuth(setUser);
  }, [configured]);

  if (!configured) {
    return (
      <span
        className="hidden rounded-md px-2 py-1 text-[11px] text-slate-600 sm:inline"
        title="Set NEXT_PUBLIC_FIREBASE_* in .env"
      >
        Auth off
      </span>
    );
  }

  async function onSignIn() {
    setBusy(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Sign-in failed";
      // Popup blocked → redirect fallback
      if (/popup/i.test(msg)) {
        try {
          await signInWithGoogle({ redirect: true });
          return;
        } catch (e2) {
          setError(e2 instanceof Error ? e2.message : "Sign-in failed");
        }
      } else {
        setError(msg);
      }
    } finally {
      setBusy(false);
    }
  }

  async function onSignOut() {
    setBusy(true);
    setError(null);
    try {
      await signOut();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-out failed");
    } finally {
      setBusy(false);
    }
  }

  if (user) {
    return (
      <div className="flex items-center gap-1.5">
        {user.photoURL ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.photoURL}
            alt=""
            className="h-6 w-6 rounded-full ring-1 ring-slate-700"
            referrerPolicy="no-referrer"
          />
        ) : null}
        <span
          className="hidden max-w-[8rem] truncate text-xs text-slate-400 sm:inline"
          title={user.email ?? user.uid}
        >
          {user.displayName || user.email || "Signed in"}
        </span>
        <button
          type="button"
          disabled={busy}
          onClick={() => void onSignOut()}
          className="rounded-md px-2 py-1.5 text-xs text-slate-400 transition-colors hover:bg-slate-800 hover:text-teal-200 disabled:opacity-50"
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end">
      <button
        type="button"
        disabled={busy}
        onClick={() => void onSignIn()}
        className="rounded-md border border-slate-700 bg-slate-900/80 px-2.5 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:border-teal-500/40 hover:text-teal-100 disabled:opacity-50"
      >
        {busy ? "…" : "Google sign-in"}
      </button>
      {error ? (
        <span className="mt-0.5 max-w-[12rem] text-right text-[10px] text-rose-400/90">
          {error}
        </span>
      ) : null}
    </div>
  );
}
