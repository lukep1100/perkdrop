# Social publishing production runbook

## Safety boundary

- Private workspace: https://perkdrop.au/social-publishing (existing owner sign-in).
- Custom Edge Function authentication calls Supabase Auth getUser, then checks admin_users in the database. JWT verification at the gateway is off because the function performs this check explicitly; no service-role bypass is accepted by the endpoint.
- Jobs/events are RLS-enabled and have no anon/authenticated privileges. The service-role function returns records only after owner authorization.
- Public media is intentionally unauthenticated so Buffer can fetch it. Caption, channels, approval and job history remain private.
- Buffer key remains in Supabase Vault under perkdrop_buffer_api_key. No Vercel Buffer variable or client-side key. Rotate before 27 September 2026; warning starts 20 September.
- The legacy publisher returns disabled; its cron and configuration are disabled. Setup/rotation cannot enable it.
- There is no scheduling/publishing endpoint. The explicit owner button creates genuine Buffer drafts using saveToDraft=true, per https://developers.buffer.com/examples/create-draft-post.html.

## Workflow

1. Owner selects exactly five finished PNGs, caption and Instagram/Facebook channels.
2. Content-addressed SHA-256 filenames make URLs durable. Today's exact files are committed under public/social-media. Future uploads use owner-authorized signed uploads to Supabase Storage; Vercel rewrites the same URL scheme to that bucket.
3. A job stores the original byte sizes/hashes/order and exact caption. Content is immutable; any change requires a new job.
4. Server fetches all five public URLs, verifies HTTP 200 and image/png, exact hash/size, PNG chunk checksums, complete image end and pixel decompression.
5. Only all five successful checks produce ready. The preview hash uses canonical JSON, so PostgreSQL jsonb key ordering cannot invalidate approval.
6. Explicit approval is bound to that hash. Media is verified again before Buffer is called. Channel IDs are pinned to PerkDrop Instagram and Facebook; TikTok is excluded.
7. State is locked before each external request, then the returned post ID is stored. A separate Buffer read must confirm draft status, caption, channel and all five ordered media URLs.
8. A definite rejection can be retried for the rejected channel only. An uncertain response, crash or mismatch locks creation for reconciliation; never blindly retry. No remote mutation is made by verify/check_buffer.
9. Status changes append durable audit events automatically.

## Recovery

- Uploading: select the same five originals and resume; existing content-addressed objects are not overwritten.
- verification_failed: retry hosted verification; if the source bytes are damaged, obtain the intact original and create a new job (do not reconstruct or substitute the image).
- verifying stalled over three minutes: owner can recover to verification_failed.
- drafting stalled over three minutes or reconciliation_required: inspect the actual Buffer account and recorded IDs. Recover only after determining whether the remote write succeeded. Do not create duplicate posts.
- draft_failed: explicit reapproval retries the rejected channel; prior successful post IDs are preserved.
- No record called drafted should be treated as current proof indefinitely: Buffer may later be edited externally. Always inspect Buffer before claiming a current draft exists.

## Verification

Run:
```
node --test scripts/social-publishing.test.mjs
npm run build
node scripts/verify-social-media.mjs
```

The media verifier exits nonzero when any original fails. A 200 image/png response alone is not proof of a valid complete PNG.

Today's original ZIP contains a truncated 04.png (1,114,112 bytes, SHA-256 21b97c8a69eed82bc91923d0ac780211fdb74c6b52d830cf71f05a43c1ca908b). Its IDAT chunk is incomplete; it must not be approved. The other four originals pass full decoding. The test explicitly covers this corruption and does not silently repair it.

Production migration version: 20260914080417_social_publishing_preview.sql. Existing legacy campaigns/posts and encrypted credentials are preserved.
