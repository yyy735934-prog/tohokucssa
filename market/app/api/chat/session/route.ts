import { canUseMarketplace } from "../../../../lib/member-status";
import { requireMemberAccess } from "../../../../lib/auth";
import { ensureChatIdentity, getChatConfiguration } from "../../../../lib/cometchat-server";

export const dynamic = "force-dynamic";

export async function GET() {
  const member = await requireMemberAccess("/messages");
  if (!canUseMarketplace(member.academicStatus, member.isAdmin)) return Response.json({ error: "完成成员认证后即可使用聊天。" }, { status: 403 });
  const config = await getChatConfiguration();
  if (!config) return Response.json({ error: "聊天服务尚未完成配置。" }, { status: 503 });
  try {
    const identity = await ensureChatIdentity(member.email, config);
    return Response.json({ appId: config.COMETCHAT_APP_ID, region: config.COMETCHAT_REGION, uid: identity.providerUid, authToken: identity.authToken });
  } catch (error) {
    console.error("chat session failed", error);
    return Response.json({ error: "聊天服务暂时不可用，请稍后再试。" }, { status: 502 });
  }
}
