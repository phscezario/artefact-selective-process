# Part 1 — Theoretical Questions

## 1. React and Next.js: Rendering and Strategies

### a) Explain the differences between CSR, SSR and SSG

The main difference between these rendering strategies is where and when the page is generated. This affects the initial user experience, performance, SEO and the resources required to run the application.

**Client-Side Rendering (CSR)**

With CSR, the browser is responsible for rendering the application. The server initially sends the HTML structure and JavaScript files, and React takes over in the browser, fetching the required data and building the interface.

This approach works particularly well for interactive applications, such as dashboards, administrative systems and platforms where users spend a lot of time interacting with the application.

The main disadvantage is the initial loading experience. Depending on the amount of JavaScript and the data required, users may have to wait before seeing meaningful content. It can also create SEO challenges when the content depends entirely on JavaScript execution.

**Server-Side Rendering (SSR)**

With SSR, the server generates the HTML for each request, usually using the latest available data, and sends the rendered page to the browser. React then hydrates the page, making its interactive elements functional.

The biggest advantage is that users can see the content earlier, without waiting for the entire client-side application to load. It is also useful for pages that need to be indexed by search engines while displaying frequently changing information.

On the other hand, rendering every request on the server introduces additional processing costs. If the application depends on slow APIs or databases, this can also affect response times.

**Static Site Generation (SSG)**

With SSG, the HTML is generated during the build process rather than for every user request. The generated files can then be distributed through a CDN.

This is generally a very efficient approach because the server does not need to generate the page every time someone accesses it.

It works particularly well for content that does not change frequently, such as documentation, blogs, landing pages and company websites.

The limitation is that the generated content can become outdated. When information changes, the application needs a new build or a revalidation strategy, such as Incremental Static Regeneration (ISR).

In simple terms, CSR renders in the browser, SSR renders on the server for each request, and SSG generates the page ahead of time.

In Next.js 15, these strategies can be combined depending on the requirements of each route. Server Components, Client Components, caching and dynamic rendering allow developers to choose the most appropriate approach for different parts of the same application.

### b) In which scenarios can each approach be advantageous or problematic? Give practical examples.

The choice depends mainly on the type of application, how frequently its data changes, and how users interact with it.

**CSR — Client-Side Rendering**

A good example would be an internal management platform or an analytics dashboard.

In these applications, users are usually authenticated, interact with several components and frequently update information. SEO is generally not a priority.

CSR can simplify the development of highly interactive interfaces. However, using it for a public website or an e-commerce landing page could negatively affect the initial loading experience and search engine visibility.

**SSR — Server-Side Rendering**

An e-commerce platform is a good example.

Product information, prices and stock availability can change frequently. Rendering the page on the server allows users to receive updated information while also making the content available in the initial HTML.

The disadvantage appears when traffic increases significantly. Rendering every request can become expensive, particularly when the application depends on external services or database queries.

Caching can help reduce this overhead, but it needs to be designed carefully to avoid serving outdated information.

**SSG — Static Site Generation**

Documentation websites, blogs and marketing pages are good examples.

Their content usually does not change with every request, so generating the pages during the build process is more efficient.

However, this approach becomes less attractive when the content changes frequently or depends on user-specific information. ISR can help when content needs periodic updates without rebuilding the entire application.

**Combining different strategies**

In real projects, I would not necessarily choose only one rendering strategy for the entire application.

For example, an e-commerce platform could use SSG for marketing pages, SSR for product pages that require fresh information, and CSR for interactive features such as shopping carts and customer account areas.

I believe the important thing is to understand the requirements of each part of the application before choosing the rendering strategy.

**Application to this challenge**

For this task management application, SSR is appropriate for the listing page because the requirements explicitly ask for the tasks to be loaded before the page is delivered to the user.

The creation and editing forms, on the other hand, benefit from Client Components because they require user interaction, form state management and event handling.

This separation allows the application to take advantage of server-side rendering without making the entire interface dependent on client-side execution.

---

## 2. Backend: Concepts and Approaches

### a) What are the main ways to implement a backend for a web application?

There are different ways to structure a backend, and I believe the decision should be based on the application's requirements, complexity, integration needs and expected growth.

Some of the most common approaches are:

**1. Backend integrated with a full-stack framework**

Frameworks such as Next.js, Remix, Django and Laravel allow frontend and backend functionality to live within the same application.

This is a practical approach for applications where a separate backend service is not necessary. It simplifies deployment, reduces infrastructure complexity and can make development faster.

The main limitation is that frontend and backend responsibilities can become tightly coupled if the application grows without clear boundaries.

**2. REST APIs**

REST is one of the most common approaches for building backend services.

The backend exposes endpoints representing resources, and clients communicate with them using standard HTTP methods such as GET, POST, PUT, PATCH and DELETE.

