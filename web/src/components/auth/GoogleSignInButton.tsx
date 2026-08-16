"use client";

/**
 * Hidden until sign-in gates something local-first-safe.
 * Google identity is unused (nothing else reads uid; Firestore is deny-all).
 * NEXT_PUBLIC_FIREBASE_* alone is not a reason to show header chrome.
 */
export function GoogleSignInButton() {
  return null;
}
