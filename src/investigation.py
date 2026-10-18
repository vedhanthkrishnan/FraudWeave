"""Read-only investigation tools. Labels, topology, and model outputs stay separate."""
from collections import deque
from contextlib import contextmanager
from datetime import datetime, timezone
from html import escape
import json
import logging
import re
from time import monotonic
from typing import Annotated, Literal

from fastapi import APIRouter, HTTPException, Path, Query
from fastapi.responses import Response
from pydantic import BaseModel, Field

from src.database.db import get_graph
from src.ml.predict import model_status, predict
from src.tracing import investigate

router = APIRouter(prefix='/api')
TxId = Annotated[str, Path(pattern=r'^\d{1,20}$')]
NOTE = 'Elliptic research labels and classifier scores are investigative signals, not proof of wrongdoing.'


@contextmanager
def guarded():
    try:
        yield
    except HTTPException:
        raise
    except Exception:
        logging.getLogger(__name__).exception('Investigation request failed')
        raise HTTPException(503, 'Investigation service unavailable. Check the database and backend logs.') from None


def query(cypher, parameters=None):
    return get_graph().ro_query(cypher, parameters, timeout=5000).result_set


def transaction(tx_id):
    rows = query('MATCH (t:Transaction {tx_id:$id}) RETURN t LIMIT 1', {'id': tx_id})
    if not rows:
        raise HTTPException(404, 'Transaction not found in the imported dataset.')
    return dict(rows[0][0].properties)


def compact(properties):
    return {key: properties.get(key) for key in ('tx_id', 'label', 'time_step')}


def neighbors(tx_id, limit=20, verify=True):
    if verify:
        transaction(tx_id)
    output = {}
    for direction, pattern in [('incoming', '(n:Transaction)-[:TRANSACTION_FLOW]->(t)'),
                               ('outgoing', '(t)-[:TRANSACTION_FLOW]->(n:Transaction)')]:
        # The pattern is chosen from these two constants, never from user input.
        rows = query('MATCH (t:Transaction {tx_id:$id}) MATCH ' + pattern +
                     ' RETURN DISTINCT n.tx_id,n.label,n.time_step ORDER BY n.tx_id LIMIT $limit',
                     {'id': tx_id, 'limit': limit})
        output[direction] = [{'tx_id': row[0], 'label': row[1], 'time_step': row[2]} for row in rows]
    return {'status': 'success', 'transaction_id': tx_id, **output, 'limit_per_direction': limit}


def graph_view(tx_id, depth=1, max_nodes=80, per_direction=10):
    root = compact(transaction(tx_id))
    nodes = {tx_id: root}
    edges = {}
    pending = deque([(tx_id, 0)])
    expanded = set()
    truncated = False
    started = monotonic()
    while pending:
        current, level = pending.popleft()
        if level >= depth or current in expanded:
            continue
        if len(expanded) >= 30 or monotonic() - started >= 8:
            truncated = True
            break
        expanded.add(current)
        result = neighbors(current, per_direction + 1, verify=False)
        for direction in ('incoming', 'outgoing'):
            candidates = result[direction]
            truncated = truncated or len(candidates) > per_direction
            for neighbor in candidates[:per_direction]:
                node_id = neighbor['tx_id']
                if node_id not in nodes:
                    if len(nodes) >= max_nodes:
                        truncated = True
                        continue
                    nodes[node_id] = neighbor
                    pending.append((node_id, level + 1))
                source, target = (node_id, current) if direction == 'incoming' else (current, node_id)
                edges[(source, target)] = {'id': source + ':' + target, 'source': source, 'target': target}
    return {'status': 'success', 'root': tx_id, 'nodes': list(nodes.values()), 'edges': list(edges.values()),
            'depth': depth, 'max_nodes': max_nodes, 'per_direction': per_direction,
            'expanded_nodes': len(expanded), 'truncated': truncated, 'source': 'FalkorDB / Elliptic',
            'scope_note': 'Bounded traversal; absence from this view does not mean no relationship exists.'}


