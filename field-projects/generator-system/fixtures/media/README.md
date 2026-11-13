# Media fixture ownership

`design.json` preserves the parsed values of PF14-reviewed YouTube v4's saved command-authored
design. This is a separate backend fixture: it contains no browser code, generated scaffold,
`.jeeves` override or product media. `provenance.json` records the original input and owned-file
hashes and the v4 ownership record inspected before reuse.

`attachments.json` names eleven destinations, all current report/manifest-owned extensions:
eight hook files, two stub bodies and the lifecycle product SQL. The shared video codec is folded
into the lifecycle hook and imported by the others, so no unreported additional path is allowed.
The only policy change from v4 is that any verified fixture account may upload, using its
verified username as the channel; no creator role is provisioned. Codec filename validation uses
equivalent character-code checks instead of a control-character regex. Historical comments were
removed and Biome formatting applied; the actual upload, lifecycle, encoder, cache, counter,
favorites, search and outbox mechanisms stay in installed templates.

The runner generates deterministic media with the fresh export's pinned FFmpeg image and keeps
binary files only in its disposable temporary directory/container. It records hashes and probes,
not media binaries. The test starts, resumes, completes and aborts through actual endpoints;
normal read-only object credentials independently read the completed originals. Invalid media
must become INVALID_MEDIA in lifecycle state and the broker's terminal job. Public HLS and JPEG
bytes are fetched through generated delivery and inspected with FFprobe; no browser or human
listening claim is made. See the parent README for the command and evidence contract.
