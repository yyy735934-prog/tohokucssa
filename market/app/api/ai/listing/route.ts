import { getMemberAccess } from "../../../../lib/auth";
import { getDb } from "../../../../db";
import { listingAnalyses } from "../../../../db/schema";
import {
  inferListingIntelligence,
  LISTING_CATEGORIES,
} from "../../../../lib/listing-intelligence";
import {
  buildGeminiRequestBody,
  extractOutputText,
  type GeminiGenerateContentResponse,
} from "../../../../lib/gemini-api";
import { isOwnedListingImageKey } from "../../../../lib/upload-ownership";
import { canUseMarketplace } from "../../../../lib/member-status";

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxImageBytes = 2 * 1024 * 1024;
export const geminiModels = ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite"] as const;

type RecognitionPayload = {
  title?: unknown;
  description?: unknown;
  category?: unknown;
  riskLevel?: unknown;
  riskReason?: unknown;
};

function parseRecognitionPayload(outputText: string): RecognitionPayload {
  const cleaned = outputText
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  const jsonText =
    firstBrace >= 0 && lastBrace > firstBrace
      ? cleaned.slice(firstBrace, lastBrace + 1)
      : cleaned;
  return JSON.parse(jsonText) as RecognitionPayload;
}

function imageBase64(bytes: ArrayBuffer) {
  const binary = Array.from(new Uint8Array(bytes), (value) =>
    String.fromCharCode(value),
  ).join("");
  return btoa(binary);
}

function safeErrorMessage(value: unknown) {
  const message = value instanceof Error ? value.message : String(value);
  return message
    .replace(/AIza[\w-]+/g, "[REDACTED_KEY]")
    .replace(/AQ\.[\w.-]+/g, "[REDACTED_KEY]")
    .slice(0, 500);
}

function publicGeminiError(status: number) {
  if (status === 400) {
    return {
      code: "AI_REQUEST_REJECTED",
      error: "Gemini 暂时无法处理这张照片，请稍后重试。",
    };
  }
  if (status === 401) {
    return {
      code: "AI_KEY_INVALID",
      error: "Gemini 密钥无效或尚未生效，请联系管理员更新。",
    };
  }
  if (status === 403) {
    return {
      code: "AI_PERMISSION_DENIED",
      error: "Gemini 项目尚未获得调用权限，请联系管理员检查 API 权限。",
    };
  }
  if (status === 404) {
    return {
      code: "AI_MODEL_UNAVAILABLE",
      error: "当前 Gemini 模型暂不可用，请联系管理员更新模型。",
    };
  }
  if (status === 429) {
    return {
      code: "AI_QUOTA_EXCEEDED",
      error: "Gemini 免费额度暂时用尽，请稍后重试或手动填写。",
    };
  }
  return {
    code: "AI_PROVIDER_FAILED",
    error: "Gemini 服务暂时不可用，请稍后重试或手动填写。",
  };
}

