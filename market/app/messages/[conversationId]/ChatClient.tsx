"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { describeCometChatError, ensureCometChatSession } from "../../../lib/cometchat-client";

type ChatInfo = { id: string; providerGroupId: string; counterpart: string; listing: { id: string; title: string; price: number; status: string; icon: string; imageUrl: string | null } };
type UiMessage = { id: number | string; text: string; sentAt: number; mine: boolean };

function toUiMessage(message: any, myUid: string): UiMessage | null {
  if (message?.getType?.() !== "text" || typeof message?.getText !== "function") return null;
  return { id: message.getId?.() ?? crypto.randomUUID(), text: message.getText(), sentAt: message.getSentAt?.() ?? Math.floor(Date.now() / 1000), mine: message.getSender?.()?.getUid?.() === myUid };
}

function acknowledgeConversation(conversationId: string, lastReadAt: number) {
  void fetch(`/api/chat/conversations/${encodeURIComponent(conversationId)}/read`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ lastReadAt }),
  }).catch(() => undefined);
}

export default function ChatClient({ conversationId }: { conversationId: string }) {
  const [info, setInfo] = useState<ChatInfo | null>(null);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [sending, setSending] = useState(false);
  const cometRef = useRef<any>(null);
  const sessionRef = useRef<{ uid: string } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
  useEffect(() => {
    let disposed = false;
    const listenerId = `tohoku-chat-${conversationId}`;
    void (async () => {
      try {
        const response = await fetch(`/api/chat/conversations/${encodeURIComponent(conversationId)}`, { cache: "no-store" });
        const detail = await response.json() as ChatInfo & { error?: string };
        if (!response.ok) throw new Error(detail.error || "会话不存在。");
        const { CometChat, session } = await ensureCometChatSession();
        const history = await new CometChat.MessagesRequestBuilder().setGUID(detail.providerGroupId).setTypes(["text"]).setLimit(50).build().fetchPrevious();
        if (disposed) return;
        cometRef.current = CometChat; sessionRef.current = session; setInfo(detail);
        setMessages(history.map((message: any) => toUiMessage(message, session.uid)).filter(Boolean) as UiMessage[]);
        const listener = new CometChat.MessageListener({
          onTextMessageReceived: (message: any) => {
            if (message.getReceiverId?.() !== detail.providerGroupId) return;
            const ui = toUiMessage(message, session.uid);
            if (ui) setMessages((current) => current.some((item) => item.id === ui.id) ? current : [...current, ui]);
            CometChat.markAsRead(message);
            acknowledgeConversation(conversationId, message.getSentAt?.() ?? Math.floor(Date.now() / 1000));
          },
        });
        CometChat.addMessageListener(listenerId, listener);
        const last = history.at(-1);
        if (last) CometChat.markAsRead(last);
        acknowledgeConversation(conversationId, last?.getSentAt?.() ?? Math.floor(Date.now() / 1000));
        setReady(true);
      } catch (reason) {
        const detail = describeCometChatError(reason);
        console.error(`CometChat thread load failed [${detail.code}] ${detail.message}`);
        if (!disposed) setError(reason instanceof Error ? reason.message : "聊天服务暂时不可用。");
      }
    })();
    return () => { disposed = true; cometRef.current?.removeMessageListener(listenerId); };
  }, [conversationId]);

  const send = async (event: FormEvent) => {
    event.preventDefault();
    const value = text.trim();
    if (!value || !info || !ready || !cometRef.current || sending) return;
    setSending(true); setError("");
    try {
      const CometChat = cometRef.current;
      const sent = await CometChat.sendMessage(new CometChat.TextMessage(info.providerGroupId, value.slice(0, 1000), CometChat.RECEIVER_TYPE.GROUP));
      const ui = toUiMessage(sent, sessionRef.current!.uid);
      if (ui) setMessages((current) => [...current, ui]);
      setText("");
    } catch { setError("发送失败，请检查网络后重试。"); } finally { setSending(false); }
  };

  return <main className="chat-page">
    <header className="chat-topbar"><Link href="/messages" aria-label="返回消息"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14.5 6-6 6 6 6" /></svg></Link><div><b>{info?.counterpart ?? "匿名交易聊天"}</b><small>不会显示双方真实身份</small></div></header>
    {info && <Link className="chat-listing" href={`/?listing=${encodeURIComponent(info.listing.id)}`}><div>{info.listing.imageUrl ? <img src={info.listing.imageUrl} alt="" /> : info.listing.icon}</div><span><b>{info.listing.title}</b><small>{info.listing.price === 0 ? "免费赠送" : `¥${info.listing.price.toLocaleString()}`} · {info.listing.status === "active" ? "在售" : info.listing.status === "sold" ? "已售出" : "已下架"}</small></span><i>查看商品 ›</i></Link>}
    <section className="chat-messages" aria-live="polite"><p className="chat-privacy">请勿在聊天中发送证件、银行卡等敏感信息。建议在公共场所交易。</p>{messages.map((message) => <article key={message.id} className={message.mine ? "mine" : "theirs"}><small>{message.mine ? "我" : info?.counterpart}</small><p>{message.text}</p><time>{new Date(message.sentAt * 1000).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}</time></article>)}<div ref={bottomRef} /></section>
    {error && <p className="chat-error" role="alert">{error}</p>}
    <form className="chat-composer" onSubmit={send}><textarea value={text} onChange={(event) => setText(event.target.value)} onKeyDown={(event) => {
      if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
      event.preventDefault();
      if (ready && !sending && text.trim()) event.currentTarget.form?.requestSubmit();
    }} maxLength={1000} rows={1} placeholder={ready ? "输入消息…" : "正在连接…"} disabled={!ready || sending} /><button disabled={!ready || sending || !text.trim()}>{sending ? "…" : "发送"}</button></form>
  </main>;
}
