"use client";
import Link from "next/link";
import { useUser, UserButton, SignOutButton } from "@clerk/nextjs";

export default function AuthControls() {
  const { isLoaded, isSignedIn } = useUser();
  if (!isLoaded) return <Link href="/sign-in">Account</Link>;
  return isSignedIn ? <>
    <Link href="/dashboard">My cards</Link>
    <Link href="/dashboard/account">Account</Link>
    <SignOutButton redirectUrl="/sign-in"><button type="button">Sign out</button></SignOutButton>
    <UserButton userProfileMode="navigation" userProfileUrl="/dashboard/account" />
  </> : <><Link href="/sign-in">Sign in</Link><Link href="/sign-up">Create account</Link></>;
}
