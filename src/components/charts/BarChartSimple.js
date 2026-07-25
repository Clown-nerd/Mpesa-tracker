import React from 'react';
import Svg, { Rect, Text as SvgText, Line } from 'react-native-svg';

const formatKes = (value) => {
  if (value >= 1000) return `${Number((value / 1000).toFixed(1))}k`;
  return `${Math.round(value)}`;
};

export default function BarChartSimple({ data = [], width = 300, height = 180, color = '#00A86B' }) {
  const paddingLeft = 40;
  const paddingBottom = 20;
  const paddingRight = 10;
  const paddingTop = 15;

  const availableWidth = width - paddingLeft - paddingRight;
  const availableHeight = height - paddingTop - paddingBottom;

  const rawMax = Math.max(...data.map((d) => d.value), 0);
  const maxValue = rawMax === 0 ? 100 : rawMax;

  const yLabels = [0, maxValue * 0.33, maxValue * 0.66, maxValue];
  const barWidth = data.length > 0 ? (availableWidth / data.length) * 0.7 : 0;
  const totalBarSpace = data.length > 0 ? availableWidth / data.length : 0;
  const barGap = totalBarSpace - barWidth;

  return (
    <Svg width={width} height={height}>
      {/* Y-axis grid lines and labels */}
      {yLabels.map((val, idx) => {
        const pct = val / maxValue;
        const y = paddingTop + availableHeight * (1 - pct);
        return (
          <React.Fragment key={idx}>
            <Line
              x1={paddingLeft}
              y1={y}
              x2={width - paddingRight}
              y2={y}
              stroke="#E5E7EB"
              strokeWidth={1}
              strokeDasharray={idx > 0 && idx < 3 ? '4,4' : undefined}
            />
            <SvgText
              x={paddingLeft - 8}
              y={y + 4}
              fontSize="10"
              fill="#9CA3AF"
              textAnchor="end"
            >
              {formatKes(val)}
            </SvgText>
          </React.Fragment>
        );
      })}

      {/* X-axis baseline */}
      <Line
        x1={paddingLeft}
        y1={paddingTop + availableHeight}
        x2={width - paddingRight}
        y2={paddingTop + availableHeight}
        stroke="#E5E7EB"
        strokeWidth={1}
      />

      {/* Bars and X labels */}
      {data.map((item, i) => {
        const barHeight = (item.value / maxValue) * availableHeight;
        const x = paddingLeft + i * totalBarSpace + barGap / 2;
        const y = paddingTop + availableHeight - barHeight;
        const xCenter = x + barWidth / 2;

        return (
          <React.Fragment key={i}>
            {barHeight > 0 && (
              <Rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                fill={color}
                rx={4}
              />
            )}
            <SvgText
              x={xCenter}
              y={height - 4}
              fontSize="10"
              fill="#9CA3AF"
              textAnchor="middle"
            >
              {item.label}
            </SvgText>
          </React.Fragment>
        );
      })}
    </Svg>
  );
}
