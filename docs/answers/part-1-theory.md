# Part 1 — Theoretical questions

## 1. React and Next.js: rendering and strategies

All three strategies end with React rendering the same components. What changes is **where** the
HTML is produced and **when** — and, because of that, what the user sees before the JavaScript
arrives.

### a) CSR, SSR and SSG

**Client-Side Rendering (CSR).** The server returns an almost empty HTML document plus a JavaScript
bundle. React mounts in the browser, then fetches the data over HTTP and paints the screen. The
first meaningful paint waits for the bundle to download, parse and execute _and_ for the data
request to return. The HTML is not useful content, so crawlers that do not execute JavaScript (and
most social/link previews) see nothing.

**Server-Side Rendering (SSR).** The server renders the component tree into HTML **per request**,
already with the data, and sends that HTML. The browser can paint before the bundle is parsed,
then hydration attaches the event handlers. Time to First Byte now depends on your data source,
and each request costs server work. SSR does not remove JavaScript from the page — it only moves
the first paint to the server.

**Static Site Generation (SSG).** HTML is generated **at build time**, and the same file is served
to everyone from a CDN (optionally regenerated later — `revalidate`/ISR). There is no per-request
server work, so it is the cheapest and usually the fastest option, but the content is frozen until
the next build or revalidation, and it cannot contain per-user data.

A useful mental model: **CSR pays at the user's device, SSR pays at the server, SSG pays at build
time.**

In Next.js 15 these are not app-wide choices — they are per route. A route is static unless it uses
a dynamic API (`cookies()`, `headers()`, `searchParams`) or opts into `dynamic = 'force-dynamic'`.
Server Components also move data fetching to the server without shipping that code to the browser,
and streaming (Suspense) sends HTML progressively while slower parts resolve.

### b) When each one helps and when it hurts

| Strategy | Fits well                                                                                                                             | Hurts when                                                                                                                                                            |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **CSR**  | Authenticated apps, dashboards, editors, anything behind a login where SEO is irrelevant and the user stays for a long session        | Public content pages, social previews, low-end mobile devices, first-load performance budgets                                                                         |
| **SSR**  | Pages whose content must be fresh **and** visible immediately: product pages with price/stock, feeds, checkout, personalised listings | Very high traffic on cacheable pages (you pay per request for nothing), slow upstream APIs (TTFB inherits the latency), pages whose content is identical for everyone |
| **SSG**  | Marketing pages, docs, blog, changelog, legal pages, catalogues that change a few times a day                                         | Per-user data, high-frequency updates, enormous catalogues (build time and memory grow), drafts/previews without an escape hatch                                      |

Concrete examples:

- **CSR** — an internal analytics dashboard: the user is authenticated, the data is private, SEO is
  meaningless and the app lives for minutes in the tab. Shipping it as an SPA is simpler and the
  hosting is a CDN. The same choice on the marketing homepage would be a mistake: blank first paint,
  weak previews and a worse LCP on mobile.
- **SSR** — an e-commerce product page. Price and stock change per region and per minute, and the
  page must be indexable and readable on the first paint. The cost appears when a promotion drives
  a traffic spike: without caching, every visit becomes a server render.
- **SSG** — documentation and a pricing page. They change a few times a week, are read by everyone,
  and benefit from being served from the edge with no compute. The failure mode is a price that
  stays wrong until someone redeploys — which is exactly why those pages often use ISR with a short
  revalidation window.
- **Hybrid** — the common real-world answer: a Next.js app with SSG for the public pages, SSR for
  the pages that depend on the session, and CSR for the interactive parts inside them. Per-route
  decisions, not a single global one.

**How this case applies it.** The task list uses **SSR**: the in-memory store changes on every
mutation, so the HTML has to be produced per request, and the first paint must already contain the
tasks (a static build would freeze the seeded data). The create/edit forms are client components,
because the interaction is local and the mutation is client-side. If the list were public and
rarely changed, SSG with revalidation would clearly be the better trade-off — and the mutations
would have to invalidate the cache instead of just re-rendering.

---

## 2. Backend: concepts and approaches

### a) The main ways to implement a backend for a web application

The options differ in **where the code runs** and **how the client talks to it**. In practice:

