"use client";
import { useState } from "react";
export default function LoginForm({next,expired}: {next:string;expired:boolean}) {
  const [password,setPassword] = useState("");
  const [method,setMethod] = useState<"password"|"email">("password");
  const [email,setEmail] = useState("");
  const [busy,setBusy] = useState(false);
  const [sent,setSent] = useState(false);
  const [error,setError] = useState(expired ? "That sign-in link has expired or was opened in a different browser. Request a new link below." : "");
  return <form className="cs-panel flex flex-col gap-4" onSubmit={async e => {
    e.preventDefault();setBusy(true);setError("");
    try {
      const res = await fetch(method === "password" ? "/api/auth/password" : "/api/auth/signin",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,next,...(method === "password" ? {password} : {})})});
      const result = await res.json();if(!res.ok)throw new Error(result.error);
      if(method === "password") { window.location.assign(result.next); return; }
      setSent(true);
    } catch(e) {setError(e instanceof Error ? e.message : "Could not sign in. Please try again.");}
    finally {setBusy(false);}
  }}>
    <h1 className="text-2xl font-bold">Your cards, in one place</h1>
    <p className="text-sm cs-muted">{method === "password" ? "Sign in with your email and password." : "Sign in or create an account with a secure email link."}</p>
    <label htmlFor="login-email" className="font-semibold text-sm">Email address</label>
    <input id="login-email" className="cs-input" type="email" autoComplete="email" required maxLength={254} value={email} onChange={e=>{setEmail(e.target.value);setSent(false);}} />
    {method === "password" && <><label htmlFor="login-password" className="font-semibold text-sm">Password</label><input id="login-password" className="cs-input" type="password" autoComplete="current-password" required maxLength={1024} value={password} onChange={e=>setPassword(e.target.value)}/></>}
    <button className="cs-button cs-primary" disabled={busy || sent}>{busy?"Signing in…":method === "password"?"Sign in":sent?"Link sent":"Email me a sign-in link"}</button>
    <button type="button" className="cs-button" disabled={busy} onClick={()=>{setMethod(method === "password"?"email":"password");setSent(false);setError("");setPassword("");}}>{method === "password"?"Use an email link instead":"Use a password instead"}</button>
    {sent && <p role="status" className="text-sm">Check your inbox and spam folder. Open the link in this browser to continue. Your local draft stays here.</p>}
    {sent && <button type="button" className="cs-button" onClick={()=>setSent(false)}>Request another link</button>}
    {error && <p role="alert" className="cs-error">{error}</p>}
  </form>;
}
