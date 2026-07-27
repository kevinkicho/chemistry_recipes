/**
 * Firebase Admin SDK — server-only (API routes, diagnostics, local troubleshooting).
 * Uses GOOGLE_APPLICATION_CREDENTIALS or default Application Default Credentials.
 *
 * Never import this file from client components.
 */

import "server-only";

import { existsSync, readFileSync } from "fs";
import path from "path";
import {
  initializeApp,
  getApps,
  cert,
  applicationDefault,
  type App,
  type ServiceAccount,
} from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getDatabase } from "firebase-admin/database";
import { getStorage } from "firebase-admin/storage";
import {
  getFirebaseAdminCredentialsPath,
  getFirebaseProjectId,
  getFirebaseWebConfig,
} from "@/lib/firebase/config";

function resolveCredentialsPath(raw: string): string {
  if (path.isAbsolute(raw)) return raw;
  // next.config loads monorepo root .env; process.cwd() is usually web/
  const candidates = [
    path.resolve(process.cwd(), raw),
    path.resolve(process.cwd(), "..", raw),
    // Conventional local path after moving keys out of repo root
    path.resolve(process.cwd(), "..", "secrets", "firebase", path.basename(raw)),
    path.resolve(process.cwd(), "secrets", "firebase", path.basename(raw)),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return candidates[0]!;
}

function loadServiceAccount(filePath: string): ServiceAccount {
  const json = JSON.parse(readFileSync(filePath, "utf8")) as {
    project_id?: string;
    projectId?: string;
    client_email?: string;
    clientEmail?: string;
    private_key?: string;
    privateKey?: string;
  };
  return {
    projectId: json.projectId || json.project_id,
    clientEmail: json.clientEmail || json.client_email,
    privateKey: json.privateKey || json.private_key,
  };
}

let adminApp: App | null = null;

/**
 * Initialize Admin app once. Safe to call repeatedly.
 * @throws if credentials cannot be resolved in local/dev without ADC.
 */
export function getAdminApp(): App {
  if (adminApp) return adminApp;
  if (getApps().length) {
    adminApp = getApps()[0]!;
    return adminApp;
  }

  const projectId = getFirebaseProjectId() || undefined;
  const storageBucket =
    getFirebaseWebConfig()?.storageBucket ||
    (projectId ? `${projectId}.firebasestorage.app` : undefined);
  const databaseURL =
    getFirebaseWebConfig()?.databaseURL ||
    (projectId ? `https://${projectId}-default-rtdb.firebaseio.com` : undefined);

  const credPath = getFirebaseAdminCredentialsPath();
  if (credPath) {
    const resolved = resolveCredentialsPath(credPath);
    if (!existsSync(resolved)) {
      throw new Error(
        `Firebase Admin credentials not found at ${resolved}. Set GOOGLE_APPLICATION_CREDENTIALS.`
      );
    }
    adminApp = initializeApp({
      credential: cert(loadServiceAccount(resolved)),
      projectId,
      storageBucket,
      databaseURL,
    });
    return adminApp;
  }

  // Cloud Run / App Hosting / Functions: ADC
  adminApp = initializeApp({
    credential: applicationDefault(),
    projectId,
    storageBucket,
    databaseURL,
  });
  return adminApp;
}

export function tryGetAdminApp(): { app: App | null; error?: string } {
  try {
    return { app: getAdminApp() };
  } catch (e) {
    return {
      app: null,
      error: e instanceof Error ? e.message : "Admin init failed",
    };
  }
}

export function getAdminAuth() {
  return getAuth(getAdminApp());
}

export function getAdminFirestore() {
  return getFirestore(getAdminApp());
}

export function getAdminDatabase() {
  return getDatabase(getAdminApp());
}

export function getAdminStorage() {
  return getStorage(getAdminApp());
}

/** Non-secret health snapshot for diagnostics. */
export async function probeFirebaseAdmin(): Promise<{
  ok: boolean;
  projectId: string | null;
  credentialsPathConfigured: boolean;
  credentialsFileExists: boolean | null;
  auth: { ok: boolean; detail?: string };
  firestore: { ok: boolean; detail?: string };
  error?: string;
}> {
  const credRaw = getFirebaseAdminCredentialsPath();
  let credentialsFileExists: boolean | null = null;
  if (credRaw) {
    credentialsFileExists = existsSync(resolveCredentialsPath(credRaw));
  }

  const { app, error } = tryGetAdminApp();
  if (!app) {
    return {
      ok: false,
      projectId: getFirebaseProjectId() || null,
      credentialsPathConfigured: Boolean(credRaw),
      credentialsFileExists,
      auth: { ok: false, detail: error },
      firestore: { ok: false, detail: error },
      error,
    };
  }

  const projectId = app.options.projectId ?? getFirebaseProjectId() ?? null;
  let authOk = false;
  let authDetail: string | undefined;
  let fsOk = false;
  let fsDetail: string | undefined;

  try {
    // Lightweight: list zero users (proves Auth Admin API + credentials)
    await getAuth(app).listUsers(1);
    authOk = true;
    authDetail = "listUsers ok";
  } catch (e) {
    authDetail = e instanceof Error ? e.message : "auth probe failed";
  }

  try {
    // Read a non-existent doc — proves Firestore reachability without writes
    await getFirestore(app).collection("_health").doc("ping").get();
    fsOk = true;
    fsDetail = "get ok";
  } catch (e) {
    fsDetail = e instanceof Error ? e.message : "firestore probe failed";
  }

  return {
    ok: authOk || fsOk,
    projectId,
    credentialsPathConfigured: Boolean(credRaw),
    credentialsFileExists,
    auth: { ok: authOk, detail: authDetail },
    firestore: { ok: fsOk, detail: fsDetail },
  };
}
