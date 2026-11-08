# Experimental local templates

`local-v1/index.ts` registers all 19 bounded template IDs from the frozen YouTube local profile.
Use the exported `localV1Templates` explicitly; the assembler's empty default is still diagnostic.
The registry reads its own source and sorted exact `.template` assets once at module load and
hashes them with each family ID. Every edit changes template identities; render reads only its
validated frozen input. Families are version `0.1.0-experimental.1`, not certified templates.

`local.project` owns shared build/Compose/setup files once. Each selector family owns its actual
shells/client modules/resource declarations/extension files and exact setting decisions. Resource
files and dependency helpers provide local foundations; G01–G08 remain custom. This finite profile
uses canonical IDs/definitions/settings/links, never display labels or prose as algorithms.

Asset filenames append `.template` to avoid compiling template code as generator implementation.
Their emitted bytes are unchanged. `pnpm-lock.yaml.template` is the actual standalone dependency
closure resolved with the frozen exact pins; `infra/ffmpeg-os.lock.template` contains all 288 OS
package versions observed in the fixed-snapshot Debian build. Neither is a runtime certification.
Changing dependency pins requires a reviewed input/profile decision rather than editing frozen
inputs. Secrets/data are created after export under private `.runtime`, outside source hashes.

From the checkout:

```
pnpm --filter @jeeves/generator export:new /tmp/new-youtube-scaffold
cd /tmp/new-youtube-scaffold
pnpm install --frozen-lockfile
pnpm build
```

See the emitted README for startup and limitations, and `.jeeves/{manifest,report}.json` for
per-file provenance, honest setting treatment and unchanged strict readiness. FP03a verifies
actual emitted output in scratch exports. FP03b supplies the mouse download flow; FP04 must
commit untouched actual output before the FP05 custom implementation plan.
