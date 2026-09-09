import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { test } from "node:test";
import { isSuperAdministrator } from "../lib/roles";

test("print access allows a verified super admin without requiring a paid subscription", () => {
  // Execute the actual server-only entitlement function in its server condition.
  // No database configuration: a regression to billing-only access must fail.
  const output = execFileSync(process.execPath, ["--conditions=react-server", "--import", "tsx", "-e", `
    const { printAccess } = require('./lib/print-package/access.ts');
    printAccess({id:'owner',appRole:'superadmin',status:'active'})
      .then(result => console.log(JSON.stringify(result)))
      .catch(() => process.exit(1));
  `], { cwd: process.cwd(), encoding: "utf8", env: {...process.env, NEXT_PUBLIC_SUPABASE_URL:"", SUPABASE_SERVICE_ROLE_KEY:""} });
  assert.deepEqual(JSON.parse(output.trim()),{allowed:true,plan:"Superadmin"});
});

test("super-admin exception rejects ordinary roles, inactive accounts, and client metadata", () => {
  type User = Parameters<typeof isSuperAdministrator>[0];
  assert.equal(isSuperAdministrator({appRole:"superadmin",status:"active"}),true);
  for (const user of [null,{appRole:"member",status:"active"},{appRole:"admin",status:"active"},{appRole:"superadmin",status:"disabled"},{status:"active",publicMetadata:{role:"superadmin"},app_metadata:{card_studio_role:"superadmin"}}])
    assert.equal(isSuperAdministrator(user as User),false);
});
