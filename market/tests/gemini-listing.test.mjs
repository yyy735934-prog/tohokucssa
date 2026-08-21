import assert from "node:assert/strict";
import test from "node:test";
import {
  buildGeminiRequestBody,
  extractOutputText,
} from "../lib/gemini-api.ts";

test("builds the documented generateContent image request shape", () => {
  const body = buildGeminiRequestBody("image/png", "base64-image", [
    "家具",
    "家电",
    "电子产品",
    "交通",
  ]);

  assert.deepEqual(body.contents[0].parts[0], {
    inline_data: {
      mime_type: "image/png",
      data: "base64-image",
    },
  });
  assert.match(body.contents[0].parts[1].text, /家具、家电、电子产品、交通/);
});

test("extracts text from a generateContent candidate", () => {
  assert.equal(
    extractOutputText({
      candidates: [
        {
          content: {
            parts: [{ text: '{"title":"电饭煲"}' }],
          },
        },
      ],
    }),
    '{"title":"电饭煲"}',
  );
});

test("returns null when Gemini provides no text candidate", () => {
  assert.equal(extractOutputText({ candidates: [] }), null);
});
