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

**File organization (`app/src`):**

Every file has one owner, and its location and name say who that is and what kind of file it is. Ask "which feature is this about?" before "who uses it?".

```
src/
  main.ts  App.vue
  api/        transport every request shares: client, error mapping, reauth hook, file storage, groupPath
  i18n/  router/  assets/
  common/     domain-free building blocks: no imports from shell/ or modules/, no feature i18n keys
    components/  Base* design-system components, registered globally
    composables/ utils/ types.ts
  shell/      the frame around every page: layouts, header, sidebar, tab bar, modal host, not-found page
    components/ composables/ pages/ stores/ utils/
  modules/<feature>/   everything one feature owns
    pages/ components/ composables/ stores/ utils/ types.ts
```

- Modules: `account` (the signed-in user: settings, preferences, profile), `admin` (platform admin), `announcements`, `auth` (session, sign-in and sign-up, MFA, reauth), `courses` (subjects, courses, enrollment and course setup), `dashboard`, `groups` (membership, the group on screen, permissions, invites, group settings), `schedule`, `search`, `tasks` (group tasks), `todos` (private todos).
- A file lives in the module that owns its concept, even when other modules use it more; they import it from there. Domain-bound code never moves to `common/` (task swipe actions stay in `tasks`, `todos` imports them).
- Domain-free code lives in its only module until a second module needs it; then it moves to `common/`. Base components are the exception: every generic UI primitive is a `Base*` component in `common/components`, however many modules use it.
- Only the folders a module needs exist, and they stay flat: no subfolders inside `components/`, `composables/` and so on. Related files group through their name prefix instead.
- Import a file in the same folder with `./`, everything else with `@/`; never `../`. No barrel `index.ts` files.

**What gets its own file:**
- A component file for: every route (page or layout); every component used in more than one place; every modal, menu or sheet; and every part of a page that stands on its own, with a name a reader would look for (a settings tab, a dashboard section, a card, a row, a toolbar) and its data passed in as props or loaded by itself. A few lines of markup, or a fragment that only works with its parent's state, stay in the parent. Length alone is no reason to split a cohesive component.
- A composable for stateful logic: reactivity, lifecycle, provide/inject, a store. One concern per composable; a composable may combine others.
- A util for logic without Vue: calculations, mapping API data, formatting. Move pure logic that is longer than a few lines out of components and composables into `utils/` and test it there.
- One store per file. Types shared within a module go in its `types.ts`; a type used by one file stays in that file.
- Group functions by concept, not one function per file, and never into grab-bag files (`helpers.ts`, `misc.ts`). A file that only wraps a few lines for one consumer belongs in that consumer.
- Delete what nothing imports.

**Naming:**
- Components: PascalCase, at least two words, file name = component name. They start with their owner: `Base` in `common/`, `App` in `shell/`, the module's name in singular in a module (`Task`, `Todo`, `Group`, `Course`, `Account`, `Auth`, `Admin`, `Announcement`, `Dashboard`, `Schedule`, `Search`). Then general to specific, so related files sort together: `GroupSettingsMembers`, `GroupSettingsMembersInvites`, `AccountMenuTheme`.
- Suffixes say the role: `*Page` for a route without child routes, `*Layout` for a route that frames child routes (both only in `pages/`), `*Modal` for a component that is a modal (its root is `BaseModal` or another modal), `*Menu` for a floating menu, `*Form` for an inline form. Nothing else in `pages/`.
- Base components are never imported; they are registered globally. Every other component is imported explicitly.
- Composables: `use<Thing>.ts` exporting `use<Thing>`, plus the types and constants that belong to it. A function without reactivity, lifecycle or injection is not a composable: it goes to `utils/` without the `use` prefix.
- Stores: Pinia setup stores in `stores/`, one per file, named after the store: `useUserStore.ts`. A store that only opens one modal is `use<Name>Modal` (`useTaskFormModal`).
- Utils: camelCase file named after the concept (`dueDate.ts`, `invites.ts`), tests beside them (`dueDate.test.ts`).
- Types: a module's shared types in `types.ts`; `common/types.ts` only for domain-free shapes.
- No kebab-case or snake_case `.ts`/`.vue` file names, except names a tool requires (`vite-env.d.ts`). Route names stay kebab-case (`group-tasks`).

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

**Success messages and notices:**
- An action that worked is silent by default: the changed screen is the confirmation. Deleting, saving, toggling or adding something that then shows (or disappears) on screen gets no toast.
- Confirm success only when the user cannot see the result: it is off screen (copied to the clipboard, reported, an email sent, a task added from a form opened outside its list) or the action took them away from it (password changed, group or account deleted). A copy button that turns into a check mark needs no toast either.
- A notice (info or warning) only tells the user something unexpected they should know or act on: why they were redirected, that they must repeat an action, that recovery codes are running low.
- Wording: the fact in past tense, then at most one sentence on what to do next. "Link copied." / "Link kopiert." No "successfully"/"erfolgreich", no exclamation marks.
- Keys mirror errors: `<section>.success.<verb>[_<object>]`, using the same name as the matching error (`tasks.errors.report` / `tasks.success.report`), and `<section>.notices.<condition>` (`groups.notices.already_member`).

**Button labels:**
- English labels on buttons, menu items and dialog submit actions use title case: "Delete Task", "Sign In with Google", "Use a Code from the Authenticator App". Articles, coordinating conjunctions and prepositions stay lowercase unless first or last; verb particles are capitalized ("Set Up", "Sign Out", "Move Up"). German keeps normal German capitalization.

---

## General

**Comments:** Write self-documenting code. Comment only:
- Non-obvious security decisions (e.g., why we use constant-time comparison)
- Performance trade-offs
- External constraints or specifications

**Naming:** Be explicit. `user_in_tenant()` not `check()`. Names are free.

**Testing:** Write tests for business logic. Skip boilerplate.

**Code Review:** Assume the reviewer wants to understand intent quickly.
