type BrandLogoProps = {
  className?: string;
  compact?: boolean;
  priority?: boolean;
};

export default function BrandLogo({ className = "", compact = false }: BrandLogoProps) {
  return (
    <span className={`brand-logo${compact ? " brand-logo-compact" : ""}${className ? ` ${className}` : ""}`} aria-label="BuildLens">
      <span className="brand-mark" aria-hidden="true">BL</span>
      {!compact && <span className="brand-wordmark">BUILDLENS</span>}
    </span>
  );
}
