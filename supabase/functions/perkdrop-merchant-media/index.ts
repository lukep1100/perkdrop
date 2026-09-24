import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const ALLOWED_ORIGINS = new Set([
  "https://perkdrop.au",
  "https://www.perkdrop.au",
]);
const MAX_BYTES = 8 * 1024 * 1024;
const RIGHTS_BASES = new Set([
  "merchant_owned",
  "merchant_authorised",
  "licensed",
  "event_organiser_authorised",
  "other_documented",
]);

function headers(req: Request) {
  const origin = req.headers.get("origin") || "";
  const allowed = ALLOWED_ORIGINS.has(origin) ? origin : "https://perkdrop.au";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Cache-Control": "no-store",
    Vary: "Origin",
  };
}
function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers(req), "Content-Type": "application/json; charset=utf-8" },
  });
}
const clean = (value: unknown, max = 1800) => String(value ?? "").trim().slice(0, max);
const safeHttps = (value: unknown) => {
  const text = clean(value);
  if (!text) return null;
  try {
    const url = new URL(text);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
};
const digest = async (bytes: Uint8Array) => {
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), (value) => value.toString(16).padStart(2, "0")).join("");
};

function imageType(file: File, bytes: Uint8Array) {
  const jpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const png = bytes.length >= 8 && bytes.slice(0, 8).every((v, i) => v === [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a][i]);
  const webp = bytes.length >= 12 && new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP";
  const detected = jpeg ? "image/jpeg" : png ? "image/png" : webp ? "image/webp" : "";
  if (!detected || detected !== String(file.type || "").toLowerCase()) return null;
  return {
    contentType: detected,
    extension: detected === "image/jpeg" ? "jpg" : detected === "image/png" ? "png" : "webp",
  };
}

