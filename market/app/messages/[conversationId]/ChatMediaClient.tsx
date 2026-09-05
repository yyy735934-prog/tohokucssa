"use client";

/* eslint-disable @typescript-eslint/no-explicit-any, @next/next/no-img-element, react-hooks/exhaustive-deps */

import Link from "next/link";
import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import { describeCometChatError, ensureCometChatSession } from "../../../lib/cometchat-client";

type ChatInfo = { id: string; providerGroupId: string; counterpart: string; listing: { id: string; title: string; price: number; status: string; icon: string; imageUrl: string | null } };
type MessageKind = "text" | "image" | "audio";
type UiMessage = { id: number | string; kind: MessageKind; text?: string; mediaUrl?: string; duration?: number; sentAt: number; mine: boolean };
type RetryMedia = { file: File; kind: "image" | "audio"; duration?: number };

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_IMAGES_PER_PICK = 4;
const MAX_RECORDING_SECONDS = 60;

function toUiMessage(message: any, myUid: string): UiMessage | null {
  const kind = message?.getType?.() as MessageKind;
  if (!(["text", "image", "audio"] as string[]).includes(kind)) return null;
  const base = { id: message.getId?.() ?? crypto.randomUUID(), sentAt: message.getSentAt?.() ?? Math.floor(Date.now() / 1000), mine: message.getSender?.()?.getUid?.() === myUid };
  if (kind === "text") return typeof message?.getText === "function" ? { ...base, kind, text: message.getText() } : null;
  const attachment = message?.getAttachments?.()?.[0] ?? message?.getAttachment?.();
  const mediaUrl = attachment?.getUrl?.() ?? message?.getURL?.();
  if (!mediaUrl) return null;
  const duration = Number((message?.getMetadata?.() as { durationSeconds?: unknown } | undefined)?.durationSeconds);
  return { ...base, kind, mediaUrl, duration: Number.isFinite(duration) ? duration : undefined };
}

function acknowledgeConversation(conversationId: string, lastReadAt: number) {
  void fetch(`/api/chat/conversations/${encodeURIComponent(conversationId)}/read`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ lastReadAt }) }).catch(() => undefined);
}

function formatDuration(seconds: number) {
  const value = Math.max(0, Math.min(MAX_RECORDING_SECONDS, Math.round(seconds)));
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")}`;
}

