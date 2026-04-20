import { useNiyaStore } from '../store';

export default function TierChip() {
  const tier = useNiyaStore((s) => s.tier);
  const walletAgeDays = useNiyaStore((s) => s.walletAgeDays);
  const userAddress = useNiyaStore((s) => s.userAddress);

  const ageLabel =
    userAddress && walletAgeDays != null
      ? walletAgeDays < 90
        ? '<90d'
        : `${walletAgeDays}d`
      : null;

  return (
    <span
      className="inline-flex items-center gap-[6px] rounded-full"
      style={{
        background: '#0F1115',
        padding: '7px 12px 7px 10px',
        boxShadow: '0 4px 12px -4px rgba(15,17,21,0.35)',
      }}
    >
      {/* pulsing dot */}
      <span className="niya-pulsing-dot shrink-0" />

      {/* tier name */}
      <span
        className="font-body text-white uppercase"
        style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '0.1em' }}
      >
        {tier}
      </span>

      {/* age label */}
      {ageLabel && (
        <span
          className="font-mono text-white"
          style={{ fontSize: '9px', opacity: 0.65 }}
        >
          {ageLabel}
        </span>
      )}
    </span>
  );
}
