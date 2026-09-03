export function escapeMarketEmailHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
}

export function renderMarketEmail({
  title,
  subtitle,
  contentHtml,
  action,
  footer,
}: {
  title: string;
  subtitle?: string;
  contentHtml: string;
  action?: { href: string; label: string };
  footer: string;
}) {
  const safeTitle = escapeMarketEmailHtml(title);
  const safeSubtitle = subtitle ? escapeMarketEmailHtml(subtitle) : "";
  const safeFooter = escapeMarketEmailHtml(footer);
  const actionHtml = action
    ? `<p style="margin:24px 0 4px"><a href="${escapeMarketEmailHtml(action.href)}" style="display:inline-block;padding:13px 24px;border-radius:10px;background:#2c7055;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700">${escapeMarketEmailHtml(action.label)}</a></p>`
    : "";
  return `<!doctype html><html><body style="margin:0;padding:0;background:#f5f7f2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Noto Sans SC',Arial,sans-serif;color:#17352d"><div style="display:none;max-height:0;overflow:hidden;opacity:0">${safeSubtitle || safeTitle}</div><div style="max-width:560px;margin:0 auto;padding:24px 16px"><div style="padding:0 4px 16px;display:flex;align-items:center"><span style="display:inline-block;width:36px;height:36px;border-radius:12px 12px 12px 4px;background:#17352d;color:#ffffff;font-family:serif;font-size:19px;line-height:36px;text-align:center">东</span><span style="display:inline-block;margin-left:10px;vertical-align:top"><b style="display:block;font-size:16px;letter-spacing:.08em">东北集市</b><small style="display:block;margin-top:2px;color:#829089;font-size:10px;letter-spacing:.1em">TOHOKU STUDENT MARKET</small></span></div><div style="padding:32px;border:1px solid #dfe6dc;border-radius:18px;background:#ffffff;box-shadow:0 8px 28px rgba(31,65,52,.06)"><div style="margin-bottom:9px;color:#d47f4b;font-size:10px;font-weight:800;letter-spacing:.16em">MARKET NOTICE</div><h1 style="margin:0 0 8px;font-family:Georgia,'Songti SC',serif;font-size:23px;line-height:1.35;color:#17352d">${safeTitle}</h1>${safeSubtitle ? `<p style="margin:0 0 24px;color:#7a8981;font-size:13px;line-height:1.7">${safeSubtitle}</p>` : ""}<div style="color:#4f6259;font-size:14px;line-height:1.8">${contentHtml}</div>${actionHtml}</div><div style="padding:16px 12px 0;color:#98a19c;text-align:center;font-size:11px;line-height:1.7">${safeFooter}<br>東北地区中国留学生学友会 · 东北集市</div></div></body></html>`;
}
