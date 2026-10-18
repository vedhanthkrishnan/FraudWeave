import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

export function NeighborChart({
  data,
}: {
  data: { label: string; count: number; fill: string }[]
}) {
  return (
    <div
      className="neighbor-chart"
      role="img"
      aria-label={`Neighbor research labels: ${data.map((item) => `${item.label}: ${item.count}`).join(', ')}`}
    >
      <ResponsiveContainer width="100%" height={185}>
        <BarChart data={data} layout="vertical" margin={{ left: 5, right: 20 }}>
          <CartesianGrid stroke="#263040" horizontal={false} />
          <XAxis
            type="number"
            allowDecimals={false}
            tick={{ fill: '#94a3b8', fontSize: 10 }}
          />
          <YAxis
            type="category"
            dataKey="label"
            width={105}
            tick={{ fill: '#cbd5e1', fontSize: 10 }}
          />
          <Tooltip
            contentStyle={{
              background: '#121b28',
              border: '1px solid #334155',
              color: '#f1f5f9',
            }}
          />
          <Bar dataKey="count" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function TimelineChart({
  data,
}: {
  data: {
    time_step: number
    illicit_labelled: number
    licit_labelled: number
    unknown: number
  }[]
}) {
  return (
    <div
      className="timeline-chart"
      role="img"
      aria-label="Stacked dataset counts across 49 historical time steps"
    >
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={data}>
          <CartesianGrid stroke="#263040" />
          <XAxis dataKey="time_step" tick={{ fill: '#94a3b8', fontSize: 10 }} />
          <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
          <Tooltip
            contentStyle={{
              background: '#121b28',
              border: '1px solid #334155',
            }}
          />
          <Legend />
          <Area
            dataKey="unknown"
            stackId="1"
            fill="#d6b878"
            stroke="#d6b878"
            fillOpacity={0.3}
          />
          <Area
            dataKey="licit_labelled"
            stackId="1"
            fill="#6ee7b7"
            stroke="#6ee7b7"
            fillOpacity={0.5}
          />
          <Area
            dataKey="illicit_labelled"
            stackId="1"
            fill="#fb7185"
            stroke="#fb7185"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
