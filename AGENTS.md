# AGENTS.md: Code Quality Standards

## Guiding Principles

Write **idiomatic, performant, secure code that speaks for itself.**

- **Modern & Idiomatic:** Follow language conventions. Rust: leverage the type system. Vue: use Composition API patterns.
- **Maintainable:** Code should be obvious to the next developer. Minimize comments—only explain *why*, never what.
- **Performant:** Avoid unnecessary allocations, blocking operations, database queries. Profile before optimizing.
- **Secure:** Tenant isolation, CSRF validation, encryption, input validation happen implicitly through the architecture.
- **Simple:** Prefer clarity over cleverness. One responsibility per function.

---

## Rust Backend

**Compile-time verification always:**
- Use `sqlx::query!()` and `sqlx::query_as!()` with `!`—queries checked at compile time
- Never `sqlx::query()` without `!`
- Run `cargo sqlx prepare` after any query change

**Type safety first:**
- Leverage Rust's type system. Use newtypes for IDs (`struct UserId(i64)`)
- Extract early, fail loudly. Invalid state should be unrepresentable

**Async & Blocking:**
- Async-all-the-way in handlers
- CPU-bound work (scrypt, hashing) → `tokio::task::spawn_blocking`
- Never block the executor

**Error handling:**
- Return `Result` types. Map errors to `AppError`
- No panics in production code
- Error messages should help debugging without leaking internals

**Performance:**
- Minimize database round-trips. Batch queries when sensible
- Avoid `clone()` in hot paths. Use references
- Log sparingly; `tracing::` at critical points only

---

## Vue 3 Frontend

**Composition API patterns:**
- Extract logic into composables. Keep components thin
- Use `ref()`, `computed()`, `watch()` idiomatically
- State in Pinia stores; UI logic in composables

**Types everywhere:**
- Full TypeScript coverage. No `any`
- Types document intent better than comments

**Minimal re-renders:**
- Use `v-memo`, computed properties. Avoid watchers when possible
- Lazy-load heavy components

**Style consistency:**
- Follow existing conventions in the codebase
- Use TailwindCSS utilities; minimal custom CSS
- No magic numbers in styles

**Vue Router:**
- Adhere to Vue Router best practices in the frontend, specifically using named routes instead of hardcoded URLs.

**Error messages:**
- Only i18n texts reach the user. Never show the API's `error` text or `err.message`; they are English and meant for debugging. Use `apiErrorMessage(err, fallback)`, which also covers rate limits.
- Show a message for every user action that fails, and for loads that leave a view empty. Give a specific reason only when the user can act on it (wrong code, name taken, locked, too large); the API names such reasons with a `code`. Show nothing when the user cancelled (closed a dialog, declined to confirm, went back on Google).
- Wording: one or two short sentences ending with a period, second sentence only for what to do next. Failed actions read "Couldn't save the note." / "Die Notiz konnte nicht gespeichert werden." Field errors say what to do: "Enter a title." / "Gib einen Titel ein." No "please"/"bitte", no "error", "failed to", "request", "server" or "token". German uses "du".
- Keys live in an `errors` object of the section that owns the thing that failed, e.g. `tasks.notes.errors.save`, and are reused from anywhere. `common.errors` only holds messages that belong to no feature. Names: `<verb>[_<object>]` for failed actions (`load`, `delete_course`), `<field>_<problem>` for input (`title_missing`, `title_too_long`), the condition for API reasons (`name_taken`, `locked`). No `_failed`/`_error` suffixes, and nothing but errors inside `errors`.

---

## General

**Comments:** Write self-documenting code. Comment only:
- Non-obvious security decisions (e.g., why we use constant-time comparison)
- Performance trade-offs
- External constraints or specifications

**Naming:** Be explicit. `user_in_tenant()` not `check()`. Names are free.

**Testing:** Write tests for business logic. Skip boilerplate.

**Code Review:** Assume the reviewer wants to understand intent quickly.
