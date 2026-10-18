"use client";
import { FormEvent, useState } from "react";
import { firebaseAuth } from "@/lib/firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import BrandLogo from "@/components/brand-logo";

export default function SignIn() {
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [busy, setBusy] = useState(false); const [notice, setNotice] = useState("");
  async function submit(event: FormEvent) { event.preventDefault(); if (!firebaseAuth) return setNotice("Firebase Authentication has not been configured. Add the Firebase web configuration to frontend/.env.local."); setBusy(true); try { await signInWithEmailAndPassword(firebaseAuth, email, password); window.location.assign("/workspace"); } catch (error) { setNotice(error instanceof Error ? error.message : "Could not sign in."); } finally { setBusy(false); } }
  return <main className="auth auth-next">
    <section className="auth-brand auth-story">
      <div className="auth-top"><BrandLogo className="auth-logo" priority /><span className="phase"><i /> LIVE OPERATIONS</span></div>
      <div className="auth-copy auth-next-copy"><p className="overline">Construction command centre</p><h1>Build with<br/><em>clarity,</em><br/>not chaos.</h1><p>One calm, accountable system for every villa, crew, task and handover.</p></div>
      <div className="auth-stats auth-next-stats"><span><b>Villa</b> → Floor → Task → Progress</span><span>Made for people on site</span></div>
    </section>
    <section className="auth-form auth-next-form"><div className="form-inner auth-login-card"><BrandLogo compact className="login-mark" /><p className="overline">Private workspace</p><h2>Welcome back<span>.</span></h2><p className="form-lede">Sign in to see the work that needs your attention.</p><form onSubmit={submit}><label>Work email<input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@company.com" required /></label><label className="password-label">Password<input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required /></label><button className="primary" disabled={busy}>{busy ? "Signing in…" : "Continue to BuildLens"}<span>→</span></button></form>{notice && <p className="notice">{notice}</p>}<div className="secure"><span className="secure-lock">⌁</span> Secure, role-scoped access · No public sign-up</div></div></section>
  </main>
}
