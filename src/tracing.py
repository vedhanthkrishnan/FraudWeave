from collections import deque
from datetime import datetime, timezone
from time import monotonic


def investigate(tx_id, lookup, neighborhood):
    root = lookup(tx_id)
    queue = deque([(root, [tx_id], [])])
    seen = {tx_id}
    trace, findings = [], []
    finding_paths = set()
    shortest_finding_depth = {}

    neighborhood_cache = {}
    started = monotonic()
    sampled = False

    while (
        queue
        and len(trace) < 20
        and len(findings) < 8
        and monotonic() - started < 8
    ):
        node, path, edges = queue.popleft()
        current_id = node['tx_id']

        if len(path) > 3:
            continue

        if current_id not in neighborhood_cache:
            links = neighborhood(current_id, limit=11, verify=False)
            neighborhood_cache[current_id] = links

            trace.append({
                'transaction_id': current_id,
                'tool': 'bounded_neighbors',
                'reason': (
                    'Inspect the selected transaction.'
                    if len(path) == 1
                    else 'Follow an observed connection to check for labelled evidence within three hops.'
                ),
                'depth': len(path) - 1,
                'returned': {
                    key: len(links[key])
                    for key in ('incoming', 'outgoing')
                }
            })

        links = neighborhood_cache[current_id]
        candidates = []

        for direction in ('incoming', 'outgoing'):
            sampled |= len(links[direction]) > 10

            for other in links[direction][:10]:
                next_id = other['tx_id']

                # Prevent cycles within this particular path, without
                # suppressing alternate paths through shared transactions.
                if next_id in path:
                    continue

                edge = {
                    'source': (
                        next_id if direction == 'incoming'
                        else current_id
                    ),
                    'target': (
                        current_id if direction == 'incoming'
                        else next_id
                    )
                }

                next_path = path + [next_id]
                next_edges = edges + [edge]

                if other['label'] == 'illicit_labelled':
                    path_key = tuple(next_path)
                    depth = len(next_path) - 1
                    best_depth = shortest_finding_depth.get(next_id)

                    if best_depth is None or depth < best_depth:
                        findings[:] = [
                            finding for finding in findings
                            if finding['transaction_id'] != next_id
                        ]
                        finding_paths = {
                            tuple(finding['path']) for finding in findings
                        }
                        shortest_finding_depth[next_id] = depth
                        best_depth = depth

                    if depth == best_depth and path_key not in finding_paths:
                        finding_paths.add(path_key)
                        findings.append({
                            'transaction_id': next_id,
                            'label': other['label'],
                            'path': next_path,
                            'edges': next_edges
                        })

                    seen.add(next_id)

                    if len(findings) >= 8:
                        break

                elif len(next_path) <= 3:
                    seen.add(next_id)
                    candidates.append((other, next_path, next_edges))
            if len(findings) >= 8:
                break

        # Keep breadth-first ordering deterministic. Different paths may
        # reuse a cached neighborhood without issuing another DB query.
        candidates.sort(
            key=lambda item: (
                item[0]['label'] != 'unknown',
                item[0]['tx_id']
            )
        )
        queue.extend(candidates)

    limited = (
        sampled
        or bool(queue)
        or len(findings) >= 8
        or len(trace) >= 20
        or monotonic() - started >= 8
    )

    answer = (
        f"Inspected {len(trace)} neighborhoods and observed "
        f"{len(seen)} distinct transactions. "
        f"Found {len(findings)} "
        f"{'path' if len(findings) == 1 else 'paths'} to "
        f"illicit-labelled research records within three hops. [T1]"
    )

    for finding in findings:
        answer += (
            '\n\nObserved connection path: '
            + ' ? '.join(finding['path'])
            + '. [T1]'
        )

    answer += (
        '\n\nPaths can traverse incoming and outgoing connections; '
        'the edge list preserves actual flow direction. '
        'Association is not proof of wrongdoing. '
        + (
            'Search limits were reached; additional paths may exist.'
            if limited
            else 'No further paths were found within this three-hop policy; '
                 'this is not a clearance decision.'
        )
    )

    return {
        'transaction_id': tx_id,
        'generated_at': datetime.now(timezone.utc).isoformat(),
        'answer': answer,
        'findings': findings,
        'trace': trace,
        'limited': limited,
        'observed_nodes': len(seen),
        'policy': (
            'Unknown-first bounded breadth-first exploration; '
            'stop at illicit-labelled evidence.'
        ),
        'limits': {
            'hops': 3,
            'expansions': 20,
            'neighbors_per_direction': 10,
            'findings': 8,
            'elapsed_budget_seconds': 8,
            'query_timeout_seconds': 5
        },
        'sources': [{
            'id': 'T1',
            'title': 'Auditable graph investigation',
            'endpoint': f'/api/transactions/{tx_id}/trace'
        }]
    }
