import test from 'node:test';
import assert from 'node:assert/strict';
import { isAdministrator } from '../lib/roles';

test('admin access requires trusted app metadata and a non-anonymous user',()=>{
  assert.equal(isAdministrator(null),false);
  assert.equal(isAdministrator({app_metadata:{}}),false);
  assert.equal(isAdministrator({app_metadata:{},user_metadata:{card_studio_role:'admin'}} as Parameters<typeof isAdministrator>[0]),false);
  assert.equal(isAdministrator({app_metadata:{card_studio_role:'admin'},is_anonymous:true}),false);
  assert.equal(isAdministrator({app_metadata:{card_studio_role:'admin'},is_anonymous:false}),true);
});
