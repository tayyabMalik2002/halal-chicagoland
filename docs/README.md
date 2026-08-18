# Zabiha Halal Chicagoland — Project Documentation

Full-stack support and reference documentation for the Zabiha Halal Chicagoland application: a halal restaurant directory, map, online ordering/reservation API, and AI-powered Menu Analyzer, built as a Northwestern MSISM capstone project.

**Live site:** https://delightful-moss-0894fe210.7.azurestaticapps.net

## Table of Contents

1. [Production Support Document & Testing Scenarios](01-production-support.md)
   - 1.1 Service dependency diagram
   - 1.2 Monitoring (logs, health checks)
   - 1.3 Common incidents & recovery steps
   - 1.4 Testing scenarios & results (automated, manual/E2E, smoke tests)
2. [System Setup Instructions (Frontend, Backend, Database)](02-system-setup.md)
   - 2.1 Prerequisites
   - 2.2 Docker Compose quick start
   - 2.3 Manual setup — Express API
   - 2.4 Manual setup — Flask API
   - 2.5 Frontend setup
   - 2.6 Mobile app setup
   - 2.7 Production build/deploy (Azure)
   - 2.8 Validation checklist
3. [Issue Diagnosis, Research, Resolution, and Sharing](03-issue-diagnosis.md)
   - 7 fully documented issues: description, environment, repro steps, diagnosis, research, resolution, verification
4. [System Usage Guide](04-usage-guide.md)
   - Accessing the app, navigating features, main workflow, known limitations, admin portal, support
5. [Architecture Diagram](05-architecture.md)
   - System overview, production diagram, component responsibilities, communication flows, hosting environments

### Related documents (existing project deliverables, referenced throughout)

| Document | Contents |
|---|---|
| [`MILESTONE4.md`](MILESTONE4.md) | Full 98-test-case automated test table, debugging/error-handling writeup, live deployment details and grader verification steps |
| [`test-output.txt`](test-output.txt) | Raw `npx jest --runInBand --verbose` output |
| [`../backend/README.md`](../backend/README.md) | Express API project structure and quick reference |
| [`../backend/docs/api-documentation.md`](../backend/docs/api-documentation.md) | Full REST API reference (menu, customers, orders, reservations, reports) |
| [`../backend/docs/api-menu-analyzer.md`](../backend/docs/api-menu-analyzer.md) | AI Menu Analyzer API reference |
| [`../backend/docs/database-design.md`](../backend/docs/database-design.md) | Schema/ER diagram — **note:** header text is stale (says MySQL); the live schema is PostgreSQL, see [03-issue-diagnosis.md, Issue 7](03-issue-diagnosis.md#issue-7--stale-documentation-schema-docs-said-mysql-after-the-project-migrated-to-postgresql) |
| [`../backend/docs/test-cases-menu-analyzer.md`](../backend/docs/test-cases-menu-analyzer.md) | AI Menu Analyzer backend + manual frontend test cases |
| [`../backend/tests/test-cases.md`](../backend/tests/test-cases.md) / [`test-results.md`](../backend/tests/test-results.md) | Formal REST API test case tables and results |
| [`../mobile/README.md`](../mobile/README.md) | Expo Go mobile demo setup |

## How this documentation is organized

Sections 1–5 above (files `01-*.md` through `05-*.md`) are the deliverables for this documentation assignment and are self-contained — each links out to the deeper, pre-existing project docs (API references, ER diagrams, the full 98-row automated test table) rather than duplicating them, so there is one source of truth per topic. Start with [05-architecture.md](05-architecture.md) for the big picture, then [02-system-setup.md](02-system-setup.md) to get a working local environment, then [01-production-support.md](01-production-support.md) and [03-issue-diagnosis.md](03-issue-diagnosis.md) for operating and troubleshooting the system. [04-usage-guide.md](04-usage-guide.md) is written for non-developer end users and admins.
