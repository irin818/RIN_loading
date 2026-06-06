# RIN Python Data Contracts

Status: Package 1 contract note.

## Scope

Package 1 introduces Pydantic models for TypeScript-compatible JSON and record
shapes. These models are data contracts only. They do not open databases, call
model providers, mutate profiles, write files, or access production `.rin-data`.

Covered contracts:

- data manifest
- model runtime config
- RIN and Owner profiles
- profile reports
- conversation, message, and turn records
- Memory V2 schema and analysis records
- memory injection traces
- Context V2 reports
- model request/response records
- structured conversation errors
- readiness reports

## Compatibility Notes

- Compatibility-required TypeScript field names are preserved, including
  camelCase names such as `schemaVersion`, `ownerId`, and `providerCallCount`.
- Required TypeScript `null` values remain nullable in Python models.
- Optional TypeScript fields are represented as `None` in Python and should be
  serialized with `exclude_none=True` when an API response needs to mimic
  JavaScript `undefined` omission.
- Pydantic models use strict `extra="forbid"` validation so accidental fields do
  not silently enter the Python candidate.

## Parity Status

Package 1 validates synthetic, non-private fixtures with round-trip tests and
invalid-input tests. Behavioral parity for storage, database, Memory V2, Context
V2, model adapters, and runtime logic begins in later packages.
