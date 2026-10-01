import { requireMemberAccess } from "../../../lib/auth";
import ChatClient from "./ChatClient";

export const dynamic = "force-dynamic";

export default async function ChatPage({ params }: { params: Promise<{ conversationId: string }> }) {
  const { conversationId } = await params;
  await requireMemberAccess(`/messages/${encodeURIComponent(conversationId)}`);
  return <ChatClient conversationId={conversationId} />;
}
