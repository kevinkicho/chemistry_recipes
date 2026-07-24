/**
 * Firebase web + admin config from environment variables.
 * Client values must use NEXT_PUBLIC_* so the browser bundle can read them.
 * Admin credentials stay server-only (never NEXT_PUBLIC_).
 */

export type FirebaseWebConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  databaseURL?: string;
};

function trim(v: string | undefined): string {
  return (v ?? "").trim();
}

/** True when minimum web app fields are present. */
export function isFirebaseWebConfigured(): boolean {
  return Boolean(
    trim(process.env.NEXT_PUBLIC_FIREBASE_API_KEY) &&
      trim(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) &&
      trim(process.env.NEXT_PUBLIC_FIREBASE_APP_ID)
  );
}

/**
 * Client / shared web config. Returns null if not configured
 * (local-only workspaces without Firebase).
 */
export function getFirebaseWebConfig(): FirebaseWebConfig | null {
  if (!isFirebaseWebConfigured()) return null;

  const databaseURL = trim(process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL);
  return {
    apiKey: trim(process.env.NEXT_PUBLIC_FIREBASE_API_KEY),
    authDomain:
      trim(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN) ||
      `${trim(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID)}.firebaseapp.com`,
    projectId: trim(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID),
    storageBucket:
      trim(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET) ||
      `${trim(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID)}.appspot.com`,
    messagingSenderId: trim(process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID),
    appId: trim(process.env.NEXT_PUBLIC_FIREBASE_APP_ID),
    ...(databaseURL ? { databaseURL } : {}),
  };
}

/** Project id for Admin / App Hosting diagnostics. */
export function getFirebaseProjectId(): string {
  return (
    trim(process.env.FIREBASE_ADMIN_PROJECT_ID) ||
    trim(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) ||
    trim(process.env.GCLOUD_PROJECT) ||
    trim(process.env.GOOGLE_CLOUD_PROJECT) ||
    ""
  );
}

/**
 * Path to service-account JSON for local Admin SDK.
 * Prefer GOOGLE_APPLICATION_CREDENTIALS (standard ADC).
 */
export function getFirebaseAdminCredentialsPath(): string | null {
  const p =
    trim(process.env.GOOGLE_APPLICATION_CREDENTIALS) ||
    trim(process.env.FIREBASE_ADMIN_CREDENTIALS);
  return p || null;
}
