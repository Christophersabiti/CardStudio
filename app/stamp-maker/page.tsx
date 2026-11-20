import Shell from '@/components/marketing/Shell';
import StampMaker from '@/components/marketing/StampMaker';
import FeatureUnavailable from '@/components/FeatureUnavailable';
import { featureFlags, featureName } from '@/lib/features';
export const dynamic = 'force-dynamic';
export const metadata={title:'Online Stamp Maker | Card Studio',description:'Create a custom company stamp or seal. Choose a template, edit the date and details, then download a transparent PNG.'};
export default async function Page(){
  const enabled = (await featureFlags()).stamps;
  return <Shell>{enabled ? <StampMaker/> : <FeatureUnavailable name={featureName('stamps')}/>}</Shell>;
}
