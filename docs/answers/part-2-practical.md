# Part 2 — Practical case

**Repository:** https://github.com/phscezario/artefact-selective-process

---

## 1. What I built

A task manager that covers the full CRUD of the case, with the list page rendered on the server and
an infinite-scroll bonus. Every screen is in English, all data is fictional, and the repository runs
with two commands (`npm install && npm run dev`).

| Layer         | Choice                                            | Version       |
| ------------- | ------------------------------------------------- | ------------- |
| Framework     | Next.js (App Router, Server Components)           | 15.5          |
| UI            | React / React DOM                                 | 19.3          |
| API           | tRPC + TanStack React Query integration           | 11.27 / 5.107 |
| Validation    | Zod (one schema shared by API and form)           | 4.6           |
| Serialization | superjson (`Date` survives the wire)              | 2.2           |
| Tests         | Vitest                                            | 3.2           |
| Language      | TypeScript, `strict` + `noUncheckedIndexedAccess` | 5.9           |
| Monorepo      | npm workspaces                                    | npm 10        |

The case asked for `id`, `titulo` (required), `descricao` (optional) and `dataCriacao`. I kept those
names exactly as specified and added one optional field, `status` (`todo` / `in_progress` / `done`),
because the brief also asked for visual feedback: status is what the badge in each row shows. It
defaults to `todo`, so a payload with only the required fields still works.

---

## 2. Architecture

```
┌───────────────────────────────────────────────────────────────────────────┐
│ frontend/  — Next.js 15, App Router                                       │
│                                                                           │
│  app/page.tsx              server component: prefetch + HydrateClient      │
│  app/tasks/new             server component: renders the form shell        │
│  app/tasks/[id]/edit       server component: caller.tasks.getById          │
│  components/task-list      client: useInfiniteQuery + delete mutation      │
│  components/task-form      client: useTaskForm + create/update mutation    │
│  app/api/trpc/[trpc]       route handler: the only HTTP surface            │
└──────────────────────────────────┬────────────────────────────────────────┘
                                   │ imports the workspace package
┌──────────────────────────────────▼────────────────────────────────────────┐
│ backend/  — @artefact/backend (no Next.js dependency)                     │
│                                                                           │
│  router.ts                 appRouter: tasks + health                       │
│  trpc.ts                   initTRPC, superjson, errorFormatter, timing     │
│  context.ts                per-request context, repository injection       │
│  modules/tasks/                                                           │
│    task.schema.ts          Zod inputs, limits and domain types            │
│    task.router.ts          list / getById / create / update / delete       │
│    task.repository.ts      TaskRepository port + in-memory adapter         │
│    task.seed.ts            24 fictional tasks                              │
└───────────────────────────────────────────────────────────────────────────┘
```

The important decision is that **the backend is a package, not a process**. It exposes a tRPC router,
the Zod schemas and a `TaskRepository` interface, and it knows nothing about Next.js. The frontend
mounts it on a single route handler using the fetch adapter, and the server components call the same
router **in-process** — no HTTP round trip from the server to its own API.

That gives three things at once: one command to run and one container to deploy, no duplicated
contract between client and server, and a real boundary. Swapping the in-memory adapter for Postgres
is a new class implementing `TaskRepository`; moving the API to Fastify is a new adapter. Neither
touches the domain or the UI.

---

## 3. API and validation

Single endpoint: `POST|GET /api/trpc/*`.

| Procedure       | Type     | Input                                                       | Errors                     |
| --------------- | -------- | ----------------------------------------------------------- | -------------------------- |
| `tasks.list`    | query    | `{ limit: 1..50, cursor?: string }`                         | `BAD_REQUEST`              |
| `tasks.getById` | query    | `{ id }`                                                    | `NOT_FOUND`                |
| `tasks.create`  | mutation | `{ titulo, descricao?, status? }`                           | `BAD_REQUEST`              |
| `tasks.update`  | mutation | `{ id, titulo?, descricao?, status? }` (at least one field) | `BAD_REQUEST`, `NOT_FOUND` |
| `tasks.delete`  | mutation | `{ id }`                                                    | `NOT_FOUND`                |
| `health`        | query    | —                                                           | —                          |

Validation rules live in one place (`task.schema.ts`) and are enforced **twice for free**: the form
runs `createTaskInput.safeParse` on the client, and the procedure runs the same schema on the server.
Title is trimmed, required and capped at 120 characters; description is trimmed, capped at 1.000 and
an empty string is normalised to `null`, so the domain has one representation for "no description"
instead of three (`''`, `'  '`, `null`).

