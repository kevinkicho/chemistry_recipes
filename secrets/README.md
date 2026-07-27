# Secrets (local only)

**Never commit credential files.**

## Firebase Admin SDK

1. Download a service-account JSON from Firebase Console → Project settings → Service accounts.
2. Place it here (gitignored):

```text
secrets/firebase/chemistryrecipes-firebase-adminsdk-….json
```

3. Point env at it:

```env
# repo root .env
GOOGLE_APPLICATION_CREDENTIALS=./secrets/firebase/chemistryrecipes-firebase-adminsdk-XXXX.json
FIREBASE_ADMIN_PROJECT_ID=chemistryrecipes

# web/.env.local (when cwd is web/)
GOOGLE_APPLICATION_CREDENTIALS=../secrets/firebase/chemistryrecipes-firebase-adminsdk-XXXX.json
```

4. Verify: `GET /api/diagnostics/firebase` (no private keys in response).

On **App Hosting / Cloud Run**, prefer Application Default Credentials — do **not** bake the JSON into the image. Set secrets via:

```bash
firebase apphosting:secrets:set …
```

See [docs/security.md](../docs/security.md).