async function memberFor(sb: any, merchantId: string, userId: string) {
  const { data, error } = await sb
    .from("merchant_members")
    .select("role,status")
    .eq("merchant_id", merchantId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  return error ? null : data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: headers(req) });
  if (!['GET', 'POST'].includes(req.method)) return json(req, { ok: false, error: "method_not_allowed" }, 405);
  if (req.headers.get("origin") && !ALLOWED_ORIGINS.has(req.headers.get("origin")!)) return json(req, { ok: false, error: "origin_not_allowed" }, 403);

  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const auth = req.headers.get("authorization") || "";
    const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
    if (!token) return json(req, { ok: false, error: "unauthorized" }, 401);
    const { data: userData, error: userError } = await sb.auth.getUser(token);
    const user = userData.user;
    if (userError || !user) return json(req, { ok: false, error: "unauthorized" }, 401);

    let merchantId = "";
    let action = "";
    let body: any = null;
    let form: FormData | null = null;
    const contentType = req.headers.get("content-type") || "";
    if (req.method === "GET") {
      merchantId = clean(new URL(req.url).searchParams.get("merchant_id"), 80);
    } else if (contentType.includes("multipart/form-data")) {
      form = await req.formData();
      merchantId = clean(form.get("merchant_id"), 80);
      action = clean(form.get("action"), 80) || "upload_image";
    } else {
      body = await req.json().catch(() => null);
      merchantId = clean(body?.merchant_id, 80);
      action = clean(body?.action, 80);
    }
    if (!merchantId) return json(req, { ok: false, error: "merchant_id_required" }, 400);

    const member = await memberFor(sb, merchantId, user.id);
    if (!member || !["owner", "admin", "editor"].includes(member.role)) return json(req, { ok: false, error: "merchant_access_denied" }, 403);

    if (req.method === "GET") {
      const [{ data: merchant, error: merchantError }, { data: assets, error: assetsError }] = await Promise.all([
        sb.from("merchants").select("id,name,logo_url,hero_image_url,hero_media_asset_id,logo_media_asset_id,image_rights_status,media_rights_confirmed").eq("id", merchantId).single(),
        sb.from("merchant_media_assets").select("id,merchant_id,offer_id,asset_kind,staging_path,original_filename,content_type,byte_size,rights_basis,rights_statement,source_url,status,submitted_at,reviewed_at,review_reason,review_evidence,public_url,public_object_removed_at").eq("merchant_id", merchantId).order("submitted_at", { ascending: false }).limit(100),
      ]);
      if (merchantError || assetsError) return json(req, { ok: false, error: "merchant_media_load_failed" }, 500);
      const assetsWithPreview = await Promise.all((assets || []).map(async (asset: any) => {
        if (asset.status !== "pending") return asset;
        const { data } = await sb.storage.from("merchant-media-staging").createSignedUrl(asset.staging_path, 600);
        return { ...asset, preview_url: data?.signedUrl || null };
      }));
      return json(req, { ok: true, merchant, assets: assetsWithPreview });
    }

    if (action === "upload_image") {
      if (!form) return json(req, { ok: false, error: "multipart_required" }, 400);
      const confirmRights = String(form.get("confirm_rights") || "").toLowerCase() === "true";
      const rightsBasis = clean(form.get("rights_basis"), 80);
      const rightsStatement = clean(form.get("rights_statement"), 2000);
      const sourceUrl = safeHttps(form.get("source_url"));
      if (!confirmRights || !RIGHTS_BASES.has(rightsBasis) || rightsStatement.length < 12) {
        return json(req, { ok: false, error: "rights_attestation_required" }, 400);
      }
      const kind = clean(form.get("kind"), 30).toLowerCase();
      if (!['hero', 'logo', 'offer'].includes(kind)) return json(req, { ok: false, error: "invalid_media_kind" }, 400);
      const offerId = clean(form.get("offer_id"), 80) || null;
      if ((kind === "offer") !== Boolean(offerId)) return json(req, { ok: false, error: "offer_id_required_for_offer_media" }, 400);
      if (offerId) {
        const { data: offer } = await sb.from("merchant_offers").select("id").eq("id", offerId).eq("merchant_id", merchantId).maybeSingle();
        if (!offer) return json(req, { ok: false, error: "offer_not_found" }, 404);
      }
      const file = form.get("file");
      if (!(file instanceof File) || file.size < 1) return json(req, { ok: false, error: "image_file_required" }, 400);
      if (file.size > MAX_BYTES) return json(req, { ok: false, error: "image_too_large_max_8mb" }, 413);
      const bytes = new Uint8Array(await file.arrayBuffer());
      const verified = imageType(file, bytes);
      if (!verified) return json(req, { ok: false, error: "image_content_type_not_allowed" }, 415);

      const id = crypto.randomUUID();
      const filename = clean(file.name || `upload.${verified.extension}`, 180).replace(/[^a-zA-Z0-9._-]/g, "_") || `upload.${verified.extension}`;
      const path = `${merchantId}/${id}/${filename}`;
      const hash = await digest(bytes);
      const record = {
        id,
        merchant_id: merchantId,
        offer_id: offerId,
        asset_kind: kind,
        staging_bucket: "merchant-media-staging",
        staging_path: path,
        original_filename: filename,
        content_type: verified.contentType,
        byte_size: bytes.byteLength,
        content_sha256: hash,
        rights_basis: rightsBasis,
        rights_statement: rightsStatement,
        source_url: sourceUrl,
        submitted_by: user.id,
        status: "pending",
        metadata: { upload_channel: "merchant_portal", attested_at: new Date().toISOString() },
      };
      const { error: insertError } = await sb.from("merchant_media_assets").insert(record);
      if (insertError) {
        console.error("merchant media ledger insert", insertError);
        return json(req, { ok: false, error: "media_submission_failed" }, 500);
      }
      const { error: uploadError } = await sb.storage.from("merchant-media-staging").upload(path, bytes, {
        contentType: verified.contentType,
        cacheControl: "no-store",
        upsert: false,
      });
      if (uploadError) {
        await sb.from("merchant_media_assets").delete().eq("id", id).eq("status", "pending");
        console.error("merchant media staging upload", uploadError);
        return json(req, { ok: false, error: "image_upload_failed" }, 500);
      }
      return json(req, {
        ok: true,
        asset: { id, kind, offer_id: offerId, status: "pending", submitted_at: record.metadata.attested_at },
        message: "Image received for PerkDrop rights review. It is not public yet.",
      }, 201);
    }

    // A merchant cannot silently unpublish a reviewed public object: that
    // would leave the object reachable from the public approved bucket and
    // bypass the revocation audit/projection trigger. Owners revoke reviewed
    // media through the commercial review queue instead.
    if (action === "remove_public_image") {
      return json(req, { ok: false, error: "media_revocation_requires_owner_review" }, 409);
    }

    if (["authorize_candidate", "set_image"].includes(action)) {
      return json(req, { ok: false, error: "media_review_required" }, 409);
    }
    return json(req, { ok: false, error: "unknown_action" }, 400);
  } catch (error) {
    console.error("perkdrop-merchant-media", error);
    return json(req, { ok: false, error: "merchant_media_failed" }, 500);
  }
});
