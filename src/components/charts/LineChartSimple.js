import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Polyline, Circle, Line, Text as SvgText } from 'react-native-svg';

export default function LineChartSimple({ datasets = [], labels = [], width = 300, height = 200 }) {
  const padL = 40, padR = 15, padB = 25, padT = 15, svgH = height - 30;
  const chartW = width - padL - padR, chartH = svgH - padT - padB;
  const rawMax = Math.max(...datasets.flatMap((d) => d.data), 0);
  const maxValue = rawMax === 0 ? 100 : rawMax;
  const xStep = labels.length > 1 ? chartW / (labels.length - 1) : chartW;

  return (
    <View style={{ width, height }}>
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 16, height: 30, alignItems: 'center' }}>
        {datasets.map((ds, idx) => (
          <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: ds.color }} />
            <Text style={{ fontSize: 12, color: '#4B5563', fontWeight: '500' }}>{ds.label}</Text>
          </View>
        ))}
      </View>
      <Svg width={width} height={svgH}>
        {[0, maxValue * 0.5, maxValue].map((val, idx) => {
          const y = svgH - padB - (val / maxValue) * chartH;
          return (
            <React.Fragment key={idx}>
              <Line x1={padL} y1={y} x2={width - padR} y2={y} stroke="#E5E7EB" strokeWidth={1} strokeDasharray="4,4" />
              <SvgText x={padL - 8} y={y + 4} fontSize="10" fill="#9CA3AF" textAnchor="end">
                {val >= 1000 ? `${(val / 1000).toFixed(0)}k` : Math.round(val)}
              </SvgText>
            </React.Fragment>
          );
        })}
        {datasets.map((ds, dsIdx) => {
          const pts = ds.data.map((v, i) => `${padL + i * xStep},${svgH - padB - (v / maxValue) * chartH}`).join(' ');
          return (
            <React.Fragment key={dsIdx}>
              <Polyline points={pts} fill="none" stroke={ds.color} strokeWidth={3} />
              {ds.data.map((v, i) => (
                <Circle key={i} cx={padL + i * xStep} cy={svgH - padB - (v / maxValue) * chartH} r={4} fill={ds.color} stroke="#FFF" strokeWidth={1} />
              ))}
            </React.Fragment>
          );
        })}
        {labels.map((lbl, i) => (
          <SvgText key={i} x={padL + i * xStep} y={svgH - 6} fontSize="10" fill="#9CA3AF" textAnchor="middle">{lbl}</SvgText>
        ))}
      </Svg>
    </View>
  );
}
