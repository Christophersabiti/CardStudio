"use client";
import Link from "next/link";
import { useUser, UserButton } from "@clerk/nextjs";

export default function AuthControls() {
  const { isLoaded, isSignedIn } = useUser();
  if (!isLoaded) return <Link href="/sign-in">Account</Link>;
  // Account settings and sign-out live in the avatar menu.
  return isSignedIn ? <>
    <Link href="/dashboard">My cards</Link>
    <Link href="/dashboard/qr">My QR codes</Link>
    <Link href="/billing">Billing</Link>
    <UserButton userProfileMode="navigation" userProfileUrl="/dashboard/account" />
  </> : <><Link href="/sign-in">Sign in</Link><Link href="/sign-up">Create account</Link></>;
}

/** Single account link for the public navigation; requires ClerkProvider. */
export function AccountLink() {
  const { isSignedIn } = useUser();
  return isSignedIn ? <Link href="/dashboard">My cards</Link> : <Link href="/sign-in">Sign in</Link>;
}
