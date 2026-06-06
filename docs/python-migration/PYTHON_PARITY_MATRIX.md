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
| audit events | `src/database`, `src/conversation` | not started | pending Package 3/7/8 | pending | no |
| readiness | `src/readiness` | foundation + TS readiness contract | Package 0 provider-free readiness; Package 1 synthetic round-trip | passed | no |
| local API | `src/server` | not started | pending Package 9 | pending | no |

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
