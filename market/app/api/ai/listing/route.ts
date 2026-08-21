import { getMemberAccess } from "../../../../lib/auth";
import {
  inferListingIntelligence,
  LISTING_CATEGORIES,
} from "../../../../lib/listing-intelligence";

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxImageBytes = 2 * 1024 * 1024;
const geminiModel = "gemini-2.5-flash-lite";

type RecognitionPayload = {
  title?: unknown;
  description?: unknown;
  category?: unknown;
};

type GeminiInteractionResponse = {
  output_text?: string;
  status?: string;
  steps?: Array<{
    type?: string;
    content?: Array<{ type?: string; text?: string }>;
  }>;
  error?: {
    code?: string | number;
    message?: string;
    status?: string;
  };
};

function extractOutputText(response: GeminiInteractionResponse) {
  if (response.output_text) return response.output_text;
  for (const step of response.steps ?? []) {
    if (step.type !== "model_output") continue;
    for (const content of step.content ?? []) {
      if (content.type === "text" && content.text) return content.text;
    }
  }
  return null;
}

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
  if (member.academicStatus !== "verified" && !member.isAdmin) {
    return Response.json(
      { error: "完成学友身份认证后即可使用 AI 识别。" },
      { status: 403 },
    );
  }

  const form = await request.formData();
  const image = form.get("image");
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

  try {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/interactions",
      {
        method: "POST",
        headers: {
          "x-goog-api-key": runtimeEnv.GEMINI_API_KEY,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: geminiModel,
          input: [
            {
              type: "image",
              mime_type: image.type,
              data: imageBase64(await image.arrayBuffer()),
            },
            {
              type: "text",
              text:
                `识别照片中主要的二手商品。用简洁中文生成商品标题与描述，不要猜测照片中看不清的品牌、型号、功能状态或配件。标题应适合二手平台；描述应明确提示卖家核对成色、功能和配件。分类只能从以下栏目中选择一个：${LISTING_CATEGORIES.join("、")}。只输出一个 JSON 对象，不要输出 Markdown 或其他文字，格式为：{"title":"商品名称","description":"商品描述","category":"栏目"}`,
            },
          ],
        }),
      },
    );

    let payload: GeminiInteractionResponse = {};
    try {
      payload = (await response.json()) as GeminiInteractionResponse;
    } catch (error) {
      console.error(
        JSON.stringify({
          event: "gemini_listing_invalid_json",
          httpStatus: response.status,
          error: safeErrorMessage(error),
        }),
      );
    }

    if (!response.ok) {
      console.error(
        JSON.stringify({
          event: "gemini_listing_request_failed",
          httpStatus: response.status,
          providerCode: payload.error?.code,
          providerStatus: payload.error?.status,
          providerMessage: safeErrorMessage(
            payload.error?.message ?? "Gemini request failed",
          ),
        }),
      );
      return Response.json(publicGeminiError(response.status), {
        status:
          response.status >= 400 && response.status < 600
            ? response.status
            : 502,
      });
    }

    const outputText = extractOutputText(payload);
    if (!outputText) {
      throw new Error(`AI_RESPONSE_EMPTY:${payload.status ?? "unknown"}`);
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
    return Response.json({
      title,
      description,
      ...visual,
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
