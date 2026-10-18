"use client";

import React, {
  ButtonHTMLAttributes,
  FormEvent,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
  useEffect,
  useId,
  useState,
} from "react";
import { createPortal } from "react-dom";

/* ==========================================================================
   1. ICON SYSTEM (Unified Lucide-style 1.75px stroke vectors)
   ========================================================================== */

export type IconName =
  | "dashboard"
  | "today"
  | "ai"
  | "villas"
  | "work-sections"
  | "people"
  | "documents"
  | "reports"
  | "materials"
  | "procurement"
  | "vendors"
  | "quality"
  | "safety"
  | "handover"
  | "inbox"
  | "plus"
  | "refresh"
  | "search"
  | "filter"
  | "chevron-down"
  | "chevron-right"
  | "arrow-left"
  | "arrow-right"
  | "log-out"
  | "user"
  | "x"
  | "check"
  | "alert-circle"
  | "alert-triangle"
  | "clock"
  | "ban"
  | "rotate-ccw"
  | "sun"
  | "moon"
  | "menu"
  | "lock"
  | "building"
  | "play"
  | "check-circle"
  | "folder"
  | "sliders";

const iconPaths: Record<IconName, ReactNode> = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  today: (
    <>
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
      <path d="m9 15 2 2 4-4" />
    </>
  ),
  ai: (
    <>
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
      <path d="M20 3v4M22 5h-4" />
    </>
  ),
  villas: (
    <>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V20h14V9.5" />
      <path d="M9.5 20v-6h5v6" />
    </>
  ),
  "work-sections": (
    <>
      <path d="M12 2 2 7l10 5 10-5-10-5Z" />
      <path d="m2 17 10 5 10-5" />
      <path d="m2 12 10 5 10-5" />
    </>
  ),
  people: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  documents: (
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6M8 13h8M8 17h6" />
    </>
  ),
  reports: (
    <>
      <path d="M3 3v18h18" />
      <path d="M7 16v-5M12 16V8M17 16v-3" />
    </>
  ),
  materials: (
    <>
      <path d="m7.5 4.27 9 5.15" />
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
      <path d="m3.3 7 8.7 5 8.7-5M12 22V12" />
    </>
  ),
  procurement: (
    <>
      <circle cx="8" cy="21" r="1" />
      <circle cx="19" cy="21" r="1" />
      <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
    </>
  ),
  vendors: (
    <>
      <path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4" />
      <path d="M9 9v.01M9 12v.01M9 15v.01M9 18v.01" />
    </>
  ),
  quality: (
    <>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  safety: (
    <>
      <path d="M2 18a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v2z" />
      <path d="M10 10V5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v5" />
      <path d="M4 15v-3a6 6 0 0 1 6-6h0M14 6h0a6 6 0 0 1 6 6v3" />
    </>
  ),
  handover: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M7 8h10M7 12h6M7 16h4" />
      <path d="m15 14 2 2 4-4" />
    </>
  ),
  inbox: (
    <>
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  refresh: (
    <>
      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
      <path d="M16 16h5v5" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </>
  ),
  filter: <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />,
  "chevron-down": <path d="m6 9 6 6 6-6" />,
  "chevron-right": <path d="m9 18 6-6-6-6" />,
  "arrow-left": <path d="m12 19-7-7 7-7M19 12H5" />,
  "arrow-right": <path d="M5 12h14m-7-7 7 7-7 7" />,
  "log-out": (
    <>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </>
  ),
  user: (
    <>
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </>
  ),
  x: <path d="M18 6 6 18M6 6l12 12" />,
  check: <path d="M20 6 9 17l-5-5" />,
  "alert-circle": (
    <>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </>
  ),
  "alert-triangle": (
    <>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <path d="M12 9v4M12 17h.01" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </>
  ),
  ban: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="m4.9 4.9 14.2 14.2" />
    </>
  ),
  "rotate-ccw": (
    <>
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2m-7.07-14.93 1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2m-14.93 7.07 1.41-1.41m11.32-11.32 1.41-1.41" />
    </>
  ),
  moon: <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />,
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  lock: (
    <>
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </>
  ),
  building: (
    <>
      <rect width="16" height="20" x="4" y="2" rx="2" ry="2" />
      <path d="M9 22v-4h6v4M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01" />
    </>
  ),
  play: <polygon points="6 3 20 12 6 21 6 3" />,
  "check-circle": (
    <>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <path d="m9 11 3 3L22 4" />
    </>
  ),
  folder: <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />,
  sliders: (
    <>
      <line x1="4" x2="4" y1="21" y2="14" />
      <line x1="4" x2="4" y1="10" y2="3" />
      <line x1="12" x2="12" y1="21" y2="12" />
      <line x1="12" x2="12" y1="8" y2="3" />
      <line x1="20" x2="20" y1="21" y2="16" />
      <line x1="20" x2="20" y1="12" y2="3" />
      <line x1="2" x2="6" y1="14" y2="14" />
      <line x1="10" x2="14" y1="8" y2="8" />
      <line x1="18" x2="22" y1="16" y2="16" />
    </>
  ),
};

