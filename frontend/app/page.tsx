"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import BrandLogo from "@/components/brand-logo";
import { Badge, Button, Icon, ThemeToggle } from "@/components/ui";
import {
  AppRole,
  getStoredRole,
  ROLE_DEFINITIONS,
  ROLE_ORDER,
  setStoredRole,
} from "@/lib/roles";

export default function StarterPage() {
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState<AppRole>("Director");
  const [enteringRole, setEnteringRole] = useState<AppRole | null>(null);

  useEffect(() => {
    const existing = getStoredRole();
    if (existing) {
      setSelectedRole(existing);
    }
  }, []);

  const handleConfirmRole = (role: AppRole) => {
    setSelectedRole(role);
    setEnteringRole(role);
    setStoredRole(role);
    router.push("/workspace");
  };

  return (
    <main className="min-h-screen bg-canvas text-ink flex flex-col">
      {/* Top Bar */}
      <header className="sticky top-0 z-20 h-16 border-b border-border bg-surface/95 backdrop-blur-sm px-4 sm:px-6 lg:px-10">
        <div className="max-w-6xl mx-auto h-full flex items-center justify-between gap-4">
          <BrandLogo
            size="md"
            priority
            subtitle="CONSTRUCTION OPERATIONS PLATFORM"
          />
          <div className="flex items-center gap-3">
            <Badge variant="accent" dot mono>
              Role-Based Access
            </Badge>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 py-10 lg:py-14 flex flex-col justify-center space-y-8">
        {/* Hero / Intro Section */}
        <section className="max-w-2xl space-y-3">
          <p className="font-mono text-xs font-semibold uppercase tracking-wider text-accent-text">
            Starter Workspace Selection
          </p>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-ink">
            Select your operational role to enter BuildLens
          </h1>
          <p className="text-sm text-ink-secondary leading-relaxed">
            Permissions are enforced across both the interface and the backend
            API. Review what each role does below and choose{" "}
            <span className="font-semibold text-ink">Director</span>,{" "}
            <span className="font-semibold text-ink">Manager</span>, or{" "}
            <span className="font-semibold text-ink">Engineer</span>.
          </p>
        </section>

        {/* Three Role Selection Cards */}
        <section
          aria-label="Choose your role"
          className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch"
        >
          {ROLE_ORDER.map((roleId) => {
            const role = ROLE_DEFINITIONS[roleId];
            const isSelected = selectedRole === role.id;
            const isEntering = enteringRole === role.id;

            return (
              <div
                key={role.id}
                role="button"
                tabIndex={0}
                aria-pressed={isSelected}
                onClick={() => setSelectedRole(role.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelectedRole(role.id);
                  }
                }}
                className={`group text-left rounded-card border transition-all duration-fast cursor-pointer flex flex-col justify-between p-6 bg-surface focus-ring ${
                  isSelected
                    ? "border-accent ring-2 ring-accent-border shadow-sm"
                    : "border-border hover:border-border-strong"
                }`}
              >
                <div className="space-y-5">
                  {/* Top Row: Icon + Non-wrapping Pill Badge */}
                  <div className="flex items-center justify-between gap-3">
                    <span
                      className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-control border transition-colors ${
                        isSelected
                          ? "bg-accent text-white border-accent"
                          : "bg-accent-subtle text-accent-text border-accent-border group-hover:border-accent"
                      }`}
                    >
                      <Icon name={role.icon} className="h-5 w-5" />
                    </span>
                    <Badge
                      variant={isSelected ? "accent" : "neutral"}
                      dot={isSelected}
                      className="shrink-0 whitespace-nowrap"
                    >
                      {role.badge}
                    </Badge>
                  </div>

                  {/* Role Title & Concise Summary */}
                  <div className="space-y-1.5">
                    <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                      {role.code}
                    </p>
                    <h2 className="text-xl font-semibold tracking-tight text-ink">
                      {role.title}
                    </h2>
                    <p className="text-sm font-medium text-ink leading-snug pt-0.5">
                      {role.tagline}
                    </p>
                    <p className="text-xs text-ink-secondary leading-relaxed">
                      {role.description}
                    </p>
                  </div>

                  {/* Divider + Role Capabilities */}
                  <div className="pt-4 border-t border-border-subtle space-y-2.5">
                    <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                      What this role does
                    </p>
                    <ul className="space-y-2">
                      {role.capabilities.map((item, idx) => (
                        <li
                          key={idx}
                          className="flex items-start gap-2.5 text-xs text-ink-secondary leading-relaxed"
                        >
                          <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-accent-subtle text-accent-text border border-accent-border">
                            <Icon name="check" className="h-2.5 w-2.5" />
                          </span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Card Footer */}
                <div className="pt-5 mt-6 border-t border-border-subtle space-y-3">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-ink-muted font-medium shrink-0">
                      Access scope
                    </span>
                    <span className="font-mono text-[11px] font-semibold text-ink truncate">
                      {role.primaryScope}
                    </span>
                  </div>
                  <Button
                    variant={isSelected ? "primary" : "secondary"}
                    size="md"
                    trailingIcon="arrow-right"
                    loading={isEntering}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleConfirmRole(role.id);
                    }}
                    className="w-full"
                  >
                    Enter as {role.title}
                  </Button>
                </div>
              </div>
            );
          })}
        </section>
      </div>
    </main>
  );
}
