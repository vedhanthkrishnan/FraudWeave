"""Bounded, deterministic graph investigation policy with an auditable tool trace."""
from collections import deque
from datetime import datetime, timezone
from time import monotonic


def investigate(tx_id, lookup, neighborhood):
    root = lookup(tx_id)
    queue = deque([(root, [tx_id], [])])
    seen = {tx_id}
    trace, findings = [], []
    started = monotonic()
    sampled = False
    while queue and len(trace) < 20 and len(findings) < 8 and monotonic() - started < 8:
        node, path, edges = queue.popleft()
        if len(path) > 3:
            continue
        links = neighborhood(node['tx_id'], limit=11, verify=False)
        trace.append({'transaction_id': node['tx_id'], 'tool': 'bounded_neighbors',
                      'reason': 'Inspect the selected transaction.' if len(path) == 1 else
                      'Follow an observed connection to check for labelled evidence within three hops.',
                      'depth': len(path) - 1,
                      'returned': {key: len(links[key]) for key in ('incoming', 'outgoing')}})
        candidates = []
        for direction in ('incoming', 'outgoing'):
            sampled |= len(links[direction]) > 10
            for other in links[direction][:10]:
                next_id = other['tx_id']
                if next_id in seen:
                    continue
                seen.add(next_id)
                edge = {'source': next_id if direction == 'incoming' else node['tx_id'],
                        'target': node['tx_id'] if direction == 'incoming' else next_id}
                next_path, next_edges = path + [next_id], edges + [edge]
                if other['label'] == 'illicit_labelled':
                    findings.append({'transaction_id': next_id, 'label': other['label'],
                                     'path': next_path, 'edges': next_edges})
                    if len(findings) >= 8:
                        break
                elif len(next_path) <= 3:
                    candidates.append((other, next_path, next_edges))
            if len(findings) >= 8:
                break
        # Unknown records are followed first; the returned graph determines the next tool call.
        candidates.sort(key=lambda item: (item[0]['label'] != 'unknown', item[0]['tx_id']))
        queue.extend(candidates)
    limited = sampled or bool(queue) or len(findings) >= 8
    answer = (f"Inspected {len(trace)} neighborhoods and observed {len(seen)} distinct transactions. "
              f"Found {len(findings)} {'path' if len(findings) == 1 else 'paths'} to illicit-labelled research records within three hops. [T1]")
    for finding in findings:
        answer += '\n\nObserved connection path: ' + ' — '.join(finding['path']) + '. [T1]'
    answer += ('\n\nPaths can traverse incoming and outgoing connections; the edge list preserves actual flow direction. '
               'Association is not proof of wrongdoing. ' +
               ('Search limits were reached; additional paths may exist.' if limited else
                'No further paths were found within this three-hop policy; this is not a clearance decision.'))
    return {'transaction_id': tx_id, 'generated_at': datetime.now(timezone.utc).isoformat(),
            'answer': answer, 'findings': findings, 'trace': trace, 'limited': limited,
            'observed_nodes': len(seen), 'policy': 'Unknown-first bounded breadth-first exploration; stop at illicit-labelled evidence.',
            'limits': {'hops': 3, 'expansions': 20, 'neighbors_per_direction': 10, 'findings': 8,
                       'elapsed_budget_seconds': 8, 'query_timeout_seconds': 5},
            'sources': [{'id': 'T1', 'title': 'Auditable graph investigation',
                         'endpoint': f'/api/transactions/{tx_id}/trace'}]}
