import test from 'node:test';
import assert from 'node:assert/strict';
import { isCompletedNewDraft } from '../lib/draft-storage';

test('saved creation snapshots cannot be reused as new-card requests',()=>{
  assert.equal(isCompletedNewDraft({data:{firstName:'Saved'},revision:0,requestId:'old-id'}),true);
  assert.equal(isCompletedNewDraft({data:{firstName:'Saved'},revision:3}),true);
  assert.equal(isCompletedNewDraft({data:{firstName:'Unsaved'},requestId:'retry-id'}),false);
  for(const invalid of [null,undefined,{}, {revision:-1},{revision:'0'}])assert.equal(isCompletedNewDraft(invalid),false);
});
