import Shell from '@/components/marketing/Shell';
import EmailSignature from '@/components/marketing/EmailSignature';
import FeatureUnavailable from '@/components/FeatureUnavailable';
import { featureFlags, featureName } from '@/lib/features';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Email Signature Generator | Card Studio', description: 'Create, customize and install a professional email signature for Gmail, Outlook and Apple Mail.' };
export default async function Page() {
  const enabled = (await featureFlags()).email_signature;
  return <Shell>{enabled ? <EmailSignature/> : <FeatureUnavailable name={featureName('email_signature')}/>}</Shell>;
}