Errors are meaningful instead of generic. The `errorFormatter` adds a `fieldErrors` map when the
cause is a `ZodError`, so a rejected field comes back as
`{ titulo: "Title is required." }` and the form can highlight exactly that input. Stacks are kept in
development and stripped in production. A missing task returns `NOT_FOUND` with a message that says
what happened ("it may have been deleted by someone else"), which is also what the edit page uses to
render the `not-found` route.

`dataCriacao` is a real `Date` on both sides. The superjson transformer handles the HTTP payload and
the RSC dehydration, so the component never parses an ISO string by hand.

**Pagination.** `tasks.list` is keyset-based: `nextCursor` is the id of the last item of the page and
the next page starts after it. Offset pagination (`skip/take`) silently skips a row when something
is deleted between two requests, which is exactly the case here since delete is a first-class
feature. With a cursor, the only consequence is that a cursor pointing at a deleted task restarts
from the first page.

---

## 4. Server-side rendering, step by step

This is the flow of the list page (`GET /`):

1. Next renders `app/page.tsx` as a Server Component. The route declares
   `export const dynamic = 'force-dynamic'`, because the store is in memory and changes on every
   mutation — without it Next would keep the HTML generated at build time and the page would be
   stale after the first delete.
2. The page calls `getQueryClient().prefetchInfiniteQuery(trpc.tasks.list.infiniteQueryOptions(...))`.
   `getQueryClient` is wrapped in React `cache`, so the page and any nested component share one
   `QueryClient` per request. The router executes in-process.
3. `HydrateClient` dehydrates that cache and wraps the client tree in `HydrationBoundary`.
4. The HTML that reaches the browser already contains the tasks, with the status badge and the
   formatted creation date. The first paint does not wait for JavaScript and does not wait for a
   client fetch.
5. On the client, `TaskList` calls the same `infiniteQueryOptions`. React Query finds the hydrated
   data, so the first client render matches the server markup and there is no refetch on mount
   (`staleTime: 30s`, `refetchOnWindowFocus: false`).
6. Mutations (create, update, delete) go through `/api/trpc` and invalidate
   `trpc.tasks.list.infiniteQueryKey(...)`, which refetches every cached page and keeps the list —
   and its `total` — correct.

I also avoided a hydration trap on purpose: dates are formatted with a fixed `en-US` locale and
`timeZone: 'UTC'`. A locale-dependent string would render differently on the server and in the
browser and produce a hydration mismatch for anyone outside UTC.

The create form is a client component rendered by a server page; the edit page fetches the task on
the server (`caller.tasks.getById`) and passes the values as `initialValues`. If the task disappeared
between the click and the render, the page calls `notFound()` instead of crashing.

---

## 5. Behaviour and UX

**List.** Title, description, status badge and creation date, newest first, eight per page.

- _Infinite scroll_: an `IntersectionObserver` watches a sentinel at the end of the list with
  `rootMargin: '240px'`, so the next page starts loading before the user hits the bottom. The
  sentinel only exists while `hasNextPage` is true; when the last page arrives it is replaced by
  "You have reached the end of the list." The observer is recreated when the fetching state changes
  to avoid stacking duplicate requests.
- _Loading_: `app/loading.tsx` renders skeleton rows during navigation, and the infinite scroll has
  its own inline spinner with "Loading more tasks…".
- _Empty_: a dedicated empty state with a call to action, instead of a blank list.
- _Failure_: the list has an error state with the normalised message and a "Try again" button.
- _Delete_: a two-step inline confirmation (no `window.confirm`), per-row pending state
  ("Deleting…"), a success toast, an error toast if the API rejects, and query invalidation on
  success. The confirmation is scoped to one row, so the list never blocks.

**Create and edit.** One `TaskForm` component in two modes, with plain React hooks (`useTaskForm`)
instead of a form library: values, per-field errors and the submitting flag.

- Client validation on submit using the same Zod schema as the API, with `aria-invalid` and
  `aria-describedby` pointing at the error text.
- If the server rejects a field the client accepted, the `fieldErrors` from the tRPC error are merged
  back into the form, so the rule stays authoritative on the server but the UX stays specific.
- Loading state on the button ("Saving…", `aria-busy`), success toast, cache invalidation, redirect
  to the list.
- Character counter for the description and `maxLength` on both fields.
- `useId()` for input ids, so labels stay correctly associated without global ids.

Accessibility details included: semantic landmarks, a visible focus ring, `role="alert"` on field
errors, `aria-live` on the toast stack, `prefers-reduced-motion` support and a responsive layout that
stacks the row actions under the text on small screens.

---

## 6. Screenshots

