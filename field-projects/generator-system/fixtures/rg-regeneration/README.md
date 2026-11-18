# Regeneration adoption fixture

The diagram copies E10's existing regeneration fixture and adds the necessary precise product
table grant through setDatabaseAccess. Owned files explicitly migrate its two raw-client hooks
to API8 ProductQueries and registered SQL. The old fixture and recorded exports stay unchanged.
RG24 reconstructs a genuine pre-versioned export using the GS08 generator at d524845. Public
update refuses incompatible hooks, unreviewed SQL and the changed product namespace, including
with acknowledgement. Explicit cold adoption uses a fresh public export and handwritten migration;
it is not automatic live legacy-database conversion. Subsequent compatible public updates preserve
all migrated bodies. Native API8 data and pending-work preservation are separate selected cases.
