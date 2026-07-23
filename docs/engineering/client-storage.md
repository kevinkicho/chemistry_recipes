# Client storage

All browser storage is **single-device / local-first**. There is no multi-user sync server.

## IndexedDB — live dossiers

| | |
|--|--|
| **Module** | `lib/idb/dossierCache.ts` |
| **DB name** | `chemistry-recipes-v1` |
| **Store** | `dossiers` (keyPath `cid`) |
| **Schema version** | Bumped when pipeline quality changes (stale rows ignored) |

APIs: `getCachedDossier`, `putCachedDossier`, `deleteCachedDossier`, `listCachedDossiers`,  
`probeIdbHealth`, `clearAllDossierCache`.

### Health probe

`probeIdbHealth()` reports:

- open / read / write success  
- current vs stale schema counts  
- oldest / newest cache ages  

Surfaced on `/diagnostics` with **Clear dossier cache**.

## IndexedDB — snapshots

| | |
|--|--|
| **Module** | `lib/idb/dossierSnapshots.ts` |
| **DB name** | `chemistry-recipes-snapshots-v1` |
| **Purpose** | Last N builds per CID for audit / restore UI |

## localStorage

| Key / area | Contents |
|------------|----------|
| AI config | Provider, host, models, optional API key |
| Search history | Recent queries / CID visits |
| Workspace projects | Pins, notes (exportable JSON) |

## Compare page dependency

`/compare` metrics and dual export read **cached** live dossiers. Users must open each CID once before full side-by-side metrics.

## Privacy notes

- Caches may include AI-generated text and public literature titles.  
- Clearing site data removes keys and caches.  
- See [../security.md](../security.md).  
