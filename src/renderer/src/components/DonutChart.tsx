import { useEffect, useState } from 'react'
import { getResolvedTheme, onThemeChange } from '../theme'

// Validated categorical palette (fixed hue order — see dataviz skill).
// Kept as resolved hex per theme rather than CSS vars so the luminance
// check below (for on-arc label color) can compute against a real color.
export const SERIES_PALETTE = [
  { light: '#2a78d6', dark: '#3987e5' }, // blue
  { light: '#1baf7a', dark: '#199e70' }, // aqua
  { light: '#eda100', dark: '#c98500' }, // yellow
  { light: '#008300', dark: '#008300' }, // green
  { light: '#4a3aa7', dark: '#9085e9' }, // violet
  { light: '#e34948', dark: '#e66767' }, // red
  { light: '#e87ba4', dark: '#d55181' }, // magenta
  { light: '#eb6834', dark: '#d95926' } // orange
]
const OTHER_COLOR = '#898781'

function usePrefersDark(): boolean {
  // Follows the resolved theme (system preference or the user's manual
  // override in Settings -> 外觀), not the raw OS preference directly.
  const [isDark, setIsDark] = useState(() => getResolvedTheme() === 'dark')
  useEffect(() => onThemeChange((theme) => setIsDark(theme === 'dark')), [])
  return isDark
}

export function seriesColor(index: number, isDark: boolean): string {
  const slot = SERIES_PALETTE[index]
  if (!slot) return OTHER_COLOR
  return isDark ? slot.dark : slot.light
}

function relativeLuminance(hex: string): number {
  const c = hex.replace('#', '')
  const r = parseInt(c.slice(0, 2), 16) / 255
  const g = parseInt(c.slice(2, 4), 16) / 255
  const b = parseInt(c.slice(4, 6), 16) / 255
  const lin = (v: number): number => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

const SIZE = 220
const CENTER = SIZE / 2
const R_OUTER = 100
const R_INNER = 62
const GAP_DEG = 2.2

function polarToCartesian(angleDeg: number, r: number): { x: number; y: number } {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return { x: CENTER + r * Math.cos(rad), y: CENTER + r * Math.sin(rad) }
}

function arcPath(startAngle: number, endAngle: number): string {
  const startOuter = polarToCartesian(startAngle, R_OUTER)
  const endOuter = polarToCartesian(endAngle, R_OUTER)
  const startInner = polarToCartesian(startAngle, R_INNER)
  const endInner = polarToCartesian(endAngle, R_INNER)
  const largeArc = endAngle - startAngle > 180 ? 1 : 0
  return [
    `M ${startOuter.x} ${startOuter.y}`,
    `A ${R_OUTER} ${R_OUTER} 0 ${largeArc} 1 ${endOuter.x} ${endOuter.y}`,
    `L ${endInner.x} ${endInner.y}`,
    `A ${R_INNER} ${R_INNER} 0 ${largeArc} 0 ${startInner.x} ${startInner.y}`,
    'Z'
  ].join(' ')
}

export interface DonutSlice {
  label: string
  value: number
  color: string
}

interface DonutChartProps {
  data: DonutSlice[]
  centerLabel: string
  centerValue: string
  formatValue: (n: number) => string
}

export default function DonutChart({ data, centerLabel, centerValue, formatValue }: DonutChartProps) {
  const total = data.reduce((sum, d) => sum + d.value, 0)

  let cursor = 0
  const segments = data.map((d) => {
    const sweep = total > 0 ? (d.value / total) * 360 : 0
    const rawEnd = cursor + sweep
    const start = cursor + GAP_DEG / 2
    const end = Math.max(start, rawEnd - GAP_DEG / 2)
    const mid = (start + end) / 2
    cursor = rawEnd
    return { ...d, start, end, mid, share: total > 0 ? d.value / total : 0 }
  })

  if (total === 0) {
    return <p className="empty">本月尚無支出紀錄</p>
  }

  return (
    <div className="donut-chart">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        width={SIZE}
        height={SIZE}
        role="img"
        aria-label={`${centerLabel} ${centerValue}`}
      >
        {segments.map((seg) => (
          <path key={seg.label} d={arcPath(seg.start, seg.end)} style={{ fill: seg.color }} />
        ))}
        {segments
          .filter((seg) => seg.share >= 0.06)
          .map((seg) => {
            const pos = polarToCartesian(seg.mid, (R_OUTER + R_INNER) / 2)
            const textColor = relativeLuminance(seg.color) > 0.45 ? '#0b0b0b' : '#ffffff'
            return (
              <text
                key={`label-${seg.label}`}
                x={pos.x}
                y={pos.y}
                style={{ fill: textColor }}
                fontSize="11"
                fontWeight="600"
                textAnchor="middle"
                dominantBaseline="middle"
              >
                {Math.round(seg.share * 100)}%
              </text>
            )
          })}
        <text x={CENTER} y={CENTER - 6} textAnchor="middle" className="donut-center-label">
          {centerLabel}
        </text>
        <text x={CENTER} y={CENTER + 16} textAnchor="middle" className="donut-center-value">
          {centerValue}
        </text>
      </svg>

      <ul className="donut-legend">
        {data.map((d) => (
          <li key={d.label}>
            <span className="donut-swatch" style={{ background: d.color }} />
            <span className="donut-legend-label">{d.label}</span>
            <span className="donut-legend-value">
              {formatValue(d.value)} · {Math.round((d.value / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export { usePrefersDark }
