/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { sendDailyAdminReviewReminder } from "../lib/admin-reminder";
import { sendDailyUnreadChatReminders } from "../lib/chat-unread-reminder";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  BUCKET: R2Bucket;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
  ADMIN_EMAILS?: string;
  EMAIL_FROM?: string;
  RESEND_API_KEY?: string;
  EMAIL?: import("../lib/outbound-email").EmailBinding;
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    return handler.fetch(request, env, ctx);
  },
  async scheduled(
    _controller: { scheduledTime: number; cron: string },
    env: Env,
    ctx: ExecutionContext,
  ) {
    const tasks: Promise<unknown>[] = [];
    if (_controller.cron === "0 9 * * *") tasks.push(sendDailyAdminReviewReminder(env));
    const scheduled = new Date(_controller.scheduledTime);
    // Use the existing 15-minute trigger throughout the 23:00 UTC hour. The
    // reminder window and run id are normalized to 23:00, so later invocations
    // safely retry a failed 08:00 JST run without sending duplicates.
    if (_controller.cron === "*/15 * * * *" && scheduled.getUTCHours() === 23) {
      tasks.push(sendDailyUnreadChatReminders(env, _controller.scheduledTime));
    }
    ctx.waitUntil(Promise.all(tasks).catch((error) => {
      console.error(JSON.stringify({
        event: "scheduled_email_task_failed",
        error: error instanceof Error ? error.message.slice(0, 180) : "unknown",
      }));
    }));
  },
};

export default worker;
