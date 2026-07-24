/**
 * Client-side Auth helpers (Google sign-in).
 * Enable Google provider in Firebase Console → Authentication → Sign-in method.
 */

"use client";

import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import { getClientAuth, isFirebaseWebConfigured } from "@/lib/firebase/client";

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

export function subscribeAuth(cb: (user: User | null) => void): () => void {
  const auth = getClientAuth();
  if (!auth) {
    cb(null);
    return () => undefined;
  }
  return onAuthStateChanged(auth, cb);
}

export async function signInWithGoogle(opts?: {
  /** Prefer redirect on mobile / popup-blocked environments */
  redirect?: boolean;
}): Promise<User | null> {
  const auth = getClientAuth();
  if (!auth) {
    throw new Error(
      "Firebase Auth is not configured. Set NEXT_PUBLIC_FIREBASE_* in .env"
    );
  }
  if (opts?.redirect) {
    await signInWithRedirect(auth, googleProvider);
    return null;
  }
  const cred = await signInWithPopup(auth, googleProvider);
  return cred.user;
}

export async function completeGoogleRedirect(): Promise<User | null> {
  const auth = getClientAuth();
  if (!auth) return null;
  const result = await getRedirectResult(auth);
  return result?.user ?? null;
}

export async function signOut(): Promise<void> {
  const auth = getClientAuth();
  if (!auth) return;
  await firebaseSignOut(auth);
}

export { isFirebaseWebConfigured };
export type { User };
