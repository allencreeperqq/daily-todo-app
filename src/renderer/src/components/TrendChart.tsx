interface TrendPoint {
  month: string
  income: number
  expense: number
}

interface TrendChartProps {
  data: TrendPoint[]
  formatValue: (n: number) => string
}

export default function TrendChart({ data, formatValue }: TrendChartProps) {
  const max = Math.max(1, ...data.flatMap((d) => [d.income, d.expense]))

  return (
    <div className="trend-chart">
      <div className="trend-legend">
        <span className="trend-legend-item">
          <span className="trend-dot income" /> 收入
        </span>
        <span className="trend-legend-item">
          <span className="trend-dot expense" /> 支出
        </span>
      </div>
      <div className="trend-bars">
        {data.map((d) => (
          <div key={d.month} className="trend-month">
            <div className="trend-bar-pair">
              <div
                className="trend-bar income"
                style={{ height: `${(d.income / max) * 100}%` }}
                title={`收入 ${formatValue(d.income)}`}
              />
              <div
                className="trend-bar expense"
                style={{ height: `${(d.expense / max) * 100}%` }}
                title={`支出 ${formatValue(d.expense)}`}
              />
            </div>
            <span className="trend-month-label">{Number(d.month.slice(5))} 月</span>
          </div>
        ))}
      </div>
    </div>
  )
}
