import { useEffect, useRef, useState } from 'react'
import cytoscape from 'cytoscape'
import type { GraphData } from './api'

export default function LiveGraph({
  data,
  onSelect,
}: {
  data: GraphData
  onSelect: (id: string) => void
}) {
  const [hover, setHover] = useState('Hover a node for metadata · arrows show source → target')
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
            timeStep: node.time_step,
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
            color: '#d7d0c5',
            'text-margin-y': 9,
            'text-valign': 'bottom',
            'background-color': '#b7a28c',
            width: 25,
            height: 25,
            'border-width': 2,
            'border-color': '#d7c4b2',
          },
        },
        {
          selector: 'node[researchLabel = "illicit_labelled"]',
          style: {
            'background-color': '#cf837c',
            'border-color': '#e7aaa2',
            shape: 'diamond',
          },
        },
        {
          selector: 'node[researchLabel = "licit_labelled"]',
          style: {
            'background-color': '#edebdd',
            'border-color': '#d7c4b2',
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
            'line-color': '#8e746d',
            'target-arrow-color': '#b8aaa0',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'arrow-scale': 0.9,
          },
        },
        {selector: '.incoming', style: {'line-color':'#edebdd','target-arrow-color':'#edebdd',width:3}},
        {selector: '.outgoing', style: {'line-color':'#cf837c','target-arrow-color':'#cf837c',width:3}},
        {selector: '.muted', style: {opacity:0.65}},
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
    const root=cy.getElementById(data.root)
    root.incomers('edge').addClass('incoming'); root.outgoers('edge').addClass('outgoing')
    cy.edges().not(root.connectedEdges()).addClass('muted')
    cy.on('mouseover', 'node', event => {const n=event.target;setHover(`${n.id()} · ${n.data('researchLabel').replaceAll('_',' ')} · time step ${n.data('timeStep')}`)})
    cy.on('mouseout', 'node', () => setHover('Hover a node for metadata · arrows show source → target'))
    cy.on('tap', event => {if(event.target===cy) cy.elements().unselect()})
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
      <div className="graph-hover" aria-live="off">{hover}</div>
      <div className="graph-footer">
        <span>
          {data.nodes.length} nodes · {data.edges.length} arrows · selected node
          has a white border
        </span>
        <div className="graph-tools"><button className="fw-button" onClick={() => {const cy=graph.current;if(cy)cy.layout({name:'breadthfirst',directed:true,roots:[data.root],padding:50,animate:false}).run()}}>Reset layout</button><button className="fw-button" onClick={() => {const cy=graph.current;if(cy)cy.fit(cy.getElementById(data.root).closedNeighborhood(),50)}}>Focus selected</button>
        <button
          className="fw-button"
          onClick={() => graph.current?.fit(undefined, 40)}
        >
          Fit graph
        </button></div>
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
