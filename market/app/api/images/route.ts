export async function GET(request: Request) {
  const key = new URL(request.url).searchParams.get("key") ?? "";
  if (!key.startsWith("listings/") || key.includes("..") || key.length > 240) {
    return new Response("Invalid image key", { status: 400 });
  }

  const { env } = await import("cloudflare:workers");
  const runtimeEnv = env as unknown as { BUCKET: R2Bucket };
  const object = await runtimeEnv.BUCKET.get(key);
  if (!object) return new Response("Not found", { status: 404 });

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "public, max-age=86400, immutable");
  headers.set("x-content-type-options", "nosniff");
  return new Response(object.body, { headers });
}
