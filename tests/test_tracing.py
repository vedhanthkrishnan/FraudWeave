import unittest
from src.tracing import investigate


class TraceTests(unittest.TestCase):
    def node(self, id):
        return {'tx_id': id, 'label': 'illicit_labelled' if id == '4' else 'unknown'}

    def test_multi_hop_paths_preserve_actual_edge_direction(self):
        edges = [('2', '1'), ('2', '3'), ('4', '3'), ('3', '1')]
        def neighborhood(id, **kwargs):
            return {'status': 'success', 'limit_per_direction': 11,
                    'incoming': [self.node(a) for a, b in edges if b == id],
                    'outgoing': [self.node(b) for a, b in edges if a == id]}
        result = investigate('1', self.node, neighborhood)
        self.assertEqual(len(result['findings']), 1)
        finding = result['findings'][0]
        self.assertEqual(finding['path'], ['1', '3', '4'])
        self.assertEqual(finding['edges'], [{'source': '3', 'target': '1'}, {'source': '4', 'target': '3'}])
        self.assertEqual(len(result['trace']), len({x['transaction_id'] for x in result['trace']}))

    def test_isolated_node_does_not_claim_clearance(self):
        result = investigate('1', self.node, lambda *args, **kw: {'incoming': [], 'outgoing': []})
        self.assertEqual(result['findings'], [])
        self.assertIn('not a clearance', result['answer'])

    def test_sampling_and_expansion_caps_are_disclosed(self):
        def neighborhood(id, **kwargs):
            return {'incoming': [], 'outgoing': [self.node(str(int(id) * 20 + i)) for i in range(11)]}
        result = investigate('1', self.node, neighborhood)
        self.assertLessEqual(len(result['trace']), 20)
        self.assertTrue(result['limited'])
        self.assertTrue(all(item['depth'] <= 2 for item in result['trace']))

    def test_findings_cap_and_stop_at_labelled_evidence(self):
        def neighborhood(id, **kwargs):
            return {'incoming': [], 'outgoing': [{'tx_id': str(i), 'label': 'illicit_labelled'} for i in range(2, 13)]}
        result = investigate('1', self.node, neighborhood)
        self.assertEqual(len(result['findings']), 8)
        self.assertEqual(len(result['trace']), 1)
        self.assertTrue(result['limited'])

    def test_finds_labelled_evidence_exactly_three_hops_away(self):
        edges = [('1', '2'), ('2', '3'), ('3', '4')]

        def neighborhood(tx_id, **kwargs):
            return {
                'incoming': [
                    self.node(a) for a, b in edges if b == tx_id
                ],
                'outgoing': [
                    self.node(b) for a, b in edges if a == tx_id
                ]
            }

        result = investigate('1', self.node, neighborhood)

        self.assertEqual(len(result['findings']), 1)
        self.assertEqual(
            result['findings'][0]['path'],
            ['1', '2', '3', '4']
        )
        self.assertEqual(
            result['findings'][0]['edges'],
            [
                {'source': '1', 'target': '2'},
                {'source': '2', 'target': '3'},
                {'source': '3', 'target': '4'}
            ]
        )

    def test_finds_multiple_paths_to_same_labelled_transaction(self):
        edges = [
            ('1', '2'),
            ('1', '3'),
            ('2', '4'),
            ('3', '4')
        ]

        def neighborhood(tx_id, **kwargs):
            return {
                'incoming': [
                    self.node(a) for a, b in edges if b == tx_id
                ],
                'outgoing': [
                    self.node(b) for a, b in edges if a == tx_id
                ]
            }

        result = investigate('1', self.node, neighborhood)

        self.assertEqual(len(result['findings']), 2)
        self.assertEqual(
            [finding['path'] for finding in result['findings']],
            [
                ['1', '2', '4'],
                ['1', '3', '4']
            ]
        )

    def test_finds_alternate_paths_through_shared_intermediate(self):
        edges = [
            ('1', '2'),
            ('1', '3'),
            ('2', '5'),
            ('3', '5'),
            ('5', '4')
        ]

        def neighborhood(tx_id, **kwargs):
            return {
                'incoming': [
                    self.node(a) for a, b in edges if b == tx_id
                ],
                'outgoing': [
                    self.node(b) for a, b in edges if a == tx_id
                ]
            }

        result = investigate('1', self.node, neighborhood)

        self.assertEqual(len(result['findings']), 2)
        self.assertEqual(
            [finding['path'] for finding in result['findings']],
            [
                ['1', '2', '5', '4'],
                ['1', '3', '5', '4']
            ]
        )
