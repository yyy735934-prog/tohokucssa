"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ensureCometChatSession } from "../../lib/cometchat-client";

type ConversationItem = {
  id: string;
  providerGroupId: string;
  counterpart: string;
  listing: { id: string; title: string; price: number; status: string; icon: string; imageUrl: string | null };
  createdAt: string;
  lastText?: string;
  lastAt?: number;
  unread?: number;
};

function messageText(message: any) {
  return typeof message?.getText === "function" ? message.getText() : "新消息";
}

export default function MessagesClient() {
  const [items, setItems] = useState<ConversationItem[]>([]);
  const [state, setState] = useState("正在载入会话…");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/chat/conversations", { cache: "no-store" });
        const data = await response.json() as { conversations?: ConversationItem[]; error?: string };
        if (!response.ok) throw new Error(data.error || "载入会话失败。");
        const base = data.conversations ?? [];
        if (!base.length) { if (!cancelled) { setItems([]); setState(""); } return; }
        const { CometChat } = await ensureCometChatSession();
        const providerRows = await new CometChat.ConversationsRequestBuilder().setConversationType("group").setLimit(50).build().fetchNext();
        const byGroup = new Map(providerRows.map((row: any) => [row.getConversationWith()?.getGuid?.(), row]));
        const merged = base.map((item) => {
          const provider: any = byGroup.get(item.providerGroupId);
          const last = provider?.getLastMessage?.();
          return { ...item, lastText: last ? messageText(last) : "开始讨论交接时间和地点", lastAt: last?.getSentAt?.() ?? 0, unread: provider?.getUnreadMessageCount?.() ?? 0 };
        }).sort((a, b) => (b.lastAt || new Date(b.createdAt).getTime() / 1000) - (a.lastAt || new Date(a.createdAt).getTime() / 1000));
        if (!cancelled) { setItems(merged); setState(""); }
      } catch (error) {
        if (!cancelled) setState(error instanceof Error ? error.message : "聊天服务暂时不可用。");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return <section className="messages-shell">
    <header><span>匿名交易消息</span><h1>消息</h1><p>每段会话只关联一件商品；双方不会看到真实姓名、邮箱或第三方账号信息。</p></header>
    {state && <p className="messages-state" role="status">{state}</p>}
    {!state && !items.length && <div className="messages-empty"><b>还没有交易会话</b><p>在商品详情中点击“联系卖家”，即可开始匿名聊天。</p><Link href="/">去逛集市</Link></div>}
    <div className="conversation-list">{items.map((item) => <Link key={item.id} href={`/messages/${item.id}`}>
      <div className="conversation-photo">{item.listing.imageUrl ? <img src={item.listing.imageUrl} alt="" /> : <span>{item.listing.icon}</span>}</div>
      <div><div className="conversation-heading"><b>{item.counterpart}</b><small>{item.lastAt ? new Date(item.lastAt * 1000).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : ""}</small></div><strong>{item.listing.title}</strong><p>{item.lastText}</p><em>{item.listing.status === "active" ? "在售" : item.listing.status === "sold" ? "已售出" : "已下架"}</em></div>
      {(item.unread ?? 0) > 0 && <i className="conversation-unread">{Math.min(item.unread ?? 0, 99)}</i>}
    </Link>)}</div>
  </section>;
}
