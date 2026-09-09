import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SOURCES = [
  "https://images.squarespace-cdn.com/content/v1/5ed364bdf430584ea5379af4/1590914882280-965VJHEPD2SASX79QVS3/Union%2BFood%2BFinal%2B-%2B5%2Bof%2B12.jpg?format=1200w",
  "https://images.squarespace-cdn.com/content/v1/5ed364bdf430584ea5379af4/1590914881083-15W4NNL711C64CWENZ00/Union%2BFood%2BFinal%2B-%2B1%2Bof%2B12.jpg?format=1200w",
  "https://images.squarespace-cdn.com/content/v1/5ed364bdf430584ea5379af4/1590914881710-L6PP30W4TUEIDEHHNOB5/Union%2BFood%2BFinal%2B-%2B6%2Bof%2B12.jpg?format=1200w",
  "https://images.squarespace-cdn.com/content/v1/5ed364bdf430584ea5379af4/1590914889052-L0NY50L3309BTU7CKL3L/Union%2BFood%2BFinal%2B-%2B7%2Bof%2B12.jpg?format=1200w",
  "https://images.squarespace-cdn.com/content/v1/5ed364bdf430584ea5379af4/1590914893070-PVCYCYRID6NDVKLMA74V/Union%2BFood%2BFinal%2B-%2B9%2Bof%2B12.jpg?format=1200w",
  "https://images.squarespace-cdn.com/content/v1/5ed364bdf430584ea5379af4/1590914887530-8CUXRDIHJFK7NMAKONZC/Union%2BFood%2BFinal%2B-%2B4%2Bof%2B12.jpg?format=1200w",
  "https://images.squarespace-cdn.com/content/v1/5ed364bdf430584ea5379af4/fbe8f04b-6cc6-4072-83ed-3a1683c7dd5e/Union%2BBuilding%2BNew.jpg?format=1200w"
];

function b64(bytes: Uint8Array) {
  let out = "";
  const size = 0x8000;
  for (let i = 0; i < bytes.length; i += size) {
    out += String.fromCharCode(...bytes.subarray(i, Math.min(i + size, bytes.length)));
  }
  return btoa(out);
}

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;");
}

async function fetchImage(url: string) {
  const r = await fetch(url, { headers: { "user-agent": "PerkDrop/1.0" } });
  if (!r.ok) throw new Error(`image_${r.status}`);
  const type = (r.headers.get("content-type") || "image/jpeg").split(";")[0];
  const bytes = new Uint8Array(await r.arrayBuffer());
  return { type, bytes };
}

Deno.serve(async (req) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return new Response("method_not_allowed", { status: 405 });
  }
  try {
    const ua = (req.headers.get("user-agent") || "").toLowerCase();
    const bot = /facebookexternalhit|facebot|twitterbot|linkedinbot|slackbot|discordbot|whatsapp|telegrambot|googlebot|bingbot|pinterest|crawler|spider/.test(ua);

    if (bot) {
      const first = await fetchImage(SOURCES[0]);
      return new Response(req.method === "HEAD" ? null : first.bytes, {
        headers: {
          "content-type": first.type,
          "cache-control": "public, max-age=3600, s-maxage=86400",
          "access-control-allow-origin": "*",
          "vary": "user-agent"
        }
      });
    }

    const fetched = await Promise.allSettled(SOURCES.map(async (url) => {
      const image = await fetchImage(url);
      return `data:${image.type};base64,${b64(image.bytes)}`;
    }));
    const images = fetched.filter((x): x is PromiseFulfilledResult<string> => x.status === "fulfilled").map(x => x.value);
    if (!images.length) return new Response("image_source_unavailable", { status: 502 });

    const total = images.length * 3.5;
    const frames = images.map((src, i) => {
      const delay = -(i * 3.5);
      return `<image href="${esc(src)}" x="0" y="0" width="1200" height="800" preserveAspectRatio="xMidYMid slice" opacity="0"><animate attributeName="opacity" values="1;1;0;0;1" keyTimes="0;0.135;0.165;0.97;1" dur="${total}s" begin="${delay}s" repeatCount="indefinite"/></image>`;
    }).join("");

    const svg = `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">${frames}</svg>`;
    return new Response(req.method === "HEAD" ? null : svg, {
      headers: {
        "content-type": "image/svg+xml; charset=utf-8",
        "cache-control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
        "access-control-allow-origin": "*",
        "vary": "user-agent"
      }
    });
  } catch (e) {
    console.error(e);
    return new Response("slideshow_failed", { status: 500 });
  }
});

