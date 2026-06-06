# RIN Python Parity Matrix

Status: initialized for Package 0.

| Capability | TypeScript Reference | Python Status | Parity Test | Result | Production Ready |
|---|---|---|---|---|---|
| manifest | `src/storage` | not started | pending Package 1/2 | pending | no |
| core config files | `src/storage` | not started | pending Package 2 | pending | no |
| profile loading | `src/profile` | not started | pending Package 1/2 | pending | no |
| database inspection | `src/database` | not started | pending Package 3 | pending | no |
| conversations | `src/conversation` | not started | pending Package 1/3/8 | pending | no |
| messages | `src/conversation` | not started | pending Package 1/3/8 | pending | no |
| Memory V2 schema | `src/memory/v2Schema.ts` | not started | pending Package 1/3 | pending | no |
| Memory V2 scoring | `src/memory/v2Engine.ts` | not started | pending Package 4 | pending | no |
| short-term memory | `src/memory` short-term report | not started | pending Package 4 | pending | no |
| Context V2 | `src/context/contextV2.ts` | not started | pending Package 5 | pending | no |
| Ollama request | `src/model/ollamaAdapter.ts` | not started | pending Package 6 | pending | no |
| response sanitizer | `src/model` daily chat quality | not started | pending Package 6 | pending | no |
| structured errors | `src/model`, `src/conversation/errors.ts` | not started | pending Package 1/6/8 | pending | no |
| conversation runtime | `src/conversation/runtime.ts` | not started | pending Package 8 | pending | no |
| audit events | `src/database`, `src/conversation` | not started | pending Package 3/7/8 | pending | no |
| readiness | `src/readiness` | foundation only | Package 0 provider-free readiness | passed | no |
| local API | `src/server` | not started | pending Package 9 | pending | no |

Package 0 creates only foundation checks and safety scaffolding. It does not
claim behavioral parity for migrated TypeScript core capabilities. The Package 0
parity placeholder and provider-free Python readiness checks pass on Python
3.12.13.
