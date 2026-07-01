import React from 'react';

export default function ScoreRing({ score = 0, size = 110 }) {
  const radius = (size - 14) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 70 ? '#0f766e' : score >= 45 ? '#d97706' : '#be123c';

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e4ddd0" strokeWidth="10" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth="10"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 0.6s ease' }}
      />
      <text x="50%" y="48%" textAnchor="middle" fontSize="26" fontWeight="700" fill="#1c2541" fontFamily="'JetBrains Mono', monospace">
        {score}
      </text>
      <text x="50%" y="66%" textAnchor="middle" fontSize="11" fill="#4b5567">/ 100</text>
    </svg>
  );
}
