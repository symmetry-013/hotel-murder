interface TitleLogoProps {
  compact?: boolean;
}

export function TitleLogo({ compact = false }: TitleLogoProps) {
  if (compact) {
    return (
      <div className="flex items-center gap-2.5 shrink-0 select-none">
        <svg
          width="24"
          height="24"
          viewBox="0 0 32 32"
          fill="none"
          aria-hidden="true"
          className="shrink-0"
        >
          <circle cx="11" cy="16" r="6" stroke="#C8A25A" strokeWidth="2" />
          <circle cx="11" cy="16" r="2" fill="#A81C26" />
          <path d="M17 16H29M24 16V21M28 16V19.5" stroke="#C8A25A" strokeWidth="2" strokeLinecap="square" />
        </svg>
        <span className="font-display text-base sm:text-lg font-bold tracking-[0.14em] text-[#EAE4DC] whitespace-nowrap">
          HOTEL MURDER
        </span>
      </div>
    );
  }

  return (
    <div className="select-none">
      <svg
        viewBox="0 0 520 156"
        className="w-full max-w-[460px] h-auto overflow-visible"
        role="img"
        aria-label="HOTEL MURDER ปริศนาโรงแรมมรณะ"
      >
        <defs>
          <linearGradient id="brassFoil" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#F3DC9F" />
            <stop offset="48%" stopColor="#C8A25A" />
            <stop offset="100%" stopColor="#8A682E" />
          </linearGradient>
          <linearGradient id="crimsonBlade" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#7A1118" />
            <stop offset="50%" stopColor="#DC2626" />
            <stop offset="100%" stopColor="#7A1118" />
          </linearGradient>
        </defs>

        {/* Top Art Deco hairline + key ornament */}
        <line x1="0" y1="18" x2="188" y2="18" stroke="#C8A25A" strokeOpacity="0.45" strokeWidth="1" />
        <g transform="translate(202, 6)">
          <circle cx="12" cy="12" r="7" stroke="url(#brassFoil)" strokeWidth="1.8" fill="none" />
          <circle cx="12" cy="12" r="2.2" fill="#DC2626" />
          <path d="M19 12H44M35 12V18M41 12V16.5" stroke="url(#brassFoil)" strokeWidth="1.8" strokeLinecap="square" />
        </g>
        <line x1="258" y1="18" x2="460" y2="18" stroke="#C8A25A" strokeOpacity="0.45" strokeWidth="1" />

        {/* Main Title */}
        <text
          x="0"
          y="80"
          fill="url(#brassFoil)"
          fontFamily="Cinzel, Georgia, serif"
          fontWeight="700"
          fontSize="50"
          letterSpacing="5"
        >
          HOTEL MURDER
        </text>

        {/* Diagonal crimson slash hairline under wordmark */}
        <line x1="0" y1="98" x2="452" y2="98" stroke="url(#crimsonBlade)" strokeWidth="1.5" />

        {/* Thai Subtitle */}
        <text
          x="2"
          y="134"
          fill="#EAE4DC"
          fontFamily="'Noto Sans Thai', 'Plus Jakarta Sans', sans-serif"
          fontWeight="600"
          fontSize="24"
          letterSpacing="2"
        >
          ปริศนาโรงแรมมรณะ
        </text>
      </svg>
    </div>
  );
}
