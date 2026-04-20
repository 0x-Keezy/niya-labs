// Mocked "whisper feed" ticker — static data, auto-scrolling.
// Visual filler for the demo; no real backend connection.

const MOCK_WHISPERS = [
  { time: '14:32 UTC', text: 'Large LP add detected on $PEPE2 (+$12K)' },
  { time: '14:28 UTC', text: 'Dev wallet sold 2% of supply on $DOGE3' },
  { time: '14:25 UTC', text: 'New token launch: $HAMSTER on PancakeSwap' },
  { time: '14:20 UTC', text: 'Whale accumulated 5% of $NIYA supply' },
  { time: '14:17 UTC', text: 'LP lock extended 90d on $CAKE' },
  { time: '14:12 UTC', text: 'Sniper cluster detected on $MOONCAT' },
];

export default function WhisperFeed() {
  return (
    <section style={{ padding: '14px 20px' }}>
      <div className="mb-2 flex items-center gap-2">
        <span
          className="font-body uppercase text-niya-ink-2"
          style={{ fontSize: '9px', fontWeight: 800, letterSpacing: '0.22em' }}
        >
          WHISPER FEED
        </span>
        <span
          className="font-mono text-niya-ink-mute"
          style={{ fontSize: '8px' }}
        >
          mocked
        </span>
      </div>

      <div
        className="overflow-hidden rounded-lg border border-niya-border bg-niya-panel"
        style={{ height: '80px' }}
      >
        <div className="whisper-scroll">
          {/* Duplicate the list for seamless loop */}
          {[...MOCK_WHISPERS, ...MOCK_WHISPERS].map((w, i) => (
            <div
              key={i}
              className="flex items-baseline gap-2 whitespace-nowrap"
              style={{ padding: '4px 12px' }}
            >
              <span
                className="font-mono text-niya-ink-mute"
                style={{ fontSize: '9px', flexShrink: 0 }}
              >
                {w.time}
              </span>
              <span
                className="font-body text-niya-ink-2"
                style={{ fontSize: '10px' }}
              >
                {w.text}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
