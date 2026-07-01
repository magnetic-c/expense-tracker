import React from 'react';

export default function MonthPicker({ value, onChange }) {
  return (
    <input
      type="month"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{ width: 'auto' }}
    />
  );
}
