# FraudWeave

Bitcoin transaction graph investigation using React, FastAPI, and FalkorDB.
The original implementation is by [Vedhanth Krishnan](https://github.com/vedhanthkrishnan/FraudWeave).

## Current implementation

- A dark React/TypeScript dashboard with database status and dataset statistics.
- Transaction lookup and bounded incoming/outgoing neighbor responses from FalkorDB.
- CSV inspection and ingestion scripts for the original Elliptic dataset.
- A live Cytoscape graph with directional edges, node selection, zoom, fit, depth
  controls, an accessible node list, and strict traversal caps.
- Exact one-hop label coverage and connectivity indicators, separately displayed
  from research labels and classifier scores.
- A locally trained and evaluated historical-label classifier.
- A grounded local tool assistant, cited evidence briefs, and Markdown, JSON,
  and printable HTML investigation exports.
- Bounded multi-hop investigation with observed paths, decision traces, and JSON trail export.
- Browser-local saved investigations and analyst notes, plus casebook export.
- Dataset timeline and neighbor-label comparison charts.

Research labels and model scores are investigative signals, not proof of wrongdoing.
The copilot is a deterministic evidence assistant with explicit supported tools;
it is not a generative LLM. No external model API or fabricated chat response is used.

## Architecture

```text
React / Vite (5173) -> FastAPI (8000) -> FalkorDB (6379)
                                           ^
                               Local Elliptic CSV imports
```

`frontend/src/api.ts` calls the local API. `src/main.py` and `src/investigation.py` contain the API routes;
`src/database/db.py` reads the database settings. Dataset import scripts live in
`src/ingestion/`.

## Requirements

The application was built and its API imports checked on Windows x64 using
Python 3.14.7, Node.js 24.21.0, and npm 11.19.0. Install only missing tools.

- Git, Python 3.14, and Node.js 24 with npm.
- [Docker Desktop](https://docs.docker.com/desktop/setup/install/windows-install/)
  with a running Linux-container engine for local FalkorDB.
- The original Elliptic dataset, downloaded separately as described below.

The repository does not contain a Python environment, `.env`, installed frontend
packages, dataset CSVs, or database contents. No paid API or LLM key is required
for the existing implementation.

The locally trained `models/baseline.joblib` artifact is deliberately excluded
from Git. Source code, aggregate evaluation metrics, and training instructions
are included; a fresh checkout must train its own local model to enable inference.

## Windows PowerShell setup

Run the commands from the repository root in VS Code's terminal. If a clone
already exists, inspect `git status`, `git branch --show-current`, and
`git remote -v` before updating it. Preserve local changes.

For a first clone:

```powershell
git clone https://github.com/vedhanthkrishnan/FraudWeave.git
cd FraudWeave
```

Create the environment if `.venv` is absent, then install the tested dependency set:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-lock.txt
.\.venv\Scripts\python.exe -m pip check
npm.cmd --prefix frontend ci
```

`requirements.txt` lists direct dependencies. `requirements-lock.txt` records the
resolved versions from the local setup. Direct Python paths and `npm.cmd` avoid
the need to change PowerShell's execution policy.

Create configuration only if it does not already exist:

```powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

Edit `.env` locally if the database address differs. Keep its contents private.

## Start FalkorDB

First open Docker Desktop and wait for the engine to run:

```powershell
docker version
docker ps -a --filter name=fraudweave-db
```

If the existing `fraudweave-db` container is stopped, use `docker start fraudweave-db`.
Only when no such container exists, create it using the handover configuration:

```powershell
docker run -d --name fraudweave-db --restart unless-stopped -p 127.0.0.1:6379:6379 -p 127.0.0.1:3000:3000 -v fraudweave-data:/var/lib/falkordb/data -e "REDIS_ARGS=--appendonly yes" falkordb/falkordb@sha256:b0bdcac2cbaff989e77cb0610439b7a9289e86de033ccbbd4368b66fb680ae7a
```

These ports are limited to this computer. The expected graph name is `fraudweave`.
The command pins the image downloaded during setup on 18 October 2026. The named
volume mounts the verified database data directory; append-only persistence is
enabled. Restarting the container keeps the local graph in that volume.

## Dataset and attribution

Download the [original Elliptic Data Set](https://www.kaggle.com/datasets/ellipticco/elliptic-data-set)
and extract the following original files into `data/raw/elliptic_bitcoin_dataset/`:

```text
elliptic_txs_classes.csv
elliptic_txs_edgelist.csv
elliptic_txs_features.csv
```

The dataset is published under
[CC BY-NC-ND 4.0](https://creativecommons.org/licenses/by-nc-nd/4.0/).
Follow the publisher's terms, preserve attribution, and keep CSVs and database
exports out of GitHub. Dataset licensing is separate from the application source.
Do not substitute fabricated transactions.

Attribution: Elliptic, www.elliptic.co; M. Weber et al.,
[Anti-Money Laundering in Bitcoin: Experimenting with Graph Convolutional Networks for Financial Forensics](https://arxiv.org/abs/1908.02591),
KDD 2019 Workshop on Anomaly Detection in Finance.

Check the files before importing:

```powershell
.\.venv\Scripts\python.exe verify_dataset.py
```

Start the API as described below and check existing graph statistics before a
full import. For a new, empty graph:

```powershell
.\.venv\Scripts\python.exe -m src.ingestion.import_elliptic --limit 0
.\.venv\Scripts\python.exe -m src.ingestion.import_edges
```

The node script defaults to **1,000 records** unless `--limit 0` is supplied.
Both scripts use `MERGE`, but inspect existing data and graph counts before
rerunning them. Import nodes first; the edge script skips missing endpoints.

Expected full-dataset counts from the handover, to verify against the live graph:

| Measure | Expected |
| --- | ---: |
| Transactions | 203,769 |
| Relationships | 234,355 |
| Illicit-labelled | 4,545 |
| Licit-labelled | 42,019 |
| Unknown | 157,205 |

Feature CSV rows have no header and contain 167 columns: ID, time step, and 165
features. These expectations are not evidence that a local import has completed.

## Run the application

In one terminal at the repository root:

```powershell
.\.venv\Scripts\python.exe -m uvicorn src.main:app --reload --host 127.0.0.1 --port 8000
```

In a second terminal at the repository root:

```powershell
npm.cmd --prefix frontend run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

Open [the dashboard](http://127.0.0.1:5173/) and
[interactive API documentation](http://127.0.0.1:8000/docs).

Verify the API in another terminal:

```powershell
Invoke-RestMethod http://127.0.0.1:8000/
Invoke-RestMethod http://127.0.0.1:8000/api/health
Invoke-RestMethod http://127.0.0.1:8000/api/stats
```

The root endpoint can work while the database is unavailable. In that case,
health reports `degraded` with `connected: false`, and database-dependent
endpoints return HTTP 503. An empty connected graph can return zero counts;
that is not a successful dataset import.

After importing, try `/api/transactions/230425980` and
`/api/transactions/230425980/neighbors?limit=10`. The ID is a historical example;
the neighbor limit is per direction, with an API maximum of 100.

## Build checks and GitHub submission

```powershell
npm.cmd --prefix frontend run build
npm.cmd --prefix frontend run lint
.\.venv\Scripts\python.exe -m pip check
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
.\.venv\Scripts\python.exe -m compileall -q src inspect_dataset.py verify_dataset.py
git diff --check
git status --short
```

GitHub Actions runs frontend build/lint and Python dependency/import/regression checks on
pushes and pull requests. Those checks do not import the licensed dataset or
validate live database responses. A successful local build does not establish
that GitHub Actions has run.

After importing the full original dataset and training the model, run the
read-only integration verifier against the running local API:

```powershell
.\.venv\Scripts\python.exe scripts/verify_live.py
```

It checks actual graph totals, bounded traversal, the 112-outgoing-neighbor
example, label coverage, model metadata, citations, report formats and copilot
input handling. Results are saved under the ignored local `reports/` directory.
It does not create fixture records or mutate the graph. Set `FRAUDWEAVE_TEST_URL`
to test another local API port.

Use a repository you own, a fork, or collaborator access to the original repo
when publishing. Preserve the original commit history and attribution. Review
the files being committed: `.env`, `.venv`, `node_modules`, `dist`, and dataset
contents are excluded by `.gitignore`. Publish source code and setup instructions;
GitHub source hosting alone does not run FastAPI or FalkorDB.

## Investigation workflow

1. Enter a full numeric transaction ID and choose **Investigate**. The separate
   table filter only filters already loaded records.
2. In **Transaction graph**, click a node to change the selected transaction.
   Adjust depth (1–3) and node cap (20/80/150). Server limits also cap exploration
   at 30 expanded nodes and 10 sampled neighbors per direction. A warning marks
   truncated graph views. Shape and color both distinguish research labels.
3. Review exact incoming/outgoing degrees and distinct-neighbor label coverage.
   These aggregates are independent of the displayed sample size.
4. Review the evidence brief and open its source endpoints. Inspect all 165
   stored features if useful; anonymized feature names have no invented descriptions.
5. Add analyst notes and choose **Save investigation**. The **Investigations**
   view lists saved references and notes in this browser (maximum 50). Export the
   casebook to preserve notes outside the browser. Clearing browser data removes
   these saved cases; they are not a shared server-side case-management system.
6. Export Markdown, JSON, or printable HTML evidence. Open an HTML report and
   use your browser's print dialog to save a PDF. Analyst notes are kept separate
   from generated evidence and exported through the casebook.
7. Ask the local copilot for a transaction summary, risk evidence, dataset counts,
   or model evaluation. It returns actual tool results and source links. Unsupported
   questions are explicitly declined; no arbitrary Cypher or external web queries run.

## Local classifier and evaluation

After obtaining and verifying the original CSVs, train locally from the repository root:

```powershell
.\.venv\Scripts\python.exe -m src.ml.train
```

The model uses 165 anonymized numerical features. IDs, time steps, and research
labels are not input features. Unknown-label rows are excluded from training and
evaluation. A gradient-boosting baseline is trained on steps **1–34**, its decision
threshold is chosen by validation F1 on **35–39**, and final evaluation uses
**40–49**. The model is not refit on the held-out period.

Recorded evaluation on 18 October 2026 (see `models/metrics.json`):

| Held-out metric, illicit research label | Value |
| --- | ---: |
| Precision | 0.8721 |
| Recall | 0.5896 |
| F1 | 0.7036 |
| Average precision | 0.6704 |
| ROC AUC | 0.8961 |
| Labelled test records | 11,184 |
| Illicit-labelled test records | 636 |

These are historical research-label metrics, not verified crime-detection
accuracy. The classifier score is uncalibrated. Unknown-label performance has
not been established. Anonymized aggregate features and temporal distribution
changes limit generalization to real-world transactions. In-sample and held-out
contexts are identified in the interface. A missing model produces an explicit
unavailable state; it never generates a substitute prediction.

## API additions

All transaction IDs below refer to imported research records.

| Endpoint | Purpose |
| --- | --- |
| `GET /api/transactions?label=all&limit=12` | Bounded dataset discovery |
| `GET /api/transactions/{id}/graph?depth=1&max_nodes=80&per_direction=10` | Bounded directed graph |
| `GET /api/transactions/{id}/risk` | Exact indicators and separate model output |
| `GET /api/transactions/{id}/summary` | Cited evidence brief |
| `GET /api/transactions/{id}/report?format=markdown` | Markdown, JSON, or HTML export |
| `GET /api/dataset/timeline` | Aggregated label counts by time step |
| `GET /api/models/status` | Model availability, methods and evaluation |
| `POST /api/copilot` | Local evidence assistant (`question`, optional `tx_id`) |

Investigation queries are parameterized and read-only, with a five-second query
deadline. Graph limits are enforced on the server as well as in the interface.
The original root, health, stats, detail, and neighbor endpoints remain available.

The frontend API address can be overridden with `VITE_API_BASE_URL` (see
`frontend/.env.example`). This is a local, single-user demonstration: shared
authentication, live blockchain ingestion, and production hosting are outside
this release. Keep the local database ports bound to loopback as shown above.

## Graph Hacks submission

**Intended track: Track 1 — Agents That Act on Connected Data.**
FraudWeave uses a deterministic investigation policy rather than a generative
LLM. It reads the root transaction, explores incoming and outgoing connections,
prioritizes unknown-labelled records, and stops following a branch when it finds
illicit-labelled evidence. The graph determines which transaction is queried next.
Each finding includes an observed path, the actual directed edges, and a tool
trace. This is bounded evidence gathering, not a claim of autonomous crime detection.

Use **Trace multi-hop paths** in the copilot, or
`GET /api/transactions/{id}/trace`. Limits: three hops, 20 neighborhood expansions,
ten neighbors per direction, eight findings, and an eight-second elapsed budget
checked between expansions. Individual queries time out after five seconds; an
in-flight expansion can exceed the elapsed budget. Cycles are deduplicated.
Only one discovered path per target is returned. Sampling, budget exhaustion,
and finding limits are disclosed; a zero-result search never establishes innocence.
No paid API key is required.

### Graph model

```text
(:Transaction {tx_id: string, label: string, time_step: integer,
               f000: float, ... f164: float})
   -[:TRANSACTION_FLOW]-> (:Transaction)
```

`tx_id` is the Elliptic research identifier, not a Bitcoin address or owner.
Edges represent directed transaction flows from the source dataset. A connection
path may traverse either direction; the returned edge list preserves flow direction.
The visual interface distinguishes stored research labels from classifier outputs.

### Key read-only Cypher tools

```cypher
MATCH (t:Transaction {tx_id:$id}) RETURN t LIMIT 1

MATCH (t:Transaction {tx_id:$id})
MATCH (t)-[:TRANSACTION_FLOW]->(n:Transaction)
RETURN DISTINCT n.tx_id,n.label,n.time_step
ORDER BY n.tx_id LIMIT $limit

MATCH (t:Transaction {tx_id:$id})
MATCH (n:Transaction)-[:TRANSACTION_FLOW]->(t)
RETURN DISTINCT n.tx_id,n.label,n.time_step
ORDER BY n.tx_id LIMIT $limit

MATCH (t:Transaction)
RETURN t.time_step,t.label,count(t) ORDER BY t.time_step
```

The investigation policy composes bounded neighbor queries instead of executing
an unbounded variable-length graph match. All values are parameters; user text
cannot become Cypher. FalkorDB supplies actual neighbors, labels, counts, and
features used throughout the interface. Without the database, the app reports
unavailability instead of substituting records.

### Credits and AI assistance

Vedhanth Krishnan created the original FraudWeave repository, dashboard, FastAPI
backend, FalkorDB connection, and ingestion foundation. This continuation retains
that work and its Git history. Elliptic supplies the research dataset; see the
attribution and download instructions above.

OpenAI Codex assisted substantially with environment setup, implementation,
interface refinement, tests, model training, and documentation. The entrant must
review and understand the implementation, identify their own contributions, and
accurately explain this assistance when submitting. This document does not certify
participant eligibility or when all development began.

### Submission status

The repository includes complete local setup instructions, graph schema, queries,
model evaluation, tests, and a demonstration script in `DEMO.md`. A public repository
containing this continuation and a recorded working-demo URL must be supplied by
the entrant before submission. GitHub Actions is configured; a successful hosted
run is only established after pushing and observing the workflow.
