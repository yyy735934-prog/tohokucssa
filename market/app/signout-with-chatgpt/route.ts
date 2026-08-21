import {
  clearSessionCookie,
  safeRelativeReturnPath,
} from "../chatgpt-auth";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const returnTo = safeRelativeReturnPath(
    requestUrl.searchParams.get("return_to") ?? "/",
  );
  return new Response(null, {
    status: 302,
    headers: {
      location: returnTo,
      "set-cookie": clearSessionCookie(),
      "cache-control": "no-store",
    },
  });
}