export function Icon({
  name,
  className = "h-4 w-4",
}: {
  name: IconName;
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      className={`shrink-0 ${className}`.trim()}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {iconPaths[name]}
    </svg>
  );
}

/* ==========================================================================
   2. BUTTON COMPONENT
   ========================================================================== */

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  trailingIcon?: IconName;
  loading?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-white border border-transparent hover:bg-accent-hover active:bg-accent-active shadow-sm",
  secondary:
    "bg-surface text-ink border border-border hover:bg-surface-muted hover:border-border-strong active:bg-surface-subtle",
  ghost:
    "bg-transparent text-ink-secondary border border-transparent hover:bg-surface-muted hover:text-ink",
  danger:
    "bg-surface text-danger-text border border-danger-border hover:bg-danger-bg",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-8 px-2.5 text-xs gap-1.5",
  md: "h-9 px-3.5 text-sm gap-2",
  lg: "h-10 px-4 text-sm gap-2",
};

export function Button({
  variant = "primary",
  size = "md",
  icon,
  trailingIcon,
  loading = false,
  disabled,
  className = "",
  children,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center rounded-control font-medium transition-colors duration-fast ease-out focus-ring disabled:opacity-50 disabled:pointer-events-none select-none ${variantClasses[variant]} ${sizeClasses[size]} ${className}`.trim()}
      {...props}
    >
      {loading ? (
        <span
          className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden="true"
        />
      ) : icon ? (
        <Icon name={icon} className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} />
      ) : null}
      {children}
      {!loading && trailingIcon ? (
        <Icon name={trailingIcon} className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} />
      ) : null}
    </button>
  );
}

/* ==========================================================================
   3. BADGE & SEMANTIC STATUS FORMATTER
   ========================================================================== */

export type BadgeVariant = "neutral" | "accent" | "success" | "warning" | "danger";

export function formatLabel(value: unknown): string {
  if (value === null || value === undefined || value === "") return "Not set";
  const raw = String(value).replaceAll("_", " ").toLowerCase();
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export function getStatusVariant(value: unknown): BadgeVariant {
  const key = String(value ?? "")
    .toUpperCase()
    .trim();
  if (
    [
      "COMPLETED",
      "COMPLETE",
      "PASSED",
      "ACTIVE",
      "APPROVED",
      "CLOSED",
      "RECORDED",
      "IN_STOCK",
      "AUTHENTICATED",
      "INSPECTION_PASSED",
    ].includes(key)
  ) {
    return "success";
  }
  if (
    [
      "IN_PROGRESS",
      "PENDING_INSPECTION",
      "MEDIUM",
      "IN_TRANSIT",
      "PRE_SNAGGING",
      "FINISHING_STAGE",
      "OPEN",
      "OBSERVATION",
      "NEAR_MISS",
      "INSPECTION_PENDING",
      "STOCK_ALERT",
    ].includes(key)
  ) {
    return "warning";
  }
  if (
    [
      "CRITICAL",
      "HIGH",
      "BLOCKED",
      "REWORK_REQUIRED",
      "REWORK",
      "INCIDENT",
      "CRITICAL_PATH_DELAY",
      "OVERDUE",
      "REORDER_REQUIRED",
    ].includes(key)
  ) {
    return "danger";
  }
  if (["PLANNING", "PERMIT", "TOOLBOX_TALK", "DAILY_REPORT"].includes(key)) {
    return "accent";
  }
  return "neutral";
}

const badgeVariantClasses: Record<BadgeVariant, string> = {
  neutral: "bg-surface-muted text-ink-secondary border-border",
  accent: "bg-accent-subtle text-accent-text border-accent-border",
  success: "bg-success-bg text-success-text border-success-border",
  warning: "bg-warning-bg text-warning-text border-warning-border",
  danger: "bg-danger-bg text-danger-text border-danger-border",
};

const badgeDotClasses: Record<BadgeVariant, string> = {
  neutral: "bg-zinc-400",
  accent: "bg-accent",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-rose-500",
};

export function Badge({
  children,
  variant,
  status,
  dot = true,
  mono = false,
  className = "",
}: {
  children?: ReactNode;
  variant?: BadgeVariant;
  status?: unknown;
  dot?: boolean;
  mono?: boolean;
  className?: string;
}) {
  const resolvedVariant = variant ?? getStatusVariant(status ?? children);
  const content = children ?? formatLabel(status);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-[6px] border px-2 py-0.5 text-xs font-medium leading-4 whitespace-nowrap ${
        mono ? "font-mono" : ""
      } ${badgeVariantClasses[resolvedVariant]} ${className}`.trim()}
    >
      {dot && (
        <span
          className={`h-1.5 w-1.5 rounded-full shrink-0 ${badgeDotClasses[resolvedVariant]}`}
          aria-hidden="true"
        />
      )}
      {content}
    </span>
  );
}

