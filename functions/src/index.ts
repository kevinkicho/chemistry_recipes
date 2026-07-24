/**
 * Cloud Functions for Chemistry Recipes (project: chemistryrecipes).
 *
 * On deploy, Admin uses Application Default Credentials automatically.
 * For local emulator: set GOOGLE_APPLICATION_CREDENTIALS to the gitignored
 * service-account JSON at the repo root (see root `.env`).
 *
 * Web app (Auth / Firestore / RTDB / Storage) lives under `web/` and uses
 * NEXT_PUBLIC_FIREBASE_* from `.env`. App Hosting rootDir is `web`.
 */

import {setGlobalOptions} from "firebase-functions";
import {onRequest} from "firebase-functions/https";
import * as logger from "firebase-functions/logger";
import {initializeApp, getApps} from "firebase-admin/app";

// For cost control, set max containers per function (Blaze plan).
setGlobalOptions({maxInstances: 10, region: "us-central1"});

if (!getApps().length) {
  initializeApp();
}

/** Lightweight health for deploy / emulator smoke tests. */
export const health = onRequest((request, response) => {
  logger.info("health", {path: request.path});
  response.json({
    ok: true,
    service: "chemistryrecipes-functions",
    ts: new Date().toISOString(),
  });
});
