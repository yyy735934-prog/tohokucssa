"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

type FavoriteItem = {
  id: string; title: string; price: number; place: string; time: string;
  icon: string; tone: string; note: string; imageUrl?: string | null;
};

export default function FavoritesClient({ initialItems }: { initialItems: FavoriteItem[] }) {
  const [items, setItems] = useState(initialItems);
  const [message, setMessage] = useState("");
  const remove = async (id: string) => {
    const response = await fetch(`/api/favorites?listingId=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!response.ok) return setMessage("移除失败，请稍后再试。");
    setItems((current) => current.filter((item) => item.id !== id));
    setMessage("已从收藏中移除。");
  };
  return (
    <section className="favorites-workspace">
      <div className="favorites-heading">
        <div><span>SAVED ITEMS</span><h1>我的收藏</h1><p>把感兴趣的闲置集中在这里，方便之后比较和联系。</p></div>
        <Link href="/#market">继续逛集市 →</Link>
      </div>
      {items.length ? <div className="favorite-grid">{items.map((item) => (
        <article key={item.id}>
          <div className={`favorite-photo ${item.tone}`}>
            {item.imageUrl ? <Image src={item.imageUrl} alt={item.title} fill sizes="(max-width: 620px) 100vw, 33vw" unoptimized /> : <span>{item.icon}</span>}
          </div>
          <div><span>⌖ {item.place} · {item.time}</span><h2>{item.title}</h2><strong>{item.price === 0 ? "免费" : `¥${item.price.toLocaleString()}`}</strong><p>{item.note}</p><button onClick={() => remove(item.id)}>♡ 移除收藏</button></div>
        </article>
      ))}</div> : <div className="favorites-empty"><span>♡</span><h2>收藏夹还是空的</h2><p>遇到心仪的闲置，点一下爱心就会保存在这里。</p><Link href="/#market">去逛逛</Link></div>}
      {message && <div className="portal-toast">{message}</div>}
    </section>
  );
}