/* ==========================================================================
   4. FORM CONTROLS (FormField, Input, Select, Textarea)
   ========================================================================== */

export function FormField({
  label,
  htmlFor,
  required,
  helperText,
  error,
  children,
  className = "",
}: {
  label: string;
  htmlFor?: string;
  required?: boolean;
  helperText?: string;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`.trim()}>
      <label
        htmlFor={htmlFor}
        className="flex items-center justify-between text-xs font-medium text-ink"
      >
        <span>
          {label}
          {required && <span className="ml-0.5 text-danger-text">*</span>}
        </span>
      </label>
      {children}
      {error ? (
        <p className="text-xs text-danger-text flex items-center gap-1" role="alert">
          <Icon name="alert-circle" className="h-3.5 w-3.5" />
          <span>{error}</span>
        </p>
      ) : helperText ? (
        <p className="text-xs text-ink-muted">{helperText}</p>
      ) : null}
    </div>
  );
}

export const inputBaseClasses =
  "w-full h-9 rounded-control border border-border bg-surface px-3 text-sm text-ink placeholder:text-ink-muted transition-colors duration-fast ease-out hover:border-border-strong focus-ring disabled:opacity-50 disabled:bg-surface-subtle";

export function Input({
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${inputBaseClasses} ${className}`.trim()} {...props} />;
}

export function Select({
  className = "",
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`${inputBaseClasses} pr-8 ${className}`.trim()} {...props}>
      {children}
    </select>
  );
}

export function Textarea({
  className = "",
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={`w-full min-h-[88px] rounded-control border border-border bg-surface p-3 text-sm text-ink placeholder:text-ink-muted transition-colors duration-fast ease-out hover:border-border-strong focus-ring disabled:opacity-50 disabled:bg-surface-subtle resize-y ${className}`.trim()}
      {...props}
    />
  );
}

/* ==========================================================================
   5. CARDS, METRICS & PAGE HEADER
   ========================================================================== */

export function Card({
  children,
  className = "",
  noPadding = false,
}: {
  children: ReactNode;
  className?: string;
  noPadding?: boolean;
}) {
  return (
    <section
      className={`rounded-card border border-border bg-surface card-surface ${
        noPadding ? "overflow-hidden" : "p-5"
      } ${className}`.trim()}
    >
      {children}
    </section>
  );
}

