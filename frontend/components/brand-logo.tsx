type BrandLogoProps = {
  className?: string;
  compact?: boolean;
  priority?: boolean;
  subtitle?: string;
  inverted?: boolean;
};

export default function BrandLogo({
  className = "",
  compact = false,
  subtitle,
  inverted = false,
}: BrandLogoProps) {
  return (
    <span
      className={`inline-flex items-center gap-2.5 select-none ${className}`.trim()}
      aria-label="BuildLens"
    >
      <span
        className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-control text-xs font-mono font-bold tracking-tight shadow-sm ${
          inverted
            ? "bg-teal-400 text-[#0b201e]"
            : "bg-accent text-white"
        }`}
        aria-hidden="true"
      >
        BL
      </span>
      {!compact && (
        <span className="flex flex-col leading-none">
          <span
            className={`text-sm font-semibold tracking-tight ${
              inverted ? "text-white" : "text-ink"
            }`}
          >
            BuildLens
          </span>
          {subtitle && (
            <span
              className={`mt-0.5 font-mono text-[11px] ${
                inverted ? "text-teal-200/75" : "text-ink-muted"
              }`}
            >
              {subtitle}
            </span>
          )}
        </span>
      )}
    </span>
  );
}
