export default function SignatureFooter() {
  return (
    <footer
      className="flex items-center justify-between"
      style={{
        padding: '20px 20px 24px',
        gap: '16px',
        background: 'linear-gradient(180deg, #FFFBF5 0%, #FFF5E8 100%)',
      }}
    >
      {/* Disclaimer */}
      <p
        className="font-body text-niya-ink-mute"
        style={{ fontSize: '10px', lineHeight: 1.5, maxWidth: '230px' }}
      >
        Analysis only. Never a recommendation. Niya reads on-chain data and
        reports what it finds. Your capital, your call.
      </p>

      {/* Signature */}
      <div className="text-right">
        <p className="niya-signature font-display text-niya-ink" style={{ fontSize: '24px', fontWeight: 800 }}>
          &mdash; Niya
        </p>
        <p
          className="font-body italic text-niya-ink-mute"
          style={{ fontSize: '9px' }}
        >
          your on-chain companion
        </p>
      </div>
    </footer>
  );
}
