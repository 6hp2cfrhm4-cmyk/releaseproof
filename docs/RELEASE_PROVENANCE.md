# Release provenance

`v0.1.0` is historical and immutable. Do not move its tag or replace its assets.

For the next release:

1. Finish independent re-audit on a clean commit with all release gates green.
2. Record the source commit SHA in the release notes.
3. Create the annotated version tag at that exact commit.
4. Build all artifacts from a clean checkout of the tag commit in CI.
5. Run the bundled CLI tarball E2E before publication.
6. Generate `SHA256SUMS.txt` from the final artifacts using `node scripts/generate-sha256s.mjs <artifact>...`.
7. Publish the artifacts and checksum file once; never replace them in place.
8. Verify downloaded artifact hashes and record the workflow run URL in the release notes.

The source commit, tag commit, build checkout, artifact names, and checksum file must all describe the same immutable release.
