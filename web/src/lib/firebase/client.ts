/**
 * Firebase client SDK (browser + optional server components that only need web API).
 * Products: Auth, Firestore, Realtime Database, Storage.
 */

import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getDatabase, type Database } from "firebase/database";
import { getStorage, type FirebaseStorage } from "firebase/storage";
import { getFirebaseWebConfig, isFirebaseWebConfigured } from "@/lib/firebase/config";

let appSingleton: FirebaseApp | null = null;

export function getFirebaseApp(): FirebaseApp | null {
  if (!isFirebaseWebConfigured()) return null;
  if (appSingleton) return appSingleton;
  const config = getFirebaseWebConfig();
  if (!config) return null;
  appSingleton = getApps().length ? getApp() : initializeApp(config);
  return appSingleton;
}

export function getClientAuth(): Auth | null {
  const app = getFirebaseApp();
  return app ? getAuth(app) : null;
}

export function getClientFirestore(): Firestore | null {
  const app = getFirebaseApp();
  return app ? getFirestore(app) : null;
}

/** Realtime Database — requires NEXT_PUBLIC_FIREBASE_DATABASE_URL when non-default. */
export function getClientRtdb(): Database | null {
  const app = getFirebaseApp();
  if (!app) return null;
  const url = getFirebaseWebConfig()?.databaseURL;
  return url ? getDatabase(app, url) : getDatabase(app);
}

export function getClientStorage(): FirebaseStorage | null {
  const app = getFirebaseApp();
  return app ? getStorage(app) : null;
}

export { isFirebaseWebConfigured };