export async function POST(request: Request) {
  const member = await getMemberAccess();
  if (!member) {
    return Response.json({ error: "请先登录后使用 AI 识别。" }, { status: 401 });
  }
  if (!canUseMarketplace(member.academicStatus, member.isAdmin)) {
    return Response.json(
      { error: "账号获得发布权限后即可使用 AI 识别。" },
      { status: 403 },
    );
  }

  const form = await request.formData();
  const image = form.get("image");
  const imageKey = form.get("imageKey");
  if (!(image instanceof File) || !allowedTypes.has(image.type)) {
    return Response.json(
      { error: "请选择 JPG、PNG 或 WebP 商品照片。" },
      { status: 400 },
    );
  }
  if (image.size > maxImageBytes) {
    return Response.json(
      { error: "照片优化后仍超过 2 MB，请重新选择。" },
      { status: 413 },
    );
  }

  const { env } = await import("cloudflare:workers");
  const runtimeEnv = env as unknown as { GEMINI_API_KEY?: string };
  if (!runtimeEnv.GEMINI_API_KEY) {
    return Response.json(
      {
        code: "AI_NOT_CONFIGURED",
        error: "Gemini 照片识别尚未启用，请联系管理员配置密钥。",
      },
      { status: 503 },
    );
  }
  const geminiApiKey = runtimeEnv.GEMINI_API_KEY.trim();
  if (!geminiApiKey) {
    return Response.json(
      {
        code: "AI_NOT_CONFIGURED",
        error: "Gemini 照片识别尚未启用，请联系管理员配置密钥。",
      },
      { status: 503 },
    );
  }

  try {
    let response: Response | null = null;
    let responseText = "";
    let payload: GeminiGenerateContentResponse = {};
    for (const [modelIndex, geminiModel] of geminiModels.entries()) {
      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent`,
        {
          method: "POST",
          headers: {
            "x-goog-api-key": geminiApiKey,
            "content-type": "application/json",
          },
          body: JSON.stringify(
            buildGeminiRequestBody(
              image.type,
              imageBase64(await image.arrayBuffer()),
              LISTING_CATEGORIES,
            ),
          ),
        },
      );
      responseText = await response.text();
      payload = {};
      try {
        payload = responseText
          ? (JSON.parse(responseText) as GeminiGenerateContentResponse)
          : {};
      } catch (error) {
        console.error(JSON.stringify({
          event: "gemini_listing_invalid_json",
          model: geminiModel,
          httpStatus: response.status,
          responseContentType: response.headers.get("content-type"),
          responseBodyLength: responseText.length,
          error: safeErrorMessage(error),
        }));
      }

      if (response.ok) break;
      console.error(JSON.stringify({
          event: "gemini_listing_request_failed",
          model: geminiModel,
          httpStatus: response.status,
          responseStatusText: response.statusText,
          responseContentType: response.headers.get("content-type"),
          responseContentLength: response.headers.get("content-length"),
          responseBodyLength: responseText.length,
          providerCode: payload.error?.code,
          providerStatus: payload.error?.status,
          providerMessage: safeErrorMessage(
            payload.error?.message || responseText || "Gemini request failed",
          ),
          apiKeyLength: geminiApiKey.length,
          apiKeyPrefixValid: geminiApiKey.startsWith("AIza"),
          apiKeyTrimmed: geminiApiKey !== runtimeEnv.GEMINI_API_KEY,
        }));
      const retryable = response.status === 404 || response.status === 429 || response.status >= 500;
      if (!retryable || modelIndex === geminiModels.length - 1) {
        return Response.json(publicGeminiError(response.status), {
          status: response.status >= 400 && response.status < 600 ? response.status : 502,
        });
      }
    }

    if (!response?.ok) throw new Error("AI_PROVIDER_UNAVAILABLE");

    const outputText = extractOutputText(payload);
    if (!outputText) {
      throw new Error(
        `AI_RESPONSE_EMPTY:${payload.promptFeedback?.blockReason ?? "unknown"}`,
      );
    }

    const recognized = parseRecognitionPayload(outputText);
    const title =
      typeof recognized.title === "string"
        ? recognized.title.trim().slice(0, 80)
        : "";
    const description =
      typeof recognized.description === "string"
        ? recognized.description.trim().slice(0, 800)
        : "";
    const category =
      typeof recognized.category === "string"
        ? recognized.category
        : undefined;

    if (title.length < 2 || description.length < 5) {
      throw new Error("AI_OUTPUT_INCOMPLETE");
    }

    const visual = inferListingIntelligence(title, description, category);
    const riskLevel = recognized.riskLevel === "low" ? "low" : "review";
    const riskReason =
      typeof recognized.riskReason === "string"
        ? recognized.riskReason.trim().slice(0, 160)
        : riskLevel === "low"
          ? "普通二手物品"
          : "需要人工确认";

    if (await isOwnedListingImageKey(member.email, imageKey)) {
      const db = await getDb();
      await db
        .insert(listingAnalyses)
        .values({
          imageKey: imageKey as string,
          ownerEmail: member.email,
          title,
          description,
          category: visual.category,
          riskLevel,
          riskReason,
        })
        .onConflictDoUpdate({
          target: listingAnalyses.imageKey,
          set: { title, description, category: visual.category, riskLevel, riskReason },
        });
    }
    return Response.json({
      title,
      description,
      ...visual,
      riskLevel,
      riskReason,
      source: "gemini",
    });
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "gemini_listing_processing_failed",
        error: safeErrorMessage(error),
      }),
    );
    return Response.json(
      {
        code: "AI_RECOGNITION_FAILED",
        error: "Gemini 返回结果异常，请稍后重试或手动填写。",
      },
      { status: 502 },
    );
  }
}
