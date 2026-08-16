/**
 * Firebase Admin / config health for local troubleshooting.
 * Never returns private keys or full service-account JSON.
 */

import { NextResponse } from "next/server";
import {
  getFirebaseAdminCredentialsPath,
  getFirebaseProjectId,
  getFirebaseWebConfig,
  isFirebaseWebConfigured,
} from "@/lib/firebase/config";
import { probeFirebaseAdmin } from "@/lib/firebase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const web = getFirebaseWebConfig();
  const credPath = getFirebaseAdminCredentialsPath();
  const admin = await probeFirebaseAdmin();

  return NextResponse.json({
    projectId: getFirebaseProjectId() || null,
    client: {
      configured: isFirebaseWebConfigured(),
      authDomain: web?.authDomain ?? null,
      storageBucket: web?.storageBucket ?? null,
      hasDatabaseURL: Boolean(web?.databaseURL),
      hasApiKey: Boolean(web?.apiKey),
      hasAppId: Boolean(web?.appId),
      // never echo apiKey / appId full values in diagnostics beyond presence
      apiKeySuffix: web?.apiKey ? web.apiKey.slice(-6) : null,
    },
    admin: {
      credentialsPathConfigured: Boolean(credPath),
      // basename only — no absolute path secrets
      credentialsBasename: credPath
        ? credPath.replace(/^.*[\\/]/, "")
        : null,
      credentialsFileExists: admin.credentialsFileExists,
      probe: {
        ok: admin.ok,
        projectId: admin.projectId,
        auth: admin.auth,
        firestore: admin.firestore,
        error: admin.error ?? null,
      },
    },
    products: {
      auth: "Admin Auth (client sign-in chrome hidden)",
      firestore: "client + admin",
      rtdb: web?.databaseURL ? "configured" : "set NEXT_PUBLIC_FIREBASE_DATABASE_URL",
      storage: web?.storageBucket ? "configured" : "missing bucket",
      appHosting: "see firebase.json apphosting + web/apphosting.yaml",
      functions: "repo functions/ codebase",
    },
  });
}
