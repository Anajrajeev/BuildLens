"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import BrandLogo from "@/components/brand-logo";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Icon,
  MetricCard,
  Skeleton,
  ThemeToggle,
} from "@/components/ui";

type Profile = {
  email: string | null;
  full_name?: string | null;
  employee_code?: string | null;
  role_name?: string | null;
  permissions: string[];
};

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        setProfile(await api<Profile>("/auth/me"));
      } catch (reason) {
        setError(
          reason instanceof Error
            ? reason.message
            : "Could not load account details."
        );
      }
    })();
  }, []);

  if (error) {
    return (
      <main className="min-h-screen bg-canvas flex items-center justify-center p-6">
        <Card className="max-w-md w-full space-y-4">
          <div className="flex items-center gap-2 text-danger-text">
            <Icon name="alert-circle" className="h-5 w-5" />
            <span className="font-mono text-xs font-semibold uppercase tracking-wider">
              Account unavailable
            </span>
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-ink">
            We could not retrieve account access.
          </h1>
          <p className="text-sm text-ink-secondary">{error}</p>
          <div className="pt-2">
            <Button
              trailingIcon="arrow-right"
              onClick={() => router.push("/workspace")}
            >
              Return to workspace
            </Button>
          </div>
        </Card>
      </main>
    );
  }

  if (!profile) {
    return (
      <main
        className="min-h-screen bg-canvas flex flex-col"
        aria-busy="true"
        aria-live="polite"
      >
        <header className="h-14 border-b border-border bg-surface px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <Skeleton className="h-8 w-28 rounded-control" />
          <BrandLogo />
        </header>
        <div className="max-w-3xl w-full mx-auto px-4 py-8 sm:px-6 space-y-6">
          <Skeleton className="h-32 w-full rounded-card" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Skeleton className="h-24 w-full rounded-card" />
            <Skeleton className="h-24 w-full rounded-card" />
            <Skeleton className="h-24 w-full rounded-card" />
          </div>
          <Skeleton className="h-48 w-full rounded-card" />
        </div>
      </main>
    );
  }

  const name = profile.full_name || profile.email || "Account";
  const initials = name
    .split(/\s+|@/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <main className="min-h-screen bg-canvas text-ink flex flex-col">
      <header className="sticky top-0 z-20 h-14 border-b border-border bg-surface/95 backdrop-blur-sm px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
        <Button
          variant="secondary"
          size="sm"
          icon="arrow-left"
          onClick={() => router.push("/workspace")}
        >
          Workspace
        </Button>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <BrandLogo />
        </div>
      </header>

      <div className="max-w-3xl w-full mx-auto px-4 py-8 sm:px-6 space-y-6">
        <Card className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div className="flex items-center gap-4 min-w-0">
            <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-card bg-accent text-white font-mono text-lg font-semibold shadow-sm">
              {initials}
            </span>
            <div className="min-w-0">
              <p className="font-mono text-xs font-medium uppercase tracking-wider text-accent-text">
                Your account
              </p>
              <h1 className="mt-0.5 text-xl sm:text-2xl font-semibold tracking-tight text-ink truncate">
                {name}
              </h1>
              {profile.email && (
                <p className="text-sm text-ink-secondary truncate">
                  {profile.email}
                </p>
              )}
            </div>
          </div>
          <div className="shrink-0">
            <Badge status="ACTIVE">Workspace access</Badge>
          </div>
        </Card>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <MetricCard
            label="Role"
            value={profile.role_name || "No role assigned"}
            icon="user"
          />
          <MetricCard
            label="Employee ID"
            value={profile.employee_code || "Not assigned"}
            icon="building"
          />
          <MetricCard
            label="Access status"
            value="Active"
            badge={<Badge status="ACTIVE" />}
          />
        </div>

        <Card noPadding>
          <CardHeader
            eyebrow="Granted access"
            title="Permissions"
            subtitle="Operational capabilities assigned to this workspace"
            badge={
              <Badge variant="neutral" dot={false} mono>
                {profile.permissions.length} scopes
              </Badge>
            }
          />
          <div className="p-5">
            {profile.permissions.length > 0 ? (
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {profile.permissions.map((permission) => {
                  const [domain, action] = permission.split(".");
                  return (
                    <li
                      key={permission}
                      className="flex items-center justify-between gap-3 rounded-control border border-border bg-surface-subtle px-3.5 py-2.5"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success-bg text-success-text border border-success-border">
                          <Icon name="check" className="h-3 w-3" />
                        </span>
                        <span className="font-mono text-xs font-medium text-ink truncate">
                          {domain}
                          {action ? (
                            <span className="text-ink-muted"> · {action}</span>
                          ) : null}
                        </span>
                      </div>
                      <Badge
                        variant="success"
                        dot={false}
                        className="text-[10px]"
                      >
                        Granted
                      </Badge>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-ink-muted">
                No permissions have been assigned to this account.
              </p>
            )}
          </div>
          <footer className="border-t border-border bg-surface-subtle/60 px-5 py-3.5 flex items-center justify-between gap-3">
            <span className="text-xs text-ink-muted">
              Account and permission details are managed by your organization.
            </span>
          </footer>
        </Card>
      </div>
    </main>
  );
}
