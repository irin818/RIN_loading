# RIN Python Parity Matrix

Status: initialized for Package 0.

| Capability | TypeScript Reference | Python Status | Parity Test | Result | Production Ready |
|---|---|---|---|---|---|
| manifest | `src/storage` | contract model added | Package 1 synthetic round-trip | passed | no |
| core config files | `src/storage` | model config contract added | Package 1 synthetic round-trip | passed | no |
| profile loading | `src/profile` | profile contracts added | Package 1 synthetic round-trip | passed | no |
| database inspection | `src/database` | not started | pending Package 3 | pending | no |
| conversations | `src/conversation` | record contracts added | Package 1 synthetic round-trip | passed | no |
| messages | `src/conversation` | record contracts added | Package 1 synthetic round-trip | passed | no |
| Memory V2 schema | `src/memory/v2Schema.ts` | schema report contract added | Package 1 synthetic round-trip | passed | no |
| Memory V2 scoring | `src/memory/v2Engine.ts` | not started | pending Package 4 | pending | no |
| short-term memory | `src/memory` short-term report | trace contract added | Package 1 synthetic round-trip | passed | no |
| Context V2 | `src/context/contextV2.ts` | report contract added | Package 1 synthetic round-trip | passed | no |
| Ollama request | `src/model/ollamaAdapter.ts` | not started | pending Package 6 | pending | no |
| response sanitizer | `src/model` daily chat quality | not started | pending Package 6 | pending | no |
| structured errors | `src/model`, `src/conversation/errors.ts` | error contracts added | Package 1 synthetic round-trip | passed | no |
| conversation runtime | `src/conversation/runtime.ts` | not started | pending Package 8 | pending | no |
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
