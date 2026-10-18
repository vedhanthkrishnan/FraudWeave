"""Isolated synthetic fixtures test limits and uncertainty; never inserted into FalkorDB."""
from pathlib import Path
import unittest
from unittest.mock import patch

from fastapi import HTTPException
from pydantic import ValidationError
from src import investigation as tools
from src.ml import predict


class GraphBoundsTests(unittest.TestCase):
    edges = [('1', '2'), ('1', '3'), ('2', '4'), ('3', '4'), ('4', '5'), ('5', '1')]

    @staticmethod
    def node(id):
        return {'tx_id': id, 'label': 'unknown', 'time_step': 1}

    def neighborhood(self, id, limit=20, verify=True):
        return {'incoming': [self.node(a) for a, b in self.edges if b == id][:limit],
                'outgoing': [self.node(b) for a, b in self.edges if a == id][:limit]}

    def graph(self, **options):
        with patch.object(tools, 'transaction', side_effect=self.node), patch.object(tools, 'neighbors', side_effect=self.neighborhood):
            return tools.graph_view('1', **options)

    def test_direction_and_depth(self):
        result = self.graph(depth=1)
        self.assertEqual({n['tx_id'] for n in result['nodes']}, {'1', '2', '3', '5'})
        self.assertEqual({(e['source'], e['target']) for e in result['edges']}, {('1', '2'), ('1', '3'), ('5', '1')})

    def test_cycles_do_not_duplicate_or_create_dangling_edges(self):
        result = self.graph(depth=3)
        ids = {n['tx_id'] for n in result['nodes']}
        self.assertEqual(len(ids), len(result['nodes']))
        self.assertEqual(len(result['edges']), len({e['id'] for e in result['edges']}))
        self.assertTrue(all(e['source'] in ids and e['target'] in ids for e in result['edges']))

    def test_node_cap_is_strict_and_visible(self):
        result = self.graph(depth=3, max_nodes=2)
        self.assertEqual(len(result['nodes']), 2)
        self.assertTrue(result['truncated'])
        ids = {n['tx_id'] for n in result['nodes']}
        self.assertTrue(all(e['source'] in ids and e['target'] in ids for e in result['edges']))

    def test_directional_sampling_is_reported(self):
        self.assertTrue(self.graph(per_direction=1)['truncated'])

    def test_isolated_fixture_has_a_valid_empty_neighborhood(self):
        with patch.object(tools, 'transaction', side_effect=self.node), patch.object(tools, 'neighbors', return_value={'incoming': [], 'outgoing': []}):
            result = tools.graph_view('1')
        self.assertEqual(len(result['nodes']), 1)
        self.assertEqual(result['edges'], [])
        self.assertFalse(result['truncated'])


class EvidenceTests(unittest.TestCase):
    def test_missing_record_is_not_fabricated(self):
        with patch.object(tools, 'query', return_value=[]), self.assertRaises(HTTPException) as error:
            tools.transaction('123')
        self.assertEqual(error.exception.status_code, 404)

    def test_prediction_cannot_overwrite_research_label(self):
        properties = {'tx_id': '123', 'label': 'unknown', 'time_step': 2}
        with patch.object(tools, 'query', side_effect=[[['unknown', 2], ['licit_labelled', 1], ['illicit_labelled', 1]], [[2]], [[3]]]), \
             patch.object(tools, 'predict', return_value={'available': True, 'predicted_label': 'illicit_labelled', 'score': 0.9}):
            result = tools.risk('123', properties)
        self.assertEqual(result['research_label'], 'unknown')
        self.assertEqual(properties['label'], 'unknown')
        self.assertEqual(result['label_coverage'], 0.5)
        self.assertEqual(result['unique_neighbors'], 4)

    def test_absent_model_is_explicit(self):
        with patch.object(predict, 'MODEL_PATH', Path('/nonexistent-fraudweave-test-artifact.joblib')):
            self.assertFalse(predict.model_status()['available'])
            self.assertFalse(predict.predict({})['available'])

    def test_unsupported_copilot_question_does_not_query_or_invent_sources(self):
        with patch.object(tools, 'query', side_effect=AssertionError('No database tool should run')):
            result = tools.copilot_endpoint(tools.CopilotRequest(question='Who is the private wallet owner?'))
        self.assertEqual(result['tools_used'], [])
        self.assertEqual(result['sources'], [])
        self.assertEqual(result['engine'], 'local-tools')

    def test_copilot_inputs_are_bounded(self):
        with self.assertRaises(ValidationError):
            tools.CopilotRequest(question='x' * 601)
        with self.assertRaises(ValidationError):
            tools.CopilotRequest(question='Summarize', tx_id="1' DROP GRAPH")

    def test_queries_are_read_only_and_have_a_deadline(self):
        with patch.object(tools, 'get_graph') as graph:
            graph.return_value.ro_query.return_value.result_set = [[1]]
            self.assertEqual(tools.query('RETURN $value', {'value': 1}), [[1]])
            graph.return_value.ro_query.assert_called_once_with('RETURN $value', {'value': 1}, timeout=5000)


if __name__ == '__main__':
    unittest.main()