export function CardHeader({
  title,
  subtitle,
  eyebrow,
  action,
  badge,
  border = true,
  className = "",
}: {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  action?: ReactNode;
  badge?: ReactNode;
  border?: boolean;
  className?: string;
}) {
  const rightSlot = action ?? badge;
  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 ${
        border
          ? "border-b border-border bg-surface-subtle px-5 py-3.5"
          : "mb-4"
      } ${className}`.trim()}
    >
      <div className="min-w-0">
        {eyebrow && (
          <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-accent-text mb-0.5">
            {eyebrow}
          </p>
        )}
        <h3 className="text-base font-semibold tracking-tight text-ink">
          {title}
        </h3>
        {subtitle && (
          <p className="mt-0.5 text-xs text-ink-secondary">{subtitle}</p>
        )}
      </div>
      {rightSlot && <div className="shrink-0">{rightSlot}</div>}
    </div>
  );
}

function getMetricTone(icon?: IconName): {
  topBorder: string;
  iconBox: string;
} {
  if (icon === "check-circle" || icon === "quality" || icon === "handover") {
    return {
      topBorder: "border-t-[3px] border-t-emerald-600",
      iconBox: "bg-success-bg text-success-text border-success-border",
    };
  }
  if (
    icon === "clock" ||
    icon === "alert-triangle" ||
    icon === "safety" ||
    icon === "materials"
  ) {
    return {
      topBorder: "border-t-[3px] border-t-amber-500",
      iconBox: "bg-warning-bg text-warning-text border-warning-border",
    };
  }
  if (icon === "alert-circle" || icon === "ban") {
    return {
      topBorder: "border-t-[3px] border-t-rose-600",
      iconBox: "bg-danger-bg text-danger-text border-danger-border",
    };
  }
  return {
    topBorder: "border-t-[3px] border-t-accent",
    iconBox: "bg-accent-subtle text-accent-text border-accent-border",
  };
}

export function MetricCard({
  label,
  value,
  subvalue,
  hint,
  badge,
  icon,
}: {
  label: string;
  value: ReactNode;
  subvalue?: ReactNode;
  hint?: string;
  badge?: ReactNode;
  icon?: IconName;
}) {
  const tone = getMetricTone(icon);
  return (
    <article
      className={`rounded-card border border-border ${tone.topBorder} bg-surface card-surface p-4 flex flex-col justify-between gap-3`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-ink-secondary">{label}</span>
        {icon ? (
          <span
            className={`inline-flex h-7 w-7 items-center justify-center rounded-control border ${tone.iconBox}`}
          >
            <Icon name={icon} className="h-3.5 w-3.5" />
          </span>
        ) : (
          badge ?? null
        )}
      </div>
      <div>
        <div className="flex items-baseline gap-2 flex-wrap">
          <strong className="font-mono text-xl font-semibold tracking-tight text-ink tabular-nums">
            {value}
          </strong>
          {subvalue && (
            <span className="font-mono text-xs text-ink-muted tabular-nums">
              {subvalue}
            </span>
          )}
        </div>
        {hint && <p className="mt-1 text-xs text-ink-muted">{hint}</p>}
      </div>
    </article>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
  secondaryAction,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  secondaryAction?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-5 border-b border-border">
      <div className="min-w-0">
        {eyebrow && (
          <span className="inline-flex items-center gap-1.5 rounded-[6px] border border-accent-border bg-accent-subtle px-2.5 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-accent-text mb-2">
            <span
              className="h-1.5 w-1.5 rounded-full bg-accent"
              aria-hidden="true"
            />
            {eyebrow}
          </span>
        )}
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-ink">
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-sm text-ink-secondary max-w-2xl">
            {description}
          </p>
        )}
      </div>
      {(action || secondaryAction) && (
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {secondaryAction}
          {action}
        </div>
      )}
    </div>
  );
}

/* ==========================================================================
   6. PROGRESS BAR
   ========================================================================== */

export function ProgressBar({
  value,
  showLabel = true,
  variant = "accent",
  className = "",
}: {
  value: number;
  showLabel?: boolean;
  variant?: "accent" | "success" | "warning" | "danger";
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
  const fillClass =
    clamped === 100 || variant === "success"
      ? "bg-emerald-600"
      : variant === "danger"
      ? "bg-rose-600"
      : variant === "warning"
      ? "bg-amber-500"
      : "bg-accent";
  return (
    <div className={`flex items-center gap-2.5 ${className}`.trim()}>
      <div
        className="h-1.5 flex-1 min-w-[64px] overflow-hidden rounded-full bg-surface-muted"
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={`h-full rounded-full transition-all duration-fast ease-out ${fillClass}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
      {showLabel && (
        <span className="font-mono text-xs font-medium text-ink-secondary tabular-nums w-9 text-right">
          {clamped}%
        </span>
      )}
    </div>
  );
}

/* ==========================================================================
   7. EMPTY, ERROR & SKELETON STATES
   ========================================================================== */

