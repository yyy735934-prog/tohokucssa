import Link from "next/link";
import type { ReactNode } from "react";

type PolicyShellProps = {
  eyebrow: string;
  title: string;
  summary: string;
  children: ReactNode;
};

export default function PolicyShell({ eyebrow, title, summary, children }: PolicyShellProps) {
  return (
    <main className="policy-page">
      <nav className="policy-topbar" aria-label="政策页面导航">
        <Link className="brand" href="/">
          <span className="brand-mark">东</span>
          <span><b>东北集市</b><small>学友会二手平台</small></span>
        </Link>
        <Link className="policy-back" href="/">返回集市 <span>→</span></Link>
      </nav>
      <header className="policy-hero">
        <span className="policy-eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{summary}</p>
        <small>版本日期：2026 年 9 月 3 日</small>
      </header>
      <div className="policy-layout">
        <aside aria-label="政策页面目录">
          <b>平台规则</b>
          <Link href="/policies/terms">使用规范</Link>
          <Link href="/policies/report">举报与建议</Link>
          <Link href="/policies/privacy">隐私说明</Link>
        </aside>
        <article className="policy-card">{children}</article>
      </div>
    </main>
  );
}
