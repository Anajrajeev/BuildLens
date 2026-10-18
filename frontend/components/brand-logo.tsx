type BrandLogoProps = {
  className?: string;
  compact?: boolean;
  priority?: boolean;
  subtitle?: string;
  inverted?: boolean;
  size?: "sm" | "md" | "lg";
};

export default function BrandLogo({
  className = "",
  compact = false,
  priority = false,
  subtitle,
  inverted = false,
  size = "md",
}: BrandLogoProps) {
  const boxSize =
    size === "lg"
      ? "h-11 w-11 rounded-[10px]"
      : size === "sm"
      ? "h-7 w-7 rounded-[7px]"
      : "h-8 w-8 rounded-control";

  const titleSize =
    size === "lg" ? "text-base" : size === "sm" ? "text-xs" : "text-sm";

  return (
    <span
      className={`inline-flex items-center gap-2.5 select-none ${className}`.trim()}
      aria-label="BuildLens"
    >
      <span
        className={`relative inline-flex ${boxSize} shrink-0 items-center justify-center overflow-hidden border shadow-sm ${
          inverted
            ? "border-teal-400/35 bg-[#0e272b]"
            : "border-accent-border/70 bg-[#0e272b]"
        }`}
        aria-hidden="true"
      >
        <img
          src="/brand/buildlens-mark.png"
          alt=""
          loading={priority ? "eager" : "lazy"}
          className="h-full w-full object-cover"
        />
      </span>
      {!compact && (
        <span className="flex flex-col leading-none">
          <span
            className={`${titleSize} font-semibold tracking-tight ${
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
