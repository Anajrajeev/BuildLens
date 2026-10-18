"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { firebaseAuth, firebaseToken } from "@/lib/firebase";
import BrandLogo from "@/components/brand-logo";

type Profile = { email: string | null; full_name?: string | null; employee_code?: string | null; role_name?: string | null; permissions: string[] };

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState("");
  const [signingOut, setSigningOut] = useState(false);
  useEffect(() => { void (async () => { if (!await firebaseToken()) return router.replace("/"); try { setProfile(await api<Profile>("/auth/me")); } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not load account details."); } })(); }, [router]);
  const signOut = async () => { setSigningOut(true); await firebaseAuth?.signOut(); router.replace("/"); };
  if (error) return <main className="workspace-error"><p className="overline">Account unavailable</p><h1>We could not retrieve account access.</h1><p>{error}</p><button className="primary" onClick={() => router.push("/workspace")}>Return to workspace <span>→</span></button></main>;
  if (!profile) return <main className="account-loading"><i /><span>Loading account access</span></main>;
  const name = profile.full_name || profile.email || "Account";
  const initials = name.split(/\s+|@/).filter(Boolean).slice(0, 2).map(part => part[0]).join("").toUpperCase();
  return <main className="account-page"><header className="account-header"><button onClick={() => router.push("/workspace")}>← Workspace</button><BrandLogo className="account-logo" /></header><section className="account-card"><div className="account-identity"><span className="profile-avatar account-avatar">{initials}</span><div><p className="overline">Your account</p><h1>{name}</h1><p>{profile.email}</p></div></div><div className="account-grid"><article><span>Role</span><b>{profile.role_name || "No role assigned"}</b></article><article><span>Employee ID</span><b>{profile.employee_code || "Not assigned"}</b></article><article><span>Access status</span><b className="access-active"><i /> Authenticated</b></article></div><section className="permission-list"><div><p className="overline">Granted access</p><h2>Permissions</h2></div>{profile.permissions.length ? <ul>{profile.permissions.map(permission => <li key={permission}><i>✓</i>{permission.replaceAll(".", " · ")}</li>)}</ul> : <p className="no-permissions">No permissions have been assigned to this account.</p>}</section><footer className="account-footer"><span>Account and permission details are managed by your organization.</span><button className="account-signout" disabled={signingOut} onClick={() => void signOut()}>{signingOut ? "Signing out…" : "Sign out"}<i>↗</i></button></footer></section></main>;
}
