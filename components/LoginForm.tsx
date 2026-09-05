"use client";
import { useState } from "react";
export default function LoginForm({next,expired}: {next:string;expired:boolean}) {
  const [email,setEmail] = useState("");
  const [busy,setBusy] = useState(false);
  const [sent,setSent] = useState(false);
  const [error,setError] = useState(expired ? "That sign-in link has expired or was opened in a different browser. Request a new link below." : "");
  return <form className="cs-panel flex flex-col gap-4" onSubmit={async e => {
    e.preventDefault();setBusy(true);setError("");
    try {
      const res = await fetch("/api/auth/signin",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,next})});
      const result = await res.json();if(!res.ok)throw new Error(result.error);
      setSent(true);
    } catch(e) {setError(e instanceof Error ? e.message : "Could not send the sign-in email.");}
    finally {setBusy(false);}
  }}>
    <h1 className="text-2xl font-bold">Your cards, in one place</h1>
    <p className="text-sm cs-muted">Sign in or create an account with a secure email link. No password needed.</p>
    <label htmlFor="login-email" className="font-semibold text-sm">Email address</label>
    <input id="login-email" className="cs-input" type="email" autoComplete="email" required maxLength={254} value={email} onChange={e=>{setEmail(e.target.value);setSent(false);}} />
    <button className="cs-button cs-primary" disabled={busy || sent}>{busy?"Sending…":sent?"Link sent":"Email me a sign-in link"}</button>
    {sent && <p role="status" className="text-sm">Check your inbox and spam folder. Open the link in this browser to continue. Your local draft stays here.</p>}
    {sent && <button type="button" className="cs-button" onClick={()=>setSent(false)}>Request another link</button>}
    {error && <p role="alert" className="cs-error">{error}</p>}
  </form>;
}
