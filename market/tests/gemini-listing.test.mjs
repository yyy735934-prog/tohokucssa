import assert from "node:assert/strict";
import test from "node:test";
import {
  buildGeminiRequestBody,
  extractOutputText,
} from "../lib/gemini-api.ts";
import { readFile } from "node:fs/promises";

test("builds the documented generateContent image request shape", () => {
  const body = buildGeminiRequestBody("image/png", "base64-image", [
    "家具",
    "家电",
    "电子产品",
    "车辆与出行",
  ]);

  assert.deepEqual(body.contents[0].parts[0], {
    inline_data: {
      mime_type: "image/png",
      data: "base64-image",
    },
  });
  assert.match(body.contents[0].parts[1].text, /家具、家电、电子产品、车辆与出行/);
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

test("listing recognition has a stable fallback model", async () => {
  const source = await readFile(new URL("../app/api/ai/listing/route.ts", import.meta.url), "utf8");
  assert.match(source, /gemini-3\.5-flash-lite/);
  assert.match(source, /gemini-3\.1-flash-lite/);
  assert.match(source, /response\.status === 429/);
});
