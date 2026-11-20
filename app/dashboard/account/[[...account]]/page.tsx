import { UserProfile } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import SiteHeader from "@/components/nav/SiteHeader";
import AccountOverview from "@/components/AccountOverview";
import { currentUser } from "@/lib/auth/session";
import { accountSummary } from "@/lib/billing/account-summary";

export default async function AccountPage() {
  const user = await currentUser();
  if (!user) redirect("/sign-in?next=/dashboard/account");
  const summary = await accountSummary(user);
  return (
    <>
      <SiteHeader />
      <main className="acct-page">
        <AccountOverview summary={summary} />
        <section id="account-settings" className="acct-settings" aria-labelledby="settings-heading">
          <h2 id="settings-heading" className="text-xl font-bold">Account settings</h2>
          <p className="cs-muted text-sm mt-1 mb-4">
            Use <strong>Profile</strong> to change your name, photo or email address. Use <strong>Security</strong> to change your password, sign out other devices or add two-step verification.
          </p>
          <UserProfile routing="path" path="/dashboard/account" />
        </section>
      </main>
    </>
  );
}
