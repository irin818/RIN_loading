# RIN Python Parity Matrix

Status: initialized for Package 0.

| Capability | TypeScript Reference | Python Status | Parity Test | Result | Production Ready |
|---|---|---|---|---|---|
| manifest | `src/storage` | read-only parser added | Package 1 synthetic round-trip; Package 2 synthetic read-only fixture | passed | no |
| core config files | `src/storage` | read-only inspection added | Package 1 synthetic round-trip; Package 2 synthetic read-only fixture | passed | no |
| profile loading | `src/profile` | read-only loader/report added | Package 1 synthetic round-trip; Package 2 synthetic read-only fixture | passed | no |
| database inspection | `src/database` | read-only repository added | Package 3 synthetic SQLite fixture/hash check | passed | no |
| conversations | `src/conversation` | read-only listing/lookup added | Package 1 synthetic round-trip; Package 3 SQLite fixture | passed | no |
| messages | `src/conversation` | read-only listing added | Package 1 synthetic round-trip; Package 3 SQLite fixture | passed | no |
| Memory V2 schema | `src/memory/v2Schema.ts` | schema report contract + trace reads added | Package 1 synthetic round-trip; Package 3 SQLite fixture | passed | no |
| Memory V2 scoring | `src/memory/v2Engine.ts` | pure analyzer added | Package 4 built-in fixture parity and repeated deterministic run | passed | no |
| short-term memory | `src/memory` short-term report | trace contract/token helpers added | Package 1 synthetic round-trip; Package 4 token fixtures | passed | no |
| Context V2 | `src/context/contextV2.ts` | pure report builder added | Package 1 synthetic round-trip; Package 5 built-in fixture parity and repeated deterministic run | passed | no |
| Ollama request | `src/model/ollamaAdapter.ts` | mocked adapter added | Package 6 mocked request/response tests | passed | no |
| response sanitizer | `src/model` daily chat quality | thinking strip/empty-content handling added | Package 6 mocked error/sanitizer tests | passed | no |
| temp write repository | `src/database`, runtime persistence | guarded temp-only writes added | Package 7 synthetic write tests + readonly summaries | passed | no |
| structured errors | `src/model`, `src/conversation/errors.ts` | error contracts added | Package 1 synthetic round-trip | passed | no |
| conversation runtime | `src/conversation/runtime.ts` | temp-only candidate added | Package 8 mock runtime tests + TS runtime report | passed | no |
| audit events | `src/database`, `src/conversation` | safe summaries and temp writes added | Package 3 audit summary tests; Package 7 temp audit tests | passed | no |
| readiness | `src/readiness` | foundation + TS readiness contract | Package 0 provider-free readiness; Package 1 synthetic round-trip | passed | no |
| local API | `src/server` | local-only FastAPI app factory added | Package 9 API contract tests + TS v2 check | passed | no |
| candidate validation | full RIN v2 checks | candidate docs and validation tests added | Package 10 repeated Python/TS checks + copied-data hash check | passed | no |
| timing metrics | `src/conversation/runtimeReport.ts` | safe runtime elapsed result added | Package A runtime tests | passed | no |
| preview mode | n/a production TypeScript launcher | temp-only Python preview added | Package B preview smoke tests | passed | no |
| copied-data shadow validation | read-only owner data inspection | copy-first shadow report added | Package C synthetic hash/copy tests | passed | no |
| migration dry-run | TypeScript remains production reference | copy-only dry-run added, no apply path | Package D synthetic dry-run tests | passed | no |
| rollback rehearsal | TypeScript rollback path | copy-only rehearsal added | Package D rollback tests | passed | no |
| Console API contract | `src/server/localConsoleServer.ts` | preview-compatible `/api` aliases added | Package E API contract check | passed | no |
| final candidate validation | full RIN v2 + Python post-candidate gates | A-F complete for review | Package F repeated Python/TS checks | passed | no |
| main integration audit | TypeScript default runtime | preview-only merge audit added | Package A main-integration audit | passed | no |
| final pre-merge verification | full Python + TypeScript preview-only gates | PR #72 ready for preview-only review | Package D repeated checks and safety scans | passed | no |

Package 0 creates only foundation checks and safety scaffolding. It does not
claim behavioral parity for migrated TypeScript core capabilities. The Package 0
parity placeholder and provider-free Python readiness checks pass on Python
3.12.13.

Package 1 adds Pydantic contracts and synthetic fixture validation only. It does
not claim behavioral parity for loaders, repositories, algorithms, providers, or
runtime execution.

Package 2 adds read-only storage/profile compatibility over synthetic
`/tmp/rin-python-*` fixtures. It does not write production data and does not
claim database repository parity.

Package 3 adds read-only SQLite repository compatibility over synthetic
`/tmp/rin-python-*` fixtures. It verifies that inspection leaves the database
file hash unchanged.

Package 4 adds pure Memory V2 algorithms and deterministic token helpers. It
does not write Memory V2 traces or mutate accepted memory records.

Package 5 adds pure Context V2 report assembly. It does not change production
context injection or read/write runtime data.

Package 6 adds a Python Ollama adapter over mocked tests only by default. Live
Ollama smoke remains explicit and skipped unless selected by environment.

Package 7 adds write support only for guarded synthetic/temp layouts. Production
`.rin-data` is rejected by every write entry point and there is no override.

Package 8 adds a candidate runtime path for synthetic/temp layouts. It preserves
owner messages on model failure, writes no fake reply, and does not replace the
TypeScript production runtime.

Package 9 adds a local-only FastAPI compatibility layer. It is not connected to
production launchers and rejects write routes outside guarded temp layouts.

Package 10 validates the candidate for review only. It does not approve
production cutover, launcher switching, real-data writes, or TypeScript removal.

Package A audits the candidate and closes low-risk gaps only. Timing metrics are
safe elapsed runtime result fields, not durable production timing events.

Package B adds manual preview mode only. It uses `/tmp/rin-python-preview-*`,
binds to localhost, and leaves TypeScript launchers unchanged.

Package C copies owner data to `/tmp/rin-python-shadow-*` before Python
inspection or write simulation and verifies the source DB hash is unchanged.

Package D adds dry-run and rollback rehearsal commands only. There is no
production migration apply path.

Package E adds enough Console-shaped API aliases for preview contract checks on
synthetic temp data. It does not modify the React Console or production server.

Package F completes final candidate revalidation for review only. Production
readiness remains `no` until owner approval for cutover, launcher switch,
real-data migration, and TypeScript Core removal.

Package A for main integration confirms PR #72 is preview-only and non-invasive.
Production readiness remains `no`.

Package D final pre-merge verification repeats Python candidate checks, full
Python gates, temp-data TypeScript checks, copied-data shadow validation,
migration dry-run, rollback rehearsal, API contract check, and safety scans.
Production readiness remains `no` because cutover is still not approved.
