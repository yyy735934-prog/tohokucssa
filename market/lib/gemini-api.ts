export type GeminiGenerateContentResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
  promptFeedback?: {
    blockReason?: string;
  };
  error?: {
    code?: string | number;
    message?: string;
    status?: string;
  };
};

export function extractOutputText(response: GeminiGenerateContentResponse) {
  for (const candidate of response.candidates ?? []) {
    for (const part of candidate.content?.parts ?? []) {
      if (part.text) return part.text;
    }
  }
  return null;
}

export function buildGeminiRequestBody(
  mimeType: string,
  data: string,
  categories: readonly string[],
) {
  return {
    contents: [
      {
        parts: [
          {
            inline_data: {
              mime_type: mimeType,
              data,
            },
          },
          {
            text:
              `识别照片中主要的二手商品。用简洁中文生成商品标题与描述，不要猜测照片中看不清的品牌、型号、功能状态或配件。标题应适合二手平台；描述应明确提示卖家核对成色、功能和配件。分类只能从以下栏目中选择一个：${categories.join("、")}。只输出一个 JSON 对象，不要输出 Markdown 或其他文字，格式为：{"title":"商品名称","description":"商品描述","category":"栏目"}`,
          },
        ],
      },
    ],
  };
}
