"""Integration checks against the actual imported local dataset; no fixtures inserted."""
import json
import os
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError

BASE = os.environ.get('FRAUDWEAVE_TEST_URL', 'http://127.0.0.1:8000')
checks = []


def call(path, status=200, payload=None, raw=False):
    request = Request(BASE + path, data=json.dumps(payload).encode() if payload is not None else None,
                      headers={'Content-Type': 'application/json'} if payload is not None else {})
    try:
        with urlopen(request, timeout=40) as response:
            code, content = response.status, response.read()
    except HTTPError as error:
        code, content = error.code, error.read()
    assert code == status, (path, code, content[:300])
    return content.decode() if raw else json.loads(content)


assert call('/api/health')['database']['connected']
stats = call('/api/stats')
assert stats['total_transactions'] == 203769 and stats['total_relationships'] == 234355
checks.append('Existing health/statistics contracts and full graph totals')
id = '230425980'
detail = call(f'/api/transactions/{id}')['transaction']
assert detail['label'] == 'unknown'
neighbors = call(f'/api/transactions/{id}/neighbors?limit=10')
assert [n['tx_id'] for n in neighbors['incoming']] == ['98374661']
assert [n['tx_id'] for n in neighbors['outgoing']] == ['5530458']
checks.append('Existing transaction and directional-neighbor API contracts')

for depth, cap in [(1, 80), (2, 20), (3, 5)]:
    graph = call(f'/api/transactions/{id}/graph?depth={depth}&max_nodes={cap}&per_direction=1')
    ids = {n['tx_id'] for n in graph['nodes']}
    assert id in ids and len(ids) == len(graph['nodes']) and len(ids) <= cap
    assert all(e['source'] in ids and e['target'] in ids for e in graph['edges'])
    assert len({e['id'] for e in graph['edges']}) == len(graph['edges'])
    assert graph['expanded_nodes'] <= 30
checks.append('Graph traversal depth, unique nodes/edges, node cap and valid directed endpoints')
busy_graph = call('/api/transactions/3181/graph?depth=2&max_nodes=20')
busy_risk = call('/api/transactions/3181/risk')
assert busy_graph['truncated'] and len(busy_graph['nodes']) <= 20
assert busy_risk['degrees']['outgoing'] == 112
checks.append('Real high-degree graph visibly truncated while exact outgoing degree remains 112')
for path in [f'/api/transactions/{id}/graph?depth=4', f'/api/transactions/{id}/graph?max_nodes=10000',
             f'/api/transactions/{id}/neighbors?limit=101', '/api/transactions?label=invalid',
             '/api/transactions/not-a-number/risk']:
    call(path, 422)
call('/api/transactions/00000000000000000000/graph', 404)
checks.append('Invalid limits/labels/IDs rejected, missing transactions return 404')

risk = call(f'/api/transactions/{id}/risk')
assert risk['research_label'] == 'unknown' and risk['degrees'] == {'incoming': 1, 'outgoing': 1}
assert risk['neighbor_labels'] == {'illicit_labelled': 0, 'licit_labelled': 0, 'unknown': 2}
assert risk['label_coverage'] == 0 and risk['unique_neighbors'] == 2
assert risk['model']['available'] and 0 <= risk['model']['score'] <= 1
assert risk['model']['evaluation_context'] == 'unlabelled / not evaluated'
checks.append('Exact risk aggregates, unknown-label coverage and separate evaluated classifier output')
model = call('/api/models/status')
assert model['available'] and sum(map(sum, model['test_metrics']['confusion_matrix'])) == model['partitions']['test']['records']
assert all(0 <= model['test_metrics'][key] <= 1 for key in ['precision', 'recall', 'f1', 'average_precision', 'roc_auc'])
timeline = call('/api/dataset/timeline')['steps']
assert len(timeline) == 49 and sum(sum(row[key] for key in ['illicit_labelled', 'licit_labelled', 'unknown']) for row in timeline) == 203769
suggestions = call('/api/transactions?label=illicit_labelled&limit=8')['transactions']
assert suggestions and all(row['label'] == 'illicit_labelled' for row in suggestions)
checks.append('Model evaluation consistency, 49-step chart totals and filtered discovery')

summary = call(f'/api/transactions/{id}/summary')
assert summary['transaction']['label'] == 'unknown' and '[E1]' in summary['summary'] and '[E2]' in summary['summary']
for format in ['markdown', 'json', 'html']:
    report = call(f'/api/transactions/{id}/report?format={format}', raw=True)
    assert id in report and 'Elliptic' in report
    if format == 'json': assert json.loads(report)['transaction_id'] == id
    if format == 'html': assert '<script' not in report
checks.append('Cited evidence summaries and Markdown/JSON/printable HTML exports')

for question in ['Summarize this transaction', 'Show dataset statistics', 'Explain model precision and recall']:
    answer = call('/api/copilot', payload={'tx_id': id, 'question': question})
    assert answer['engine'] == 'local-tools' and answer['sources'] and answer['tools_used']
unsupported = call('/api/copilot', payload={'tx_id': id, 'question': 'Identify the private wallet owner'})
assert not unsupported['tools_used'] and not unsupported['sources']
call('/api/copilot', 422, payload={'tx_id': id, 'question': 'x' * 601})
call('/api/copilot', 422, payload={'tx_id': "1' DROP GRAPH", 'question': 'Summarize this transaction'})
checks.append('Grounded copilot tools, honest unsupported queries, bounded inputs and no arbitrary Cypher')

trace = call('/api/transactions/3181/trace')
assert 1 <= len(trace['trace']) <= 20 and trace['limited']
assert trace['findings'], 'Expected a labelled connection in the imported sample'
for finding in trace['findings']:
    assert 1 <= len(finding['edges']) <= 3
    assert call('/api/transactions/' + finding['transaction_id'])['transaction']['label'] == 'illicit_labelled'
    for edge in finding['edges']:
        outgoing = call('/api/transactions/' + edge['source'] + '/neighbors?limit=100')['outgoing']
        assert edge['target'] in {node['tx_id'] for node in outgoing}
policy = call('/api/copilot', payload={'tx_id': '3181', 'question': 'Trace multi-hop paths'})
assert policy['engine'] == 'local-policy' and policy['trace'] and policy['sources']
call('/api/transactions/not-a-number/trace', 422)
call('/api/transactions/00000000000000000000/trace', 404)
checks.append('Adaptive investigation paths, actual directed edges and endpoint labels verified against real records')

output = {'status': 'passed', 'base_url': BASE, 'checks': checks, 'test_metrics': model['test_metrics']}
folder = Path(__file__).resolve().parents[1] / 'reports'
folder.mkdir(exist_ok=True)
(folder / 'FraudWeave-complete-validation.json').write_text(json.dumps(output, indent=2) + '\n', encoding='utf-8')
print(json.dumps(output, indent=2))

