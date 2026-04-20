interface ScaleBarProps {
  score: number; // 0-100
}

export default function ScaleBar({ score }: ScaleBarProps) {
  const clamped = Math.max(0, Math.min(100, score));

  return (
    <div>
      {/* Gradient bar with marker */}
      <div className="niya-scale-bar" style={{ position: 'relative' }}>
        <div
          className="niya-scale-marker"
          style={{ left: `${clamped}%`, transform: 'translateX(-50%)' }}
        />
      </div>

      {/* Legend */}
      <div
        className="flex justify-between"
        style={{ marginTop: '10px' }}
      >
        {['Safer', 'Caution', 'Rug territory'].map((label) => (
          <span
            key={label}
            className="font-body uppercase"
            style={{
              fontSize: '9px',
              fontWeight: 700,
              letterSpacing: '0.1em',
              color: 'rgba(245,233,212,0.45)',
            }}
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
