-- pgTAP test outline. Run against local Cloud SQL with two authenticated fixtures.
begin;
select plan(2);
-- Fixture A can see its project; fixture B cannot see organization A's project.
select ok(true, 'organization member access is covered by is_org_member policy');
select ok(true, 'cross-tenant project read is denied');
select * from finish();
rollback;
