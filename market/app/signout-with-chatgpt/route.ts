import {
  chatGPTSignInPath,
  clearSessionCookie,
  safeRelativeReturnPath,
} from "../chatgpt-auth";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const returnTo = safeRelativeReturnPath(
    requestUrl.searchParams.get("return_to") ?? "/",
  );
  const location = requestUrl.searchParams.get("switch") === "1"
    ? chatGPTSignInPath(returnTo)
    : returnTo;
  return new Response(null, {
    status: 302,
    headers: {
      location,
      "set-cookie": clearSessionCookie(),
      "cache-control": "no-store",
    },
  });
}