| Approach                                                                         | What it is                                             | Strengths                                                                         | Trade-offs                                                                              |
| -------------------------------------------------------------------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Full-stack framework (Next.js route handlers/RSC, Remix, Rails, Laravel, Django) | Backend and frontend in one deployable                 | One codebase, one deploy, shared types and validation, fastest path to production | Frontend and backend lifecycles are coupled; the backend scales together with the UI    |
| REST API + SPA/mobile                                                            | Resource-oriented endpoints consumed by any client     | HTTP-level caching, language-agnostic, mature tooling, observable per route       | Contract drift without codegen; chatty round trips; types maintained twice              |
| GraphQL                                                                          | One endpoint, client-driven selection                  | Great when several clients need different shapes; avoids over/under-fetching      | Complexity (resolvers, N+1, caching, query cost limits), per-field authorisation        |
| Typed RPC (tRPC, gRPC, Connect)                                                  | Procedures with a shared contract                      | End-to-end types, little boilerplate; gRPC for polyglot/internal services         | Coupled client/server versions; weaker fit for public or multi-language consumers       |
| BFF (Backend for Frontend)                                                       | A backend per client that aggregates internal services | Shapes data per client, hides internal topology                                   | One more service to own; duplicated aggregation logic                                   |
| BaaS / serverless (Supabase, Firebase, Lambda, Vercel functions)                 | Managed backend or functions                           | Very fast start, ops delegated, pay per use                                       | Cold starts, execution limits, vendor lock-in, harder local parity                      |
| Microservices / event-driven                                                     | Independent services per domain                        | Independent scaling and ownership, fault isolation                                | Platform maturity, tracing, eventual consistency — usually overkill for a small product |

Two pragmatic points I would add from experience:

1. **The transport is a detail; the domain model is not.** Keeping the domain behind an interface
   (a repository, a service layer) is what makes changing from "one Next.js app" to "a separate API
   service" cheap. Choosing REST vs tRPC today is much less expensive than realising in six months
   that business rules are spread across route handlers.
2. **Start with the simplest thing that has a clear boundary.** A monolith with a well-defined
   backend module is usually a better start than microservices, and a separate service is worth it
   when it has its own scaling, deployment or ownership needs — not by default.

**What I did here:** the backend is a workspace package (`@artefact/backend`) with the router,
schemas and repository. It is mounted into Next.js through a single route handler using the fetch
adapter, but nothing in it depends on Next.js. The server components call it in-process. That keeps
the deploy simple (one container) while preserving the boundary: another repository implementation
or a Fastify server would not touch the domain.

### b) tRPC: advantages and disadvantages

Yes — this case uses tRPC v11 with the TanStack React Query integration, and the reasoning below is
the one I applied while building it.

**What it is.** tRPC is an RPC framework for TypeScript where the server router _is_ the contract.
The client imports the router **type** (`typeof appRouter`) and infers input and output types for
every procedure. No codegen, no OpenAPI file, no duplicated interfaces.

**Advantages**

- **Real end-to-end typing.** The input type comes from the Zod schema and the output type from the
  resolver's return value. Renaming a field or changing a return shape breaks compilation at every
  call site instead of failing at runtime.
- **One validation layer, reused.** The same Zod schema validates the API and the form (the create
  form calls `createTaskInput.safeParse`), so client and server rules cannot drift.
- **Excellent developer experience.** With React Query you get caching, invalidation, infinite
  queries and optimistic updates without writing a client. Requests are batched by default, which
  reduces round trips on pages that load several resources.
- **Small surface area.** One endpoint, one middleware chain, errors with stable codes. For an app
  where the same team owns both sides, it is usually less work than REST + a generated client.

**Disadvantages**

- **Security is not part of the type system.** Types are erased at runtime; a handcrafted request
  can send anything. Every input still needs runtime validation (Zod) and every procedure still
  needs an authorisation check. tRPC gives you neither authentication, nor CSRF protection, nor
  rate limiting, nor per-procedure policy. With cookie-based sessions you still need CSRF
  protection, and a single batch endpoint makes naive per-route rate limiting harder than with REST.
- **Error payloads can leak.** By default the error shape can carry stack traces and internal
  messages. It has to be formatted explicitly — in this project I strip the stack in production and
  expose only a code, a message and field-level errors.
- **Coupling and versioning.** The type safety only exists while both sides are TypeScript in the
  same repository and version. A Kotlin app, a partner integration or a public API cannot consume
  it; and because types are erased, a deployed server and a stale client can silently disagree at
  runtime. REST/GraphQL would version that contract explicitly.
- **Operational ergonomics.** Everything lives under `/api/trpc`, so per-resource CDN caching and
  per-endpoint HTTP semantics do not come for free. Metrics, rate limits and caching have to be
  built around the procedure `path` instead of the URL. Large routers also slow down `tsc` and the
  editor, and batching plus `superjson` add payload overhead.

**Scalability.** Under the hood it is HTTP, so it scales like any Node service — the constraints are
the ones above, not the transport. Two practical notes: breaking changes are all-or-nothing
(one router, one deployment), and batching means a single request can do a lot of work, so limits
and timeouts matter more than with small REST calls.

**When I would not use it.** Public or partner APIs, polyglot clients, strict HTTP caching per
resource, or a team that is not comfortable with TypeScript. In those cases a versioned REST/GraphQL
contract with a generated client is a better fit.

**What I did to reduce the risks here:** Zod on every input; `fieldErrors` in the error formatter so
the form can point at the offending field; stacks removed in production; a repository interface
instead of coupling the router to the store; a timing middleware that logs the procedure path (the
seed of per-procedure observability); and a router with no Next.js dependency, so replacing tRPC
with REST later would not touch the domain.