One of its biggest advantages is flexibility. Different applications, technologies and platforms can consume the same API.

It is also a mature approach with well-established standards for authentication, caching, documentation and monitoring.

The main challenge is maintaining consistency between frontend and backend contracts, especially when the application has many endpoints and different clients.

**3. GraphQL**

GraphQL allows clients to request exactly the data they need through a query language.

It can be useful when multiple clients consume the same backend but require different data structures, such as web applications, mobile applications and external integrations.

However, it introduces additional complexity around resolvers, authorization, caching, query performance and database access.

**4. RPC and typed APIs**

RPC approaches expose backend operations as procedures rather than focusing exclusively on resources.

tRPC is a good example for TypeScript applications because it provides end-to-end type safety between the backend and frontend.

This reduces duplicated contracts and makes development more straightforward when both sides are maintained by the same team.

The main limitation is that this approach is more tightly coupled to the technologies used by the client and server.

**5. Microservices and event-driven architectures**

For larger systems, the backend can be divided into independent services organized around business domains.

Each service can have its own responsibilities, deployment lifecycle and scaling requirements. Communication can happen through HTTP APIs, messaging systems or events.

This approach is useful when different parts of the system have independent scaling, availability or ownership requirements.

However, it also introduces operational complexity, including distributed tracing, service communication, eventual consistency and failure handling.

I have worked with distributed systems and integrations where these concerns are important, particularly when dealing with payment processing and operations that must avoid duplicate execution.

**My approach to choosing an architecture**

I don't believe there is one approach that works for every application.

For a smaller application, a well-structured backend within a single project is often enough. As business requirements grow, it may become necessary to separate services or introduce different communication strategies.

What I consider important is keeping business rules and responsibilities well organized, so that the application can evolve without requiring unnecessary changes across the entire system.

The architecture should solve the current problem while leaving room for future requirements.

### b) Do you know tRPC? What are its main advantages and disadvantages, especially regarding security, typing and scalability?

Yes. tRPC is a framework that allows TypeScript applications to communicate through procedures while maintaining type safety between the backend and frontend.

Instead of manually defining API contracts or generating types from a separate specification, the client can infer types directly from the backend router.

I see this as one of its biggest advantages, especially when frontend and backend development happen within the same project or team.

**Advantages**

**End-to-end type safety**

The frontend can infer the expected input and output types directly from the backend procedures.

This reduces duplicated interfaces and helps identify contract changes during development. For example, if a backend procedure changes the structure of its response, TypeScript can identify the affected frontend components.

**Simpler validation and maintenance**

tRPC works well with validation libraries such as Zod.

We can define the expected input structure once and use it to validate incoming requests on the server. The same schema can also be reused in the frontend to provide immediate feedback before submitting a form.

This helps keep validation rules consistent across the application.

**Developer experience**

The integration with TanStack Query provides useful features such as caching, loading states, query invalidation and mutations.

It reduces the amount of repetitive code required to manage communication between the frontend and backend.

**Less boilerplate**

Compared with a traditional REST implementation that requires separately maintained contracts or code generation, tRPC can make development more straightforward when working entirely within the TypeScript ecosystem.

**Disadvantages and limitations**

**Security**

Type safety should never be confused with security.

TypeScript types are removed at runtime, which means the backend must still validate every incoming request. A client can send unexpected or malicious data regardless of what the frontend types indicate.

Authentication, authorization, input validation, rate limiting and proper error handling must still be implemented.

For example, a procedure that updates a task should verify that the task exists and, in a real multi-user application, that the current user has permission to modify it.

**Technology coupling**

One limitation is that tRPC is primarily designed for TypeScript environments.

If the application needs to expose an API to external partners, mobile applications written in different languages or services built with other technologies, REST or GraphQL may be a better option.

**Scalability and maintenance**

tRPC itself is not necessarily a scalability limitation. It uses HTTP for communication and can run on infrastructure similar to other Node.js applications.

The real considerations are related to the backend architecture, database performance, request volume, caching, resource consumption and deployment strategy.

As the application grows, large routers and tightly coupled frontend/backend contracts can also make maintenance more challenging.

It is important to keep procedures organized by business responsibility and avoid putting all application logic directly inside the routers.

**When would I choose tRPC?**

I would choose tRPC when the frontend and backend are part of the same TypeScript ecosystem, especially when development speed, maintainability and type safety are important.

For example, it is a good fit for internal platforms, dashboards and applications developed by a single team.

For public APIs, third-party integrations or systems with multiple technologies, I would generally prefer REST or GraphQL because they provide a more independent contract between consumers and the backend.

Ultimately, I see tRPC as a good tool for the right scenario, not as a replacement for every API architecture.
