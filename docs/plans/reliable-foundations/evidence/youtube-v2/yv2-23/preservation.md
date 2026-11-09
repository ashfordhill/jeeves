# Final preservation

- All **748** protected owner/v1 path hashes and modes match the pre-unit baseline,
  including dirty owner README/feedback/Unicode deletions/colon variants and e2e-docker mode.
- Owner v1 **14 healthy /6 volumes**, owner v2 **14 healthy /5 volumes**. Before/after credential
  digests, exact volume identities, container IDs, image IDs, fixture SHA/size/mtime and runtime
  permissions match. [Before](owners-before.json), [raw after](owners-after.json.gz),
  [operator source](preserve.py.gz). No owner stop/reset/bootstrap occurred.
- All **22** pre-existing named Docker image tag→ID mappings remain intact. Only two
  independent tags were removed; no force-by-ID delete or global prune.
- Retained FFmpeg image `sha256:1792f4e0fb15896196cf9e3ba3d32ab2804ec27f4f7ab04c62ce050a102d8585` unchanged; fixture **15,584,953 B** /
  SHA256`1658728175f3a431c9c93107582ad14d4286d6fb3c5253c61f4731d3668aebf9`, mtime unchanged.
- All **102** actual completion app tracked file hashes match08699b2 after checks. All frozen v1
  protected inputs/assets/app and historical benchmark hashes remain unchanged.
- Saved studio project `2c7c8b08-4633-4a97-8794-672a777f1d3a` retains revision **2** and exact canonical sourceSHA`e118df2fdb6a4f1d05d1ef24962a926eb8c75e4219d45c9a6eccdfe87030a87b`.
- Independent exact-project cleanup finished before root check; own outside copy/runtime/media/
  secrets/dependencies/build removed. [Cleanup](cleanup.json).
