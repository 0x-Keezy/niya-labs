// Hero card for Scout Mode. Shows the rug-risk score with the brand
// "gold accent" top border that ties the extension visually to the
// Niya VTuber web app (the only colour shared between the two products).
//
// Empty-data fallback: if `topHolders.length === 0` we know Moralis
// failed and the score is unreliable, so we show a neutral state instead
// of misleading the user with a "0/100 looks healthy" message.

import type { MicrostructureResult } from '../../lib/types';
import ScoreRing from './ScoreRing';

interface RugRiskCardProps {
  result: MicrostructureResult;
}

export default function RugRiskCard({ result }: RugRiskCardProps) {
  const insufficientData = result.topHolders.length === 0;
  const healthy = !insufficientData && result.rugRiskScore < 25;

  return (
    <div className="rounded-xl border border-niya-border border-t-2 border-t-niya-gold bg-niya-panel p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-niya-ink-2">
            Rug Risk
          </div>
          <div className="text-sm font-bold text-niya-ink">Scout Score</div>
        </div>
        <div className="text-[9px] uppercase tracking-wider text-niya-gold">
          ✦ Niya Tools
        </div>
      </div>

      <div className="mt-3 flex items-center gap-4">
        <ScoreRing
          score={insufficientData ? 0 : result.rugRiskScore}
          healthy={healthy}
        />
        <div className="min-w-0 flex-1">
          {insufficientData ? (
            <p className="text-sm leading-snug text-niya-ink/90">
              Insufficient on-chain data to score this token. Holders feed is
              unavailable right now.
            </p>
          ) : (
            <p className="text-sm leading-snug text-niya-ink/90">
              {result.riskHeadline}
            </p>
          )}
        </div>
      </div>

      {!insufficientData && (
        <div className="mt-3 flex justify-between gap-1 border-t border-niya-border/40 pt-2 text-[9px] uppercase tracking-wider text-niya-ink-2">
          <span>Holders</span>
          <span>·</span>
          <span>Liquidity</span>
          <span>·</span>
          <span>Snipers</span>
          <span>·</span>
          <span>Dev</span>
        </div>
      )}
    </div>
  );
}
