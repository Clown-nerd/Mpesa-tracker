import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';

export default function PieChartSimple({ data = [], size = 200 }) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 8;

  const total = data.reduce((acc, d) => acc + d.population, 0);

  let accumulatedAngle = -Math.PI / 2;

  return (
    <View style={{ alignItems: 'center' }}>
      <Svg width={size} height={size}>
        {total === 0 ? (
          <Circle cx={cx} cy={cy} r={r} fill="#E5E7EB" />
        ) : (
          data.map((item, i) => {
            const pct = item.population / total;
            if (pct <= 0) return null;
            if (pct >= 0.999) {
              return <Circle key={i} cx={cx} cy={cy} r={r} fill={item.color} />;
            }

            const startAngle = accumulatedAngle;
            const endAngle = startAngle + pct * 2 * Math.PI;
            accumulatedAngle = endAngle;

            const x1 = cx + r * Math.cos(startAngle);
            const y1 = cy + r * Math.sin(startAngle);
            const x2 = cx + r * Math.cos(endAngle);
            const y2 = cy + r * Math.sin(endAngle);

            const largeArcFlag = pct > 0.5 ? 1 : 0;
            const pathData = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;

            return <Path key={i} d={pathData} fill={item.color} />;
          })
        )}
      </Svg>

      <View style={{ width: '100%', marginTop: 16 }}>
        {data.map((item, i) => (
          <View
            key={i}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: 6,
              borderBottomWidth: i < data.length - 1 ? 1 : 0,
              borderBottomColor: '#F3F4F6',
            }}
          >
            <View
              style={{
                width: 10,
                height: 10,
                borderRadius: 2,
                backgroundColor: item.color,
                marginRight: 10,
              }}
            />
            <Text style={{ flex: 1, fontSize: 13, color: '#4B5563', fontWeight: '500' }}>
              {item.name}
            </Text>
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#1F2937' }}>
              KES {item.population.toLocaleString()}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
