import { useEffect, useRef, useState } from 'react';
import { listSensors } from '@/api/catalogue';
import { useQuery } from '@tanstack/react-query';

// ── Canvas drawing ─────────────────────────────────────────────────────────────

const drawSineWave = (
  canvas: HTMLCanvasElement,
  frequency: number,
  phase: number,
): void => {
  const ctx = canvas.getContext('2d');
  if (ctx === null) return;

  const { width, height } = canvas;
  ctx.clearRect(0, 0, width, height);

  // Background
  ctx.fillStyle = '#111827';
  ctx.fillRect(0, 0, width, height);

  // Grid lines
  ctx.strokeStyle = '#1f2937';
  ctx.lineWidth = 1;
  for (let x = 0; x < width; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y < height; y += 30) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  // Centre line
  ctx.strokeStyle = '#374151';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, height / 2);
  ctx.lineTo(width, height / 2);
  ctx.stroke();

  // Sine wave
  ctx.strokeStyle = '#6366f1';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let x = 0; x <= width; x++) {
    const t = (x / width) * Math.PI * 2 * frequency + phase;
    const y = height / 2 + Math.sin(t) * (height / 3);
    if (x === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Label
  ctx.fillStyle = '#4b5563';
  ctx.font = '11px monospace';
  ctx.fillText('Mock waveform — connect engineering SDK for live data', 8, 14);
};

// ── Component ─────────────────────────────────────────────────────────────────

export const WaveformPlaceholder = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const phaseRef = useRef<number>(0);
  const [selectedSensor, setSelectedSensor] = useState<string>('');

  const { data } = useQuery({
    queryKey: ['sensors'],
    queryFn: () => listSensors(),
    staleTime: 60_000,
  });

  const sensors = data?.sensors ?? [];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return;

    const animate = () => {
      phaseRef.current += 0.03;
      drawSineWave(canvas, 3, phaseRef.current);
      animRef.current = requestAnimationFrame(animate);
    };

    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="waveform-sensor-select" className="text-xs text-gray-400">
            Sensor
          </label>
          <select
            id="waveform-sensor-select"
            value={selectedSensor}
            onChange={(e) => setSelectedSensor(e.target.value)}
            className="bg-gray-700 border border-gray-600 text-gray-200 text-sm rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">— Select sensor —</option>
            {sensors.map((s) => (
              <option key={s.id} value={s.id}>
                {s.type} ({s.id.slice(-8)})
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-400">Time range</label>
          <select
            className="bg-gray-700 border border-gray-600 text-gray-200 text-sm rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            defaultValue="1h"
          >
            <option value="15m">Last 15 min</option>
            <option value="1h">Last 1 hour</option>
            <option value="6h">Last 6 hours</option>
            <option value="24h">Last 24 hours</option>
          </select>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        width={800}
        height={200}
        className="w-full rounded-lg border border-gray-700"
        aria-label="Waveform placeholder — mock sine wave"
      />

      <p className="text-xs text-gray-500 italic">
        Waveform data requires engineering SDK — connect via TASK-042 API endpoint
      </p>
    </div>
  );
};
