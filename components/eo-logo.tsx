export function EOLogo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <svg aria-hidden="true" viewBox="0 0 88 88" className={compact ? "h-10 w-10 shrink-0" : "h-14 w-14 shrink-0"}>
        <circle cx="44" cy="44" r="40" fill="none" stroke="#4338F2" strokeWidth="4" strokeLinecap="round" strokeDasharray="212 32" transform="rotate(-78 44 44)" />
        <circle cx="44" cy="44" r="32" fill="none" stroke="#FF3F7B" strokeWidth="4" strokeLinecap="round" strokeDasharray="166 26" transform="rotate(38 44 44)" />
        <circle cx="44" cy="44" r="24" fill="none" stroke="#FF8748" strokeWidth="4" strokeLinecap="round" strokeDasharray="123 28" transform="rotate(150 44 44)" />
        <circle cx="44" cy="44" r="16" fill="none" stroke="#2CA99A" strokeWidth="4" strokeLinecap="round" strokeDasharray="80 22" transform="rotate(258 44 44)" />
      </svg>
      <div className="leading-none">
        <p className={compact ? "text-base font-semibold tracking-tight text-eo-purple" : "text-2xl font-normal tracking-tight text-eo-purple"}>
          Entrepreneurs&apos;
        </p>
        <p className={compact ? "text-base font-semibold tracking-tight text-eo-purple" : "text-2xl font-normal tracking-tight text-eo-purple"}>
          Organization
        </p>
      </div>
    </div>
  );
}
