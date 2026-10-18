# Frontend upgrade handover

Branch: `frontend/premium-workspace`.

## Delivered stages

1. Audited the existing components, API client, scripts and installed dependencies; retained React, Cytoscape, Recharts, Motion and Lucide.
2. Added `premium.css` with shared surface, text, cyan, violet, border and spacing tokens. Preserved research-label colors and added directional legend text.
3. Added collapsible desktop navigation, five destinations, a service-health System page, historical-data context and compact non-Overview pages. Refresh now preserves transaction selection.
4. Added graph reset, selected-neighborhood focus, hover metadata, incoming/outgoing highlighting and background deselection. Existing bounded traversal, pan, drag, zoom, fit and accessible node list remain.
5. Added keyboard-accessible table-to-investigation links and a docked evidence copilot with Escape-to-close and focus return. Existing case storage, reports, notes, model context and cited responses remain.
6. Added analyst-controlled focus layout; multi-hop tracing expands graph depth within the existing backend limits. Added loading skeletons, restrained panel/button transitions, reduced-motion chart handling and an accessible timeline table.
7. Build and lint checks pass. See final delivery message for the browser workflows actually exercised.

## Scope and dependencies

All implementation changes are confined to `frontend/src/`; backend contracts, queries, models and files are unchanged. No new dependencies.

From repository root: `npm.cmd --prefix frontend ci`, then `npm.cmd --prefix frontend run dev`. Configure a reachable API using `frontend/.env.local` and the existing `VITE_API_BASE_URL`; never commit local configuration.

## Known limits / backend coordination

- Shared investigations, authentication and streaming chain data remain unavailable; saved cases are accurately labelled browser-local.
- The copilot remains a deterministic backend tool policy, not a generative LLM.
- Classifier scores remain uncalibrated historical-label signals.
- Selection loads a fresh bounded graph around the chosen transaction. There is no backend endpoint for arbitrary graph mutation, owner identity, shared case storage or server-side layout persistence.
- The focus layout adapts graph height; no arbitrary draggable/resizable panel system or decorative WebGL scene was added.
- Narrow screens use the compact five-destination navigation and an evidence drawer with explicit close/Escape.
