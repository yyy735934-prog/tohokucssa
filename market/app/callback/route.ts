import {
  createSessionCookie,
  readCookie,
  safeRelativeReturnPath,
  serializeCookie,
} from "../chatgpt-auth";

const OAUTH_COOKIE = "tohoku_oauth";

type GoogleTokenResponse = {
  access_token?: string;
  error_description?: string;
};

type GoogleUserInfo = {
  email?: string;
  email_verified?: boolean;
  name?: string;
};

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const returnedState = requestUrl.searchParams.get("state");
  const oauthCookie = readCookie(request.headers.get("cookie"), OAUTH_COOKIE);
  const oauthState = parseOauthState(oauthCookie);
  if (!code || !returnedState || !oauthState || returnedState !== oauthState.state) {
    return new Response("登录状态无效或已过期，请返回网站重试。", { status: 400 });
  }

  const { env } = await import("cloudflare:workers");
  const runtimeEnv = env as unknown as {
    GOOGLE_CLIENT_ID?: string;
    GOOGLE_CLIENT_SECRET?: string;
  };
  if (!runtimeEnv.GOOGLE_CLIENT_ID || !runtimeEnv.GOOGLE_CLIENT_SECRET) {
    return new Response("Google 登录尚未配置完整。", { status: 503 });
  }

  const redirectUri = new URL("/callback", request.url).toString();
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: runtimeEnv.GOOGLE_CLIENT_ID,
      client_secret: runtimeEnv.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  const token = (await tokenResponse.json()) as GoogleTokenResponse;
  if (!tokenResponse.ok || !token.access_token) {
    return new Response(token.error_description ?? "Google 登录失败。", {
      status: 502,
    });
  }

  const profileResponse = await fetch(
    "https://openidconnect.googleapis.com/v1/userinfo",
    { headers: { authorization: `Bearer ${token.access_token}` } },
  );
  const profile = (await profileResponse.json()) as GoogleUserInfo;
  if (!profileResponse.ok || !profile.email || profile.email_verified !== true) {
    return new Response("Google 邮箱尚未验证，无法登录。", { status: 403 });
  }

  const sessionCookie = await createSessionCookie(
    profile.email,
    profile.name ?? profile.email,
  );
  const headers = new Headers({
    location: safeRelativeReturnPath(oauthState.returnTo),
    "cache-control": "no-store",
  });
  headers.append("set-cookie", sessionCookie);
  headers.append("set-cookie", serializeCookie(OAUTH_COOKIE, "", { maxAge: 0 }));
  return new Response(null, { status: 302, headers });
}

function parseOauthState(value: string | null) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(value)) as {
      state?: string;
      returnTo?: string;
      createdAt?: number;
    };
    if (
      typeof parsed.state !== "string" ||
      typeof parsed.returnTo !== "string" ||
      typeof parsed.createdAt !== "number" ||
      Date.now() - parsed.createdAt > 10 * 60 * 1000
    ) {
      return null;
    }
    return {
      state: parsed.state,
      returnTo: safeRelativeReturnPath(parsed.returnTo),
    };
  } catch {
    return null;
  }
}
