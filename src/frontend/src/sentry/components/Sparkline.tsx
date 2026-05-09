interface SparklineProps {
  data: number[];
  color?: string;
  fill?: boolean;
  height?: number;
}

export const Sparkline = ({
  data,
  color = 'var(--accent)',
  fill = true,
  height = 36,
}: SparklineProps) => {
  const w = 200;
  const h = height;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map<[number, number]>((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return [x, y];
  });
  const path = pts
    .map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`))
    .join(' ');
  const fillPath = `${path} L${w},${h} L0,${h} Z`;

  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      {fill && <path d={fillPath} fill={color} opacity="0.12" />}
      <path d={path} fill="none" stroke={color} strokeWidth="1.5" />
    </svg>
  );
};