export function EmptyState({
  icon = "folder",
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon?: IconName;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-card border border-dashed border-border bg-surface-subtle/50 px-6 py-12 text-center">
      <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-control border border-border bg-surface text-ink-muted">
        <Icon name={icon} className="h-5 w-5" />
      </div>
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      <p className="mt-1 max-w-sm text-xs text-ink-muted leading-relaxed">
        {description}
      </p>
      {actionLabel && onAction && (
        <div className="mt-4">
          <Button variant="secondary" size="sm" icon="plus" onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      )}
    </div>
  );
}

export function ErrorBanner({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-3 rounded-control border border-danger-border bg-danger-bg px-4 py-3 text-sm text-danger-text"
    >
      <div className="flex items-center gap-2.5">
        <Icon name="alert-circle" className="h-4 w-4 shrink-0" />
        <span>{message}</span>
      </div>
      {onRetry && (
        <Button variant="danger" size="sm" icon="refresh" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}

export function Skeleton({ className = "h-4 w-full" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-[6px] bg-surface-muted ${className}`.trim()}
    />
  );
}

export function TableSkeleton({
  rows = 4,
  cols = 3,
}: {
  rows?: number;
  cols?: number;
}) {
  void cols;
  return (
    <div
      className="rounded-card border border-border bg-surface overflow-hidden"
      aria-busy="true"
      aria-label="Loading records"
    >
      <div className="border-b border-border bg-surface-subtle px-5 py-3 flex gap-4">
        <Skeleton className="h-3.5 w-24" />
        <Skeleton className="h-3.5 w-32" />
        <Skeleton className="h-3.5 w-20 ml-auto" />
      </div>
      <div className="divide-y divide-border-subtle">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="px-5 py-3.5 flex items-center justify-between gap-4">
            <div className="flex flex-col gap-2 flex-1">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className="h-5 w-20 rounded-[6px]" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ==========================================================================
   8. MODAL & SLIDE-OVER DRAWER (Portal-mounted to avoid stacking bugs)
   ========================================================================== */

export function Modal({
  title,
  eyebrow,
  description,
  onClose,
  onSubmit,
  submitLabel = "Save record",
  children,
}: {
  title: string;
  eyebrow?: string;
  description?: string;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void> | void;
  submitLabel?: string;
  children: ReactNode;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);
  const titleId = useId();

  useEffect(() => {
    setMounted(true);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose, saving]);

  if (!mounted) return null;

  const content = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md rounded-card border border-border bg-surface shadow-float overflow-hidden"
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            {eyebrow && (
              <p className="font-mono text-xs font-medium uppercase tracking-wider text-accent-text mb-0.5">
                {eyebrow}
              </p>
            )}
            <h2 id={titleId} className="text-lg font-semibold tracking-tight text-ink">
              {title}
            </h2>
            {description && (
              <p className="mt-0.5 text-xs text-ink-muted">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close modal"
            className="inline-flex h-8 w-8 items-center justify-center rounded-control text-ink-muted hover:bg-surface-muted hover:text-ink focus-ring"
          >
            <Icon name="x" className="h-4 w-4" />
          </button>
        </div>

        <form
          onSubmit={async (event) => {
            event.preventDefault();
            setSaving(true);
            setError("");
            try {
              await onSubmit(event);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Could not save the record.");
            } finally {
              setSaving(false);
            }
          }}
        >
          <div className="p-5 flex flex-col gap-4 max-h-[70vh] overflow-y-auto">
            {children}
            {error && <ErrorBanner message={error} />}
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-border bg-surface-subtle px-5 py-3">
            <Button variant="secondary" size="md" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="md" loading={saving}>
              {saving ? "Saving…" : submitLabel}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}

/* ==========================================================================
   9. THEME TOGGLE (Light / Dark Mode)
   ========================================================================== */

export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("buildlens-theme");
    const isDark = saved === "dark";
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("buildlens-theme", next ? "dark" : "light");
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Light mode" : "Dark mode"}
      className="inline-flex h-9 w-9 items-center justify-center rounded-control border border-border bg-surface text-ink-secondary hover:bg-surface-muted hover:text-ink transition-colors duration-fast ease-out focus-ring"
    >
      <Icon name={dark ? "sun" : "moon"} className="h-4 w-4" />
    </button>
  );
}
