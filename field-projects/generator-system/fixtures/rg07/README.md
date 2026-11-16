# RG07 offline product-state fixture

`design.ts` extends the accepted ownership fixture with a second API module on the same database.
The API and independent worker share one product namespace and history; the unrelated reader
receives only the named published view. No generated export or database state is recorded here.

`products.json` and `migrations/0001-initial.sql` are application-authored inputs used by the
PGlite tests. Copy them to the declared paths of a fresh scratch export. Tests register explicit
SELECT/INSERT/UPDATE files in memory, exercise their real parameterized statements and restricted
roles, then append versions and inject failures. The test's expected rows and permission denials
are independent assertions. These inputs are never run against an existing application.

Native authenticated logins and simultaneous migrators remain RG14. PGlite uses explicit
session authorization for owner/product-role checks; it is not a native connection-auth test.