def risk(tx_id, properties=None):
    properties = properties or transaction(tx_id)
    distribution = {'illicit_labelled': 0, 'licit_labelled': 0, 'unknown': 0}
    rows = query('MATCH (t:Transaction {tx_id:$id})-[:TRANSACTION_FLOW]-(n:Transaction) '
                 'RETURN n.label,count(DISTINCT n)', {'id': tx_id})
    for label, count in rows:
        distribution[label if label in distribution else 'unknown'] += int(count)
    degrees = {}
    for name, pattern in [('incoming', '(n:Transaction)-[:TRANSACTION_FLOW]->(t)'),
                          ('outgoing', '(t)-[:TRANSACTION_FLOW]->(n:Transaction)')]:
        result = query('MATCH (t:Transaction {tx_id:$id}) OPTIONAL MATCH ' + pattern +
                       ' RETURN count(DISTINCT n)', {'id': tx_id})
        degrees[name] = int(result[0][0])
    total = sum(distribution.values())
    known = distribution['illicit_labelled'] + distribution['licit_labelled']
    coverage = known / total if total else 0.0
    indicators = [
        {'name': 'Illicit-labelled neighbors', 'value': distribution['illicit_labelled'],
         'explanation': 'Distinct directly connected transactions with this research label. Association is not guilt.'},
        {'name': 'Neighbor label coverage', 'value': round(100 * coverage, 1),
         'explanation': f'{known} of {total} distinct neighbors have a known research label.'},
        {'name': 'Incoming / outgoing degree', 'value': f"{degrees['incoming']} / {degrees['outgoing']}",
         'explanation': 'Exact direct-neighbor counts, independent of the graph display limit.'},
    ]
    return {'transaction_id': tx_id, 'research_label': properties.get('label', 'unknown'),
            'time_step': properties.get('time_step'), 'degrees': degrees,
            'neighbor_labels': distribution, 'unique_neighbors': total,
            'label_coverage': coverage, 'indicators': indicators, 'model': predict(properties),
            'assessment': 'Review labelled connections' if distribution['illicit_labelled'] else
                          'Limited label evidence' if coverage < 0.5 else 'Review available evidence',
            'note': NOTE, 'source': 'FalkorDB / Elliptic; exact one-hop aggregates'}


def evidence(tx_id):
    properties = transaction(tx_id)
    indicators = risk(tx_id, properties)
    links = neighbors(tx_id, 20, verify=False)
    sources = [
        {'id': 'E1', 'title': 'Stored transaction', 'endpoint': f'/api/transactions/{tx_id}'},
        {'id': 'E2', 'title': 'Exact one-hop indicators', 'endpoint': f'/api/transactions/{tx_id}/risk'},
        {'id': 'E3', 'title': 'Bounded neighbor records (20 per direction)',
         'endpoint': f'/api/transactions/{tx_id}/neighbors?limit=20'},
    ]
    d = indicators['degrees']
    paragraphs = [
        f"Transaction {tx_id} is {properties.get('label', 'unknown')} in the Elliptic research dataset, at time step {properties.get('time_step')}. [E1]",
        f"Its graph contains {d['incoming']} distinct incoming and {d['outgoing']} distinct outgoing neighbors. [E2]",
        f"Among {indicators['unique_neighbors']} distinct neighbors, {indicators['neighbor_labels']['illicit_labelled']} are illicit-labelled, "
        f"{indicators['neighbor_labels']['licit_labelled']} licit-labelled, and {indicators['neighbor_labels']['unknown']} unknown. "
        f"Label coverage is {100 * indicators['label_coverage']:.1f}%. [E2]",
    ]
    prediction = indicators['model']
    if prediction['available']:
        paragraphs.append(f"The local classifier score is {prediction['score']:.4f}, with a validation-selected threshold "
                          f"of {prediction['threshold']:.4f}; predicted research label: {prediction['predicted_label']}. "
                          f"Evaluation context: {prediction['evaluation_context']}. This is not a calibrated fraud probability. [E2]")
    else:
        paragraphs.append('Model output is unavailable; no prediction is inferred. [E2]')
    return {'transaction_id': tx_id, 'generated_at': datetime.now(timezone.utc).isoformat(),
            'transaction': compact(properties), 'risk': indicators, 'neighbors': links,
            'summary': '\n\n'.join(paragraphs), 'sources': sources, 'note': NOTE,
            'dataset': {'name': 'Elliptic Data Set', 'url': 'https://www.kaggle.com/datasets/ellipticco/elliptic-data-set',
                        'license': 'CC BY-NC-ND 4.0', 'context': 'Historical research data, not a live blockchain feed.'}}


