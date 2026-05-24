/**
 * ConfidenceSparkline — pure SVG confidence trend line.
 * No recharts. Renders a polyline of confidence values from ML history events,
 * with line segments coloured by BERT label and a dashed 0.80 threshold line.
 */

import React from 'react';
import type { MLHistoryEntry } from '../../types/userDiagnostic';
import { getLabelColor } from '../../types/userDiagnostic';

interface Props {
  events: MLHistoryEntry[];
}

const SVG_W = 100; // viewBox width  (coordinates 0‥100)
const SVG_H = 60;  // viewBox height (coordinates 0‥60)
const PAD_T = 8;
const PAD_B = 10;
const PAD_L = 2;
const PAD_R = 2;
const PLOT_W = SVG_W - PAD_L - PAD_R;
const PLOT_H = SVG_H - PAD_T - PAD_B;
const THRESHOLD = 0.80;

function toY(confidence: number): number {
  const clamped = Math.max(0, Math.min(1, confidence));
  return PAD_T + (1 - clamped) * PLOT_H;
}

function toX(index: number, total: number): number {
  if (total <= 1) return PAD_L + PLOT_W / 2;
  return PAD_L + (index / (total - 1)) * PLOT_W;
}

export default function ConfidenceSparkline({ events }: Props) {
  // Reverse so oldest is on the left
  const ordered = [...events].reverse();
  const n = ordered.length;

  if (n < 2) {
    return (
      <div className="w-full h-[60px] flex items-center justify-center text-xs text-slate-400 italic">
        Not enough events for trend
      </div>
    );
  }

  const refY = toY(THRESHOLD);

  interface Point { x: number; y: number }
  const pts: Point[] = ordered.map((ev, i) => ({
    x: toX(i, n),
    y: toY(typeof ev.confidence === 'number' ? ev.confidence : 0.5),
  }));

  return (
    <svg
      width="100%"
      height={SVG_H}
      viewBox={`0 0 ${SVG_W} ${SVG_H}`}
      preserveAspectRatio="none"
      aria-label="Confidence trend sparkline"
    >
      {/* 0.80 reference line */}
      <line
        x1={PAD_L}
        y1={refY}
        x2={SVG_W - PAD_R}
        y2={refY}
        stroke="#94a3b8"
        strokeWidth="0.6"
        strokeDasharray="2 2"
      />
      {/* Reference label */}
      <text x={SVG_W - PAD_R - 1} y={refY - 1.5} fontSize="4" fill="#94a3b8" textAnchor="end">
        0.80
      </text>

      {/* Coloured line segments */}
      {ordered.slice(0, -1).map((ev, i) => (
        <line
          key={`seg-${i}`}
          x1={pts[i].x}
          y1={pts[i].y}
          x2={pts[i + 1].x}
          y2={pts[i + 1].y}
          stroke={getLabelColor(ev.prediction)}
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      ))}

      {/* Dots per event */}
      {ordered.map((ev, i) => (
        <circle
          key={`dot-${i}`}
          cx={pts[i].x}
          cy={pts[i].y}
          r="1.8"
          fill={getLabelColor(ev.prediction)}
          stroke="white"
          strokeWidth="0.8"
        />
      ))}
    </svg>
  );
}