![Task list rendered on the server with the 24 seeded tasks.](../screenshots/01-task-list.png)

_Figure 1 — the list page is server-rendered: the first response already contains the tasks._

![Create form after submitting an empty title.](../screenshots/02-validation.png)

_Figure 2 — client validation with the shared schema: field error under the input and an error toast._

![Edit form prefilled by the server component.](../screenshots/03-edit-form.png)

_Figure 3 — edit mode: values come from the server, the mutation happens on the client._

![Inline delete confirmation on the first row.](../screenshots/04-delete-confirmation.png)

_Figure 4 — delete asks for confirmation inside the row, without a browser dialog._

![Success toast after deleting a task.](../screenshots/05-delete-success.png)

_Figure 5 — success feedback plus list invalidation; the total is updated._

![Mobile layout at 414px wide.](../screenshots/06-mobile.png)

_Figure 6 — responsive layout: actions move below the task text._

---

## 7. Tests and verification

```bash
npm run verify   # eslint -> tsc -> vitest -> next build
```

The backend has **10 unit tests** running against the real router with an injected repository — no
HTTP, no mocks of the code under test:

1. create generates an id, trims the title and normalises a whitespace-only description to `null`;
2. empty title is rejected with `BAD_REQUEST`;
3. a title over the limit is rejected;
4. keyset pagination across three pages returns every item exactly once and ends with
   `nextCursor: null`;
5. an invalid page size is rejected;
6. update changes only the fields that were sent;
7. an empty string clears the description;
8. updating a missing task returns `NOT_FOUND`;
9. delete works once and returns `NOT_FOUND` the second time (and `getById` confirms it);
10. the seeded data satisfies the contract and keeps `dataCriacao` as a `Date`.

Beyond the unit tests, I validated the running production build:

- HTTP smoke test against `npm start`: create → read → update → list → delete → double delete →
  empty title. Confirmed trimmed title, description normalisation, `dataCriacao` arriving as a
  `Date`, `NOT_FOUND` on the second delete and `BAD_REQUEST` with `fieldErrors.titulo` on the empty
  title.
- SSR assertion: the raw HTML of `/` contains `<h3 class="task-title">Review the Q3 revenue
dashboard</h3>`, so the content is in the first response, not fetched afterwards.
- Infinite scroll driven by Chrome DevTools Protocol: 16 rows after hydration, 24 after scrolling,
  ending with "You have reached the end of the list." — i.e. all 24 seeded tasks load through
  pagination.

`npm run lint`, `npm run typecheck` and `npm test` are clean, which is the same gate the CI workflow
runs.

---

## 8. Running it

```bash
npm install
npm run dev        # http://localhost:3000
```

```bash
npm run build
npm start          # production build
```

```bash
docker compose up --build   # http://localhost:3000
```

```bash
npm run verify     # lint + typecheck + test + build
```

Docker uses a multi-stage build on `node:22-alpine`: dependencies, build, then a runtime image that
only contains the Next.js standalone output (`node frontend/server.js`). The image does not carry the
source, the dev dependencies or the npm cache.

CI (`.github/workflows/ci.yml`) runs the same steps on every push and pull request to `main`:
`npm ci` → `lint` → `typecheck` → `test` → `build`.

---

## 9. Trade-offs and next steps

| Decision                                 | Why                                                                         | Cost                                                                                       |
| ---------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Backend as a workspace package           | One deploy, no CORS, SSR calls the router in-process, domain still isolated | Not independently deployable today (but the router is transport-agnostic)                  |
| tRPC over REST                           | End-to-end types with no codegen; the schema is reused by the form          | Not consumable by non-TypeScript clients; one URL makes CDN caching per resource unnatural |
| Zod shared by client and server          | No rule drift between form and API                                          | The schema ships to the browser (~13 KB gzipped)                                           |
| superjson                                | `dataCriacao` stays a `Date`                                                | Small payload overhead                                                                     |
| Keyset pagination                        | Correct when a task is deleted between pages                                | Cursor is opaque to the UI                                                                 |
| In-memory repository behind an interface | The case does not need a database; the domain does not care                 | Data resets on restart; single instance only                                               |
| Hand-written CSS                         | No extra dependency or build step for a case this size                      | No utility classes for future screens                                                      |

What I would do with more time, in order of value: Postgres with a second `TaskRepository` (the
interface and the context injection already exist), authentication in `createContext` (it already
receives the request headers), per-procedure rate limiting, optimistic updates on delete, Playwright
covering the critical flow, OpenTelemetry spans instead of the timing log, and a `/tasks/[id]` detail
route with comments.
