# FraudWeave demonstration

## Before presenting

Open Docker Desktop and start the existing `fraudweave-db` container. Start the
API and frontend using the README. Confirm `/api/health` is healthy and the
dashboard totals are 203,769 transactions and 234,355 relationships. Train the
local model with `python -m src.ml.train` if it is not available.

## A five-minute investigation

1. **Overview:** explain that these are historical Elliptic research records,
   including 157,205 unknown labels. Show that the dashboard reads real counts.
2. **Transaction graph:** investigate `230425980`. The incoming neighbor is
   `98374661`, and the outgoing neighbor is `5530458`. Click a node, then select
   a deeper view. Describe the node cap and truncation warning rather than
   implying that the whole dataset is in the browser.
   Transaction `3181` is another useful example: its exact outgoing degree is
   112, while the bounded display samples fewer connections and marks truncation.
3. **Evidence:** compare the research label, exact neighbor-label coverage and
   separate classifier score. The sample's unknown label stays unknown even
   when the classifier predicts a label. Open an evidence source endpoint.
4. **Discovery:** filter the browse suggestions to illicit-labelled records and
   investigate one. A research label is an annotation, not an accusation.
5. **Risk intelligence:** show the held-out precision and recall, the chronological
   split and the dataset timeline. Discuss the false negatives and the unevaluated
   unknown-label population, rather than presenting one headline accuracy value.
6. **Copilot:** ask “Summarize this transaction”, “Show dataset statistics”, and
   “Explain model precision and recall”. Show the tool/source trail. Explain that
   it is a local deterministic assistant, not a general-purpose LLM.
7. **Investigation:** add a note, save it, and reopen it from the casebook. Export
   the evidence report and explain that notes are exported separately.

## Scope to describe accurately

The release includes a working local investigation workflow, graph exploration,
evaluated ML baseline, grounded assistant, charts and report export. It does not
identify real owners, prove criminal conduct, fetch current blockchain activity,
or provide a shared authenticated analyst service. No paid API is required.

Publish the source with its setup instructions and original author attribution.
Do not publish CSVs, database dumps, local `.env`, or trained model artifacts.

## Added graph investigation demonstration

In the copilot, choose **Trace multi-hop paths**. Expand the investigation
 decisions and explain that each next query is selected from real returned
connections. If no illicit-labelled records are found, show that result honestly;
select a record from the illicit-labelled discovery filter to explore another
neighborhood. Click a returned path node to open its investigation. Explain that
association is not proof and the search is bounded, not exhaustive.

## What to explain to judges

1. React renders the workspace; FastAPI exposes bounded tools; FalkorDB stores
   the directed transaction graph and all original features.
2. The policy follows unknown-labelled neighbors first and records each decision.
3. The classifier is a separate chronological baseline, not the graph's labels.
4. Test recall is lower than precision; unknown-label performance is unevaluated.
5. Vedhanth built the foundation; Codex assisted this continuation substantially.

Record the running application and your explanation. Do not present screenshots
as an interactive recording, or claim a generative LLM is running. Include the
public repository URL and final video URL in the event submission form.

Verified local demonstration on 18 October 2026: transaction **3181** returned
`3181 -> 181539847 -> 288574034`, with the final record illicit-labelled.
The run inspected 12 neighborhoods and disclosed sampling limits. These are
historical research labels, not a finding that any person committed an offence.
Use **Export investigation trail** to download the returned paths and decisions.