function preferredRecordingMimeType() {
  if (typeof MediaRecorder === "undefined") return "";
  return ["audio/mp4", "audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/webm"].find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

function extensionForMime(mimeType: string) {
  if (mimeType.includes("mp4")) return "m4a";
  if (mimeType.includes("ogg")) return "ogg";
  return "webm";
}

export default function ChatMediaClient({ conversationId }: { conversationId: string }) {
  const [info, setInfo] = useState<ChatInfo | null>(null);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendingLabel, setSendingLabel] = useState("");
  const [retryMedia, setRetryMedia] = useState<RetryMedia | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordedVoice, setRecordedVoice] = useState<(RetryMedia & { url: string }) | null>(null);
  const cometRef = useRef<any>(null);
  const sessionRef = useRef<{ uid: string } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingStartedAtRef = useRef(0);
  const keepRecordingRef = useRef(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const releaseMicrophone = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setRecording(false);
  };

  const stopRecording = (keep: boolean) => {
    keepRecordingRef.current = keep;
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
    else releaseMicrophone();
  };

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, recordedVoice]);
  useEffect(() => {
    const stopWhenHidden = () => { if (document.visibilityState === "hidden" && recorderRef.current?.state === "recording") stopRecording(true); };
    document.addEventListener("visibilitychange", stopWhenHidden);
    return () => {
      document.removeEventListener("visibilitychange", stopWhenHidden);
      keepRecordingRef.current = false;
      const recorder = recorderRef.current;
      if (recorder) recorder.onstop = null;
      if (recorder?.state === "recording") recorder.stop();
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);
  useEffect(() => () => { if (recordedVoice?.url) URL.revokeObjectURL(recordedVoice.url); }, [recordedVoice]);

  useEffect(() => {
    let disposed = false;
    const listenerId = `tohoku-chat-${conversationId}`;
    void (async () => {
      try {
        const response = await fetch(`/api/chat/conversations/${encodeURIComponent(conversationId)}`, { cache: "no-store" });
        const detail = await response.json() as ChatInfo & { error?: string };
        if (!response.ok) throw new Error(detail.error || "会话不存在。");
        const { CometChat, session } = await ensureCometChatSession();
        const history = await new CometChat.MessagesRequestBuilder().setGUID(detail.providerGroupId).setTypes(["text", "image", "audio"]).setLimit(50).build().fetchPrevious();
        if (disposed) return;
        cometRef.current = CometChat; sessionRef.current = session; setInfo(detail);
        setMessages(history.map((message: any) => toUiMessage(message, session.uid)).filter(Boolean) as UiMessage[]);
        const receive = (message: any) => {
          if (message.getReceiverId?.() !== detail.providerGroupId) return;
          const ui = toUiMessage(message, session.uid);
          if (ui) setMessages((current) => current.some((item) => item.id === ui.id) ? current : [...current, ui]);
          CometChat.markAsRead(message);
          acknowledgeConversation(conversationId, message.getSentAt?.() ?? Math.floor(Date.now() / 1000));
        };
        CometChat.addMessageListener(listenerId, new CometChat.MessageListener({ onTextMessageReceived: receive, onMediaMessageReceived: receive }));
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

  const verifyMembership = async () => {
    const response = await fetch(`/api/chat/conversations/${encodeURIComponent(conversationId)}`, { cache: "no-store" });
    const detail = await response.json() as ChatInfo & { error?: string };
    if (!response.ok || !info || detail.providerGroupId !== info.providerGroupId) throw new Error(detail.error || "会话权限已失效，请刷新后重试。");
  };

  const sendMedia = async (media: RetryMedia) => {
    if (!info || !ready || !cometRef.current || sending) return;
    setSending(true); setSendingLabel(media.kind === "image" ? "图片发送中…" : "语音发送中…"); setError(""); setRetryMedia(null);
    try {
      await verifyMembership();
      const CometChat = cometRef.current;
      const message = new CometChat.MediaMessage(info.providerGroupId, media.file, media.kind === "image" ? CometChat.MESSAGE_TYPE.IMAGE : CometChat.MESSAGE_TYPE.AUDIO, CometChat.RECEIVER_TYPE.GROUP);
      if (media.duration) message.setMetadata({ durationSeconds: Math.round(media.duration) });
      const sent = await CometChat.sendMediaMessage(message);
      const ui = toUiMessage(sent, sessionRef.current!.uid);
      if (ui) setMessages((current) => current.some((item) => item.id === ui.id) ? current : [...current, ui]);
      if (media.kind === "audio") setRecordedVoice(null);
    } catch (reason) {
      setRetryMedia(media); setError(`${media.kind === "image" ? "图片" : "语音"}发送失败，请检查网络后重试。`);
      console.error("CometChat media send failed", describeCometChatError(reason));
    } finally { setSending(false); setSendingLabel(""); }
  };

  const selectImages = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length) return;
    if (files.length > MAX_IMAGES_PER_PICK) { setError("每次最多发送 4 张图片。"); return; }
    if (files.some((file) => !IMAGE_TYPES.has(file.type))) { setError("仅支持 JPG、PNG 或 WebP 图片；当前图片格式暂不支持。"); return; }
    if (files.some((file) => file.size > MAX_IMAGE_BYTES)) { setError("图片过大，请选择小于 10 MB 的图片。"); return; }
    for (const file of files) await sendMedia({ file, kind: "image" });
  };

  const startRecording = async () => {
    if (!ready || sending || recording) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") { setError("此浏览器暂不支持语音录制，仍可发送文字和图片。"); return; }
    try {
      setError("");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = preferredRecordingMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      streamRef.current = stream; recorderRef.current = recorder; chunksRef.current = []; keepRecordingRef.current = true;
      recorder.ondataavailable = (event) => { if (event.data.size) chunksRef.current.push(event.data); };
      recorder.onerror = () => { setError("录音失败，请检查麦克风后重试。"); stopRecording(false); };
      recorder.onstop = () => {
        const duration = Math.min(MAX_RECORDING_SECONDS, (Date.now() - recordingStartedAtRef.current) / 1000);
        const keep = keepRecordingRef.current;
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || mimeType || "audio/webm" });
        releaseMicrophone(); recorderRef.current = null; chunksRef.current = [];
        if (!keep) return;
        if (duration < 1 || !blob.size) { setError("语音至少录制 1 秒。"); return; }
        const file = new File([blob], `voice-message.${extensionForMime(blob.type)}`, { type: blob.type });
        setRecordedVoice((current) => { if (current?.url) URL.revokeObjectURL(current.url); return { file, kind: "audio", duration, url: URL.createObjectURL(blob) }; });
      };
      recordingStartedAtRef.current = Date.now(); setRecordingSeconds(0); setRecordedVoice(null); setRecording(true); recorder.start(250);
      timerRef.current = setInterval(() => {
        const elapsed = (Date.now() - recordingStartedAtRef.current) / 1000;
        setRecordingSeconds(elapsed);
        if (elapsed >= MAX_RECORDING_SECONDS && recorder.state === "recording") { setError("单条语音最长 60 秒。"); stopRecording(true); }
      }, 250);
    } catch { releaseMicrophone(); setError("无法使用麦克风，请检查浏览器权限。"); }
  };

  const send = async (event: FormEvent) => {
    event.preventDefault();
    const value = text.trim();
    if (!value || !info || !ready || !cometRef.current || sending) return;
    setSending(true); setSendingLabel("发送中…"); setError("");
    try {
      const CometChat = cometRef.current;
      const sent = await CometChat.sendMessage(new CometChat.TextMessage(info.providerGroupId, value.slice(0, 1000), CometChat.RECEIVER_TYPE.GROUP));
      const ui = toUiMessage(sent, sessionRef.current!.uid);
      if (ui) setMessages((current) => current.some((item) => item.id === ui.id) ? current : [...current, ui]);
      setText("");
    } catch { setError("发送失败，请检查网络后重试。"); } finally { setSending(false); setSendingLabel(""); }
  };

  return <main className="chat-page">
    <header className="chat-topbar"><Link href="/messages" aria-label="返回消息"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14.5 6-6 6 6 6" /></svg></Link><div><b>{info?.counterpart ?? "匿名交易聊天"}</b><small>站内匿名 · 身份信息不公开</small></div></header>
    {info && <Link className="chat-listing" href={`/?listing=${encodeURIComponent(info.listing.id)}`}><div>{info.listing.imageUrl ? <img src={info.listing.imageUrl} alt="" /> : info.listing.icon}</div><span><b>{info.listing.title}</b><small>{info.listing.price === 0 ? "免费赠送" : `¥${info.listing.price.toLocaleString()}`} · {info.listing.status === "active" ? "在售" : info.listing.status === "sold" ? "已售出" : "已下架"}</small></span><i>查看商品 ›</i></Link>}
    <section className="chat-messages" aria-live="polite"><p className="chat-privacy">请勿发送证件、银行卡等敏感信息。语音可能被熟人辨认，建议在公共场所交易。</p>{messages.map((message) => <article key={message.id} className={`${message.mine ? "mine" : "theirs"} ${message.kind}`}><small>{message.mine ? "我" : info?.counterpart}</small>{message.kind === "text" && <p>{message.text}</p>}{message.kind === "image" && <button className="chat-image" type="button" onClick={() => setPreviewImage(message.mediaUrl!)} aria-label="查看图片大图"><img src={message.mediaUrl} alt="聊天图片" loading="lazy" /></button>}{message.kind === "audio" && <div className="chat-audio"><audio controls preload="metadata" src={message.mediaUrl} aria-label="播放语音消息" />{message.duration ? <span>{formatDuration(message.duration)}</span> : null}</div>}<time>{new Date(message.sentAt * 1000).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}</time></article>)}<div ref={bottomRef} /></section>
    {sendingLabel && <p className="chat-upload-state" role="status">{sendingLabel}</p>}
    {error && <p className="chat-error" role="alert">{error}{retryMedia && <button type="button" onClick={() => void sendMedia(retryMedia)} disabled={sending}>重试</button>}</p>}
    {recording || recordedVoice ? <section className="chat-recorder" aria-live="polite">{recording ? <><strong><i /> {formatDuration(recordingSeconds)}</strong><span><button type="button" onClick={() => stopRecording(false)}>取消</button><button type="button" onClick={() => stopRecording(true)}>完成</button></span></> : recordedVoice ? <><audio controls preload="metadata" src={recordedVoice.url} aria-label="试听语音" /><span><button type="button" onClick={() => setRecordedVoice(null)}>取消</button><button type="button" disabled={sending} onClick={() => void sendMedia(recordedVoice)}>发送语音</button></span></> : null}</section> : null}
    <form className="chat-composer" onSubmit={send}><input ref={imageInputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(event) => void selectImages(event)} /><button className="chat-tool" type="button" onClick={() => imageInputRef.current?.click()} disabled={!ready || sending || recording} aria-label="发送图片"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5z"/><circle cx="9" cy="9" r="1.5"/><path d="m5 17 4.5-4.5 3 3 2-2L20 19"/></svg></button><textarea value={text} onChange={(event) => setText(event.target.value)} onKeyDown={(event) => {
      if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
      event.preventDefault();
      if (ready && !sending && text.trim()) event.currentTarget.form?.requestSubmit();
    }} maxLength={1000} rows={1} placeholder={ready ? "输入消息…" : "正在连接…"} disabled={!ready || sending || recording} /><button className="chat-tool" type="button" onClick={() => void startRecording()} disabled={!ready || sending || recording} aria-label="录制语音"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M9 21h6"/></svg></button><button className="chat-send" disabled={!ready || sending || recording || !text.trim()}>{sending ? "…" : "发送"}</button></form>
    {previewImage && <div className="chat-lightbox" role="presentation" onClick={() => setPreviewImage(null)}><button type="button" onClick={() => setPreviewImage(null)} aria-label="关闭图片预览">×</button><img src={previewImage} alt="聊天图片大图" onClick={(event) => event.stopPropagation()} /></div>}
  </main>;
}