@router.get('/transactions/{tx_id}/graph')
def graph_endpoint(tx_id: TxId, depth: int = Query(1, ge=1, le=3),
                   max_nodes: int = Query(80, ge=5, le=150), per_direction: int = Query(10, ge=1, le=20)):
    with guarded():
        return graph_view(tx_id, depth, max_nodes, per_direction)


@router.get('/transactions/{tx_id}/risk')
def risk_endpoint(tx_id: TxId):
    with guarded():
        return risk(tx_id)


@router.get('/transactions/{tx_id}/summary')
def summary_endpoint(tx_id: TxId):
    with guarded():
        return evidence(tx_id)


@router.get('/models/status')
def model_endpoint():
    with guarded():
        return model_status()


@router.get('/dataset/timeline')
def timeline_endpoint():
    with guarded():
        rows = query('MATCH (t:Transaction) RETURN t.time_step,t.label,count(t) ORDER BY t.time_step')
        steps = {}
        for step, label, count in rows:
            item = steps.setdefault(int(step), {'time_step': int(step), 'illicit_labelled': 0, 'licit_labelled': 0, 'unknown': 0})
            item[label if label in ('illicit_labelled', 'licit_labelled', 'unknown') else 'unknown'] += int(count)
        return {'source': 'FalkorDB / Elliptic', 'steps': list(steps.values())}


@router.get('/transactions')
def list_endpoint(label: Literal['all', 'illicit_labelled', 'licit_labelled', 'unknown'] = 'all',
                  limit: int = Query(12, ge=1, le=50)):
    with guarded():
        clause = '' if label == 'all' else ' WHERE t.label=$label'
        rows = query('MATCH (t:Transaction)' + clause +
                     ' RETURN t.tx_id,t.label,t.time_step ORDER BY t.time_step,t.tx_id LIMIT $limit',
                     {'label': label, 'limit': limit})
        return {'transactions': [{'tx_id': a, 'label': b, 'time_step': c} for a, b, c in rows]}


class CopilotRequest(BaseModel):
    question: str = Field(min_length=3, max_length=600)
    tx_id: str | None = Field(default=None, pattern=r'^\d{1,20}$')


@router.get('/transactions/{tx_id}/trace')
def trace_endpoint(tx_id: TxId):
    with guarded():
        return investigate(tx_id, transaction, neighbors)


