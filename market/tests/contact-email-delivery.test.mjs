import assert from "node:assert/strict";
import test from "node:test";
import { canRetryContactEmail } from "../lib/contact-email-delivery.ts";

test("retries accepted-contact emails at most five times", () => {
  assert.equal(canRetryContactEmail(0), true);
  assert.equal(canRetryContactEmail(4), true);
  assert.equal(canRetryContactEmail(5), false);
});
