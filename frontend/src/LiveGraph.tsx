import { useEffect, useRef } from 'react'
import cytoscape from 'cytoscape'
import type { GraphData } from './api'

export default function LiveGraph({
  data,
  onSelect,
}: {
  data: GraphData
  onSelect: (id: string) => void
}) {
  const container = useRef<HTMLDivElement>(null)
  const graph = useRef<cytoscape.Core | null>(null)
  const select = useRef(onSelect)
  useEffect(() => {
    select.current = onSelect
  }, [onSelect])

  useEffect(() => {
    if (!container.current) return
    const cy = cytoscape({
      container: container.current,
      elements: [
        ...data.nodes.map((node) => ({
          data: {
            id: node.tx_id,
            label: node.tx_id,
            researchLabel: node.label,
            root: node.tx_id === data.root ? 1 : 0,
          },
        })),
        ...data.edges.map((edge) => ({ data: edge })),
      ],
      style: [
        {
          selector: 'node',
          style: {
            label: 'data(label)',
            'font-size': 10,
            color: '#cbd5e1',
            'text-margin-y': 9,
            'text-valign': 'bottom',
            'background-color': '#d6b878',
            width: 25,
            height: 25,
            'border-width': 2,
            'border-color': '#efd9aa',
          },
        },
        {
          selector: 'node[researchLabel = "illicit_labelled"]',
          style: {
            'background-color': '#fb7185',
            'border-color': '#fecdd3',
            shape: 'diamond',
          },
        },
        {
          selector: 'node[researchLabel = "licit_labelled"]',
          style: {
            'background-color': '#6ee7b7',
            'border-color': '#a7f3d0',
            shape: 'ellipse',
          },
        },
        {
          selector: 'node[researchLabel = "unknown"]',
          style: { shape: 'round-rectangle' },
        },
        {
          selector: 'node[root = 1]',
          style: {
            width: 39,
            height: 39,
            'border-width': 4,
            'border-color': '#f8fafc',
            'font-weight': 'bold',
            color: '#f8fafc',
          },
        },
        {
          selector: 'edge',
          style: {
            width: 1.5,
            'line-color': '#526177',
            'target-arrow-color': '#94a3b8',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'arrow-scale': 0.9,
          },
        },
        { selector: 'node:active', style: { 'overlay-opacity': 0.08 } },
      ],
      layout: {
        name: 'breadthfirst',
        directed: true,
        roots: [data.root],
        padding: 40,
        spacingFactor: 1.3,
        animate: false,
      },
      minZoom: 0.15,
      maxZoom: 3,
    })
    graph.current = cy
    cy.on('tap', 'node', (event) => {
      select.current(event.target.id())
    })
    const observer = new ResizeObserver(() => {
      cy.resize()
      cy.fit(undefined, 40)
    })
    observer.observe(container.current)
    return () => {
      observer.disconnect()
      cy.destroy()
      graph.current = null
    }
  }, [data])

  return (
    <div>
      <div
        ref={container}
        className="live-graph"
        role="img"
        aria-label={`Live transaction graph: ${data.nodes.length} nodes and ${data.edges.length} directed relationships. Use the accessible node list below to select transactions.`}
      />
      <div className="graph-footer">
        <span>
          {data.nodes.length} nodes · {data.edges.length} arrows · selected node
          has a white border
        </span>
        <button
          className="fw-button"
          onClick={() => graph.current?.fit(undefined, 40)}
        >
          Fit graph
        </button>
      </div>
      <details className="node-list">
        <summary>Accessible transaction list ({data.nodes.length})</summary>
        <div>
          {data.nodes.map((node) => (
            <button
              className="fw-button"
              key={node.tx_id}
              onClick={() => onSelect(node.tx_id)}
            >
              {node.tx_id} · {node.label.replaceAll('_', ' ')}
            </button>
          ))}
        </div>
      </details>
    </div>
  )
}
