import test from 'node:test';
import assert from 'node:assert/strict';
import { isAdministrator } from '../lib/roles';

test('admin access requires an active server-resolved application role',()=>{
  assert.equal(isAdministrator(null),false);
  assert.equal(isAdministrator({appRole:'member',status:'active'}),false);
  assert.equal(isAdministrator({app_metadata:{card_studio_role:'admin'},publicMetadata:{role:'admin'}} as unknown as Parameters<typeof isAdministrator>[0]),false);
  assert.equal(isAdministrator({appRole:'admin',status:'disabled'} as unknown as Parameters<typeof isAdministrator>[0]),false);
  assert.equal(isAdministrator({appRole:'admin',status:'active'}),true);
});