@router.post('/copilot')
def copilot_endpoint(body: CopilotRequest):
    with guarded():
        question = body.question.lower()
        tools = []
        mentioned = re.search(r'(?:transaction|tx)\s*#?\s*(\d{4,20})\b', question)
        tx_id = mentioned.group(1) if mentioned else body.tx_id
        if tx_id and any(word in question for word in ('trace', 'multi-hop', 'paths', 'follow connections')):
            result = investigate(tx_id, transaction, neighbors)
            return {**result, 'tools_used': ['transaction_lookup', 'adaptive_bounded_neighbors'],
                    'engine': 'local-policy', 'engine_note': 'Deterministic graph investigation policy; no generative LLM.',
                    'note': NOTE}
        if any(word in question for word in ('dataset', 'statistics', 'total transactions')):
            rows = query('MATCH (t:Transaction) RETURN t.label,count(t)')
            counts = {label: int(n) for label, n in rows}
            answer = (f"The imported graph has {sum(counts.values()):,} transactions: "
                      f"{counts.get('illicit_labelled', 0):,} illicit-labelled, "
                      f"{counts.get('licit_labelled', 0):,} licit-labelled and "
                      f"{counts.get('unknown', 0):,} unknown. [E1]")
            tools = ['dataset_label_counts']
            sources = [{'id': 'E1', 'title': 'Live dataset statistics', 'endpoint': '/api/stats'}]
        elif any(word in question for word in ('model', 'accuracy', 'precision', 'recall', 'trained')):
            status = model_status()
            if status['available']:
                metrics = status['test_metrics']
                answer = (f"The local {status['algorithm']} baseline was trained on time steps {status['split']['train']}, "
                          f"with threshold selection on {status['split']['validation']} and final testing on {status['split']['test']}. "
                          f"Held-out illicit-label precision: {metrics['precision']:.3f}; recall: {metrics['recall']:.3f}; "
                          f"F1: {metrics['f1']:.3f}; average precision: {metrics['average_precision']:.3f}. "
                          'These measure research-label classification on labelled records, not verified crime detection. [E1]')
            else:
                answer = 'No trained model is available. No model performance or predictions can be claimed. [E1]'
            tools = ['model_status']
            sources = [{'id': 'E1', 'title': 'Local model evaluation', 'endpoint': '/api/models/status'}]
        elif tx_id and any(word in question for word in ('summar', 'risk', 'evidence', 'neighbor', 'neighbour', 'connection', 'investigat', 'label', 'explain')):
            result = evidence(tx_id)
            answer, sources = result['summary'], result['sources']
            tools = ['transaction_lookup', 'neighbor_lookup', 'risk_indicators', 'local_classifier']
        else:
            answer = ('I can retrieve dataset statistics, explain model evaluation, or summarize a selected transaction’s '
                      'labels, connections and risk indicators. Select a transaction or include “transaction ID” in your question. '
                      'I cannot identify owners, verify criminal activity, fetch live blockchain information, or execute arbitrary queries.')
            sources = []
        return {'answer': answer, 'sources': sources, 'tools_used': tools,
                'engine': 'local-tools', 'engine_note': 'Deterministic evidence assistant; no generative LLM or external API.', 'note': NOTE}


@router.get('/transactions/{tx_id}/report')
def report_endpoint(tx_id: TxId, format: Literal['markdown', 'json', 'html'] = 'markdown'):
    with guarded():
        result = evidence(tx_id)
        filename = f'fraudweave-{tx_id}'
        if format == 'json':
            return Response(json.dumps(result, indent=2), media_type='application/json',
                            headers={'Content-Disposition': f'attachment; filename="{filename}.json"'})
        text = (f"# FraudWeave investigation: {tx_id}\n\nGenerated: {result['generated_at']}\n\n"
                + result['summary'] + '\n\n## Evidence sources\n\n'
                + '\n'.join(f"- [{s['id']}] {s['title']}: {s['endpoint']}" for s in result['sources'])
                + f"\n\n## Interpretation\n\n{NOTE}\n\n"
                + 'Dataset: Elliptic (CC BY-NC-ND 4.0). Historical research data.\n'
                + result['dataset']['url'] + '\n')
        if format == 'html':
            content = ('<!doctype html><html lang="en"><meta charset="utf-8"><title>FraudWeave investigation</title>'
                       '<style>body{font:16px/1.65 system-ui;max-width:850px;margin:50px auto;padding:24px;color:#172033}'
                       'pre{white-space:pre-wrap;font:inherit}@media print{body{margin:0}}</style>'
                       '<h1>FraudWeave · Investigation report</h1><pre>' + escape(text) + '</pre></html>')
            return Response(content, media_type='text/html',
                            headers={'Content-Disposition': f'attachment; filename="{filename}.html"'})
        return Response(text, media_type='text/markdown',
                        headers={'Content-Disposition': f'attachment; filename="{filename}.md"'})
