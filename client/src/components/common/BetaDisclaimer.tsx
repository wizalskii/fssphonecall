export default function BetaDisclaimer() {
  return (
    <div className="lcd-display p-3 mb-4">
      <div className="flex items-center gap-3">
        <span className="lcd-text lcd-amber text-sm">⚠</span>
        <div>
          <span className="lcd-text lcd-amber text-xs tracking-wider">BETA — TESTING ONLY</span>
          <span className="lcd-text lcd-dim text-xs ml-3">NOT FOR REAL VATSIM OPS</span>
        </div>
      </div>
    </div>
  );
}
