import { useState, useRef, useEffect, useCallback } from "react";

const CATEGORIES = [
  {
    id: "events", label: "活动", color: "#c0392b", bg: "#fdf0ee", ready: true,
    items: [
      { name: "浏览活动", desc: "查看近期学友会活动 · 在线报名", tag: "入口", tagColor: "#c0392b", url: "https://events.tohokucssa.org", icon: "览" },
      { name: "活动申请", desc: "提交活动策划 · 在线审核", url: "https://events.tohokucssa.org/apply", icon: "申" },
      { name: "我的活动", desc: "报名记录 · 签到码 · 个人信息", url: "https://events.tohokucssa.org/my", icon: "我" },
    ],
  },
  {
    id: "translate", label: "翻译", color: "#2a5298", bg: "#edf2fb",
    items: [
      { name: "义务翻译", desc: "中日互译 · 完全免费 · 志愿者提供", tag: "免费", tagColor: "#2a7a50", icon: "译" },
      { name: "证件翻译", desc: "在留卡·住民票·成绩单等常用翻译", icon: "证" },
      { name: "生活翻译", desc: "市役所·银行·医院等场景协助", icon: "助" },
    ],
  },
  {
    id: "car", label: "租车", color: "#a07018", bg: "#fdf7ea",
    items: [
      { name: "学友会用车", desc: "活动用车 · 免费借用 · 提前预约", tag: "免费", tagColor: "#2a7a50", icon: "车" },
      { name: "使用须知", desc: "驾照要求 · 保险说明 · 还车规则", icon: "须" },
      { name: "预约方式", desc: "联系学友会预约 · 先到先得", icon: "约" },
    ],
  },
  {
    id: "whisper", label: "悄悄话", color: "#6840a0", bg: "#f4effa", ready: true,
    items: [
      { name: "匿名求助", desc: "AI优先解答 · 复杂/紧急问题自动转人工", icon: "助", kind: "ai-help", tag: "AI", tagColor: "#6840a0" },
      { name: "匿名树洞", desc: "匿名发布 · 畅所欲言 · 倾诉心声", icon: "洞" },
      { name: "情感交流", desc: "留学生活 · 学业压力 · 人际关系", icon: "心" },
      { name: "吐槽大会", desc: "生活吐槽 · 轻松一刻 · 引起共鸣", icon: "吐" },
    ],
  },
  {
    id: "emergency", label: "应急中心", color: "#c0392b", bg: "#fdf0ee",
    items: [
      { name: "紧急联系", desc: "报警110 · 火灾119 · 救护车119", tag: "重要", tagColor: "#c0392b", icon: "急" },
      { name: "中国驻日大使馆", desc: "领事保护 +81-3-3403-3065", icon: "馆" },
      { name: "地震·台风速报", desc: "实时灾害预警 · 避难所查询", url: "https://emg.yahoo.co.jp/", icon: "灾" },
      { name: "心理援助", desc: "留学生心理咨询热线 · 匿名免费", icon: "理" },
    ],
  },
  {
    id: "market", label: "二手", color: "#2a7a50", bg: "#eef8f2",
    items: [
      { name: "闲置转让", desc: "家具·家电·教材·生活用品", icon: "转" },
      { name: "免费赠送", desc: "毕业季 · 搬家清 · 直接拿走", tag: "免费", tagColor: "#2a7a50", icon: "赠" },
      { name: "求购信息", desc: "发布你想要的 · 同学间互助", icon: "求" },
    ],
  },
  {
    id: "moving", label: "搬家", color: "#5a4530", bg: "#f5f0e8",
    items: [
      { name: "搬家互助", desc: "学友会志愿者协助搬家", tag: "免费", tagColor: "#2a7a50", icon: "搬" },
      { name: "搬家经验", desc: "退房流程 · 粗大垃圾 · 注意事项", icon: "验" },
      { name: "常用搬家公司", desc: "サカイ·アート·赤帽 价格参考", icon: "社" },
    ],
  },
  {
    id: "bus", label: "校园Bus", color: "#2a5298", bg: "#edf2fb",
    items: [
      { name: "时刻表", desc: "校园巴士发车时间 · 实时更新", tag: "常用", tagColor: "#2a5298", icon: "时" },
      { name: "路线图", desc: "各校区间巴士路线 · 站点地图", icon: "路" },
      { name: "假期运行", desc: "长假·考试期间特别时刻表", icon: "假" },
    ],
  },
  {
    id: "equip", label: "设备租用", color: "#1e1c18", bg: "#f0efed",
    items: [
      { name: "BBQ 套装", desc: "烤架·炭火·桌椅 · 户外活动必备", icon: "烤" },
      { name: "投影仪", desc: "演示·观影·活动用 · 免费借用", icon: "投" },
      { name: "帐篷·户外", desc: "露营装备 · 野餐垫 · 保温箱", icon: "帐" },
      { name: "借用须知", desc: "提前预约 · 爱护设备 · 按时归还", icon: "须" },
    ],
  },
  {
    id: "food", label: "美食地图", color: "#c05020", bg: "#fdf0ea",
    items: [
      { name: "中华料理", desc: "仙台周边中国餐厅推荐", icon: "中" },
      { name: "日本料理", desc: "拉面·寿司·居酒屋·定食", icon: "日" },
      { name: "学生食堂", desc: "各校区食堂菜单 · 营业时间", icon: "堂" },
      { name: "食べログ", desc: "餐厅评分 · 预约 · 3.0+可信赖", url: "https://tabelog.com/", icon: "食" },
    ],
  },
  {
    id: "life", label: "生活必备", color: "#2a7a50", bg: "#eef8f2",
    items: [
      { name: "LINE", desc: "国民社交 · 校内沟通 · LINE Pay", tag: "必装", tagColor: "#00b900", url: "https://line.me/", icon: "L" },
      { name: "PayPay", desc: "扫码支付 · 水电缴费 · 返现活动", url: "https://paypay.ne.jp/", icon: "¥" },
      { name: "メルカリ", desc: "日本版闲鱼 · 二手买卖 · 便利店寄件", url: "https://jp.mercari.com/", icon: "メ" },
      { name: "SUUMO", desc: "日本最大房源平台 · 租房/买房", url: "https://suumo.jp/", icon: "S" },
    ],
  },
  {
    id: "study", label: "学术研究", color: "#1e1e1e", bg: "#f0efed",
    items: [
      { name: "CiNii Research", desc: "日本国内论文 · 学位论文 · 研究数据", tag: "NII", tagColor: "#2a5298", url: "https://cir.nii.ac.jp/ja", icon: "論" },
      { name: "Google Scholar", desc: "全球学术文献检索 · 引用追踪", url: "https://scholar.google.co.jp/", icon: "G" },
      { name: "J-STAGE", desc: "日本科技振兴机构 · 期刊全文", url: "https://www.jstage.jst.go.jp/", icon: "J" },
    ],
  },
  {
    id: "transport", label: "交通防灾", color: "#c0392b", bg: "#fdf0ee",
    items: [
      { name: "NAVITIME", desc: "换乘路线 · 路费计算 · 500+铁路", url: "https://www.navitime.co.jp/", icon: "N" },
      { name: "Yahoo! 防災速報", desc: "地震·台风·暴雨实时预警", tag: "必装", tagColor: "#c0392b", url: "https://emg.yahoo.co.jp/", icon: "Y!" },
      { name: "JR東日本", desc: "新干线 · Suica · 运行情报", url: "https://www.jreast.co.jp/", icon: "JR" },
    ],
  },
];

const TOTAL_PAGES = 1 + CATEGORIES.length;
const TAB_LABELS = ["首页", ...CATEGORIES.map((c) => c.label)];

const QUICK_ENTRIES = [
  { name: "浏览活动", desc: "查看近期活动 · 在线报名", icon: "览", color: "#c0392b", url: "https://events.tohokucssa.org" },
  { name: "活动申请", desc: "提交活动策划 · 在线审核", icon: "申", color: "#c0392b", url: "https://events.tohokucssa.org/apply" },
  { name: "我的活动", desc: "报名记录 · 签到码", icon: "我", color: "#c0392b", url: "https://events.tohokucssa.org/my" },
];

function AnonymousHelpCard({ item, cat }) {
  const [expanded, setExpanded] = useState(false);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("idle"); // idle | loading | done | error
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!message.trim() || status === "loading") return;
    setStatus("loading");
    setError("");
    try {
      const res = await fetch("/api/help", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      if (!res.ok) throw new Error(`请求失败 (${res.status})`);
      const data = await res.json();
      setResult(data);
      setStatus("done");
    } catch (err) {
      setError(err.message || "提交失败，请稍后重试");
      setStatus("error");
    }
  };

  const reset = () => {
    setExpanded(false);
    setMessage("");
    setStatus("idle");
    setResult(null);
    setError("");
  };

  if (!expanded) {
    return (
      <div className="board-item" style={AH.row} onClick={() => setExpanded(true)}>
        <div style={{ ...AH.icon, background: cat.bg, color: cat.color }}>{item.icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={AH.name}>{item.name}</div>
          <div style={AH.desc}>{item.desc}</div>
        </div>
        {item.tag && (
          <span style={{ ...AH.tag, color: item.tagColor, background: `${item.tagColor}12` }}>{item.tag}</span>
        )}
        <span style={AH.arrow}>›</span>
      </div>
    );
  }

  return (
    <div style={AH.panel}>
      <div style={AH.panelHead}>
        <div style={{ ...AH.icon, background: cat.bg, color: cat.color }}>{item.icon}</div>
        <div style={AH.name}>{item.name}</div>
        <button style={AH.closeBtn} onClick={reset}>×</button>
      </div>

      {status !== "done" && (
        <>
          <textarea
            style={AH.textarea}
            placeholder="匿名描述你遇到的问题，AI会先尝试解答，无法处理的会自动转交工作人员..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            disabled={status === "loading"}
            maxLength={1000}
          />
          <button
            style={{ ...AH.submitBtn, opacity: status === "loading" || !message.trim() ? 0.5 : 1 }}
            onClick={submit}
            disabled={status === "loading" || !message.trim()}
          >
            {status === "loading" ? "AI正在处理…" : "匿名提交"}
          </button>
          {error && <div style={AH.error}>{error}</div>}
        </>
      )}

      {status === "done" && result && (
        <div style={AH.result}>
          {result.action === "answer" ? (
            <>
              <div style={AH.resultTag}>AI 已解答</div>
              <div style={AH.resultText}>{result.answer}</div>
            </>
          ) : (
            <>
              <div style={{ ...AH.resultTag, color: "#c0392b", background: "#c0392b12" }}>
                {result.urgency === "urgent" ? "已紧急转人工" : "已转交工作人员"}
              </div>
              <div style={AH.resultText}>
                你的问题已经匿名转交给学友会工作人员，我们会尽快跟进，请留意后续联系。
              </div>
            </>
          )}
          <button style={AH.againBtn} onClick={reset}>再次提交</button>
        </div>
      )}
    </div>
  );
}

function HomePage({ onNav }) {
  return (
    <div className="board-home" style={H.wrap}>
      <div style={H.banner}>
        <div style={H.bannerDecor} />
        <div style={H.bannerName}>東北地区中国学友会</div>
        <div style={H.bannerSub}>服务东北地区中国留学生</div>
        <div style={H.bannerTags}>
          <span style={H.bannerTag}>学术交流</span>
          <span style={H.bannerTag}>文化活动</span>
          <span style={H.bannerTag}>生活互助</span>
        </div>
      </div>

      <div style={H.sectionHead}>
        <span style={H.sectionTitle}>全部服务</span>
        <span style={H.sectionCount}>{CATEGORIES.length}个</span>
      </div>

      <div className="board-home-grid" style={H.grid}>
        {CATEGORIES.map((c, i) => (
          <div key={c.id} style={H.tile} onClick={() => onNav(i + 1)}>
            <div style={{ ...H.tileIcon, background: c.color, ...(c.ready ? {} : { opacity: 0.4 }) }}>
              {c.label.charAt(0)}
            </div>
            <div style={H.tileLabel}>{c.label}</div>
            {!c.ready && <div style={H.tileSoon}>敬请期待</div>}
          </div>
        ))}
      </div>

      <div style={H.sectionHead}>
        <span style={H.sectionTitle}>快速入口</span>
      </div>
      <div className="board-home-quick" style={H.quickScroll}>
        {QUICK_ENTRIES.map((q, i) => (
          <a key={i} href={q.url} target="_blank" rel="noopener noreferrer" style={H.quickCard}>
            <div style={H.quickHead}>
              <div style={{ ...H.quickIcon, background: q.color, color: "#fff" }}>{q.icon}</div>
              <div style={H.quickTitle}>{q.name}</div>
            </div>
            <div style={H.quickDesc}>{q.desc}</div>
          </a>
        ))}
      </div>

      <div style={H.contact}>
        <a href="https://events.tohokucssa.org" style={H.contactLink}>活动平台</a>
        <span style={H.contactDot}>·</span>
        <a href="mailto:tohokucssa@gmail.com" style={H.contactLink}>联系我们</a>
      </div>
    </div>
  );
}

export default function Board() {
  const [active, setActive] = useState(0);
  const [touchStart, setTouchStart] = useState(null);
  const [touchDelta, setTouchDelta] = useState(0);
  const [dragging, setDragging] = useState(false);
  const tabScrollRef = useRef(null);

  const go = useCallback((dir) => {
    setActive((p) => Math.max(0, Math.min(TOTAL_PAGES - 1, p + dir)));
  }, []);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [go]);

  useEffect(() => {
    if (!tabScrollRef.current) return;
    const btn = tabScrollRef.current.children[active];
    if (btn) btn.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [active]);

  const onTouchStart = (e) => {
    setTouchStart(e.touches[0].clientX);
    setDragging(true);
  };
  const onTouchMove = (e) => {
    if (touchStart === null) return;
    setTouchDelta(e.touches[0].clientX - touchStart);
  };
  const onTouchEnd = () => {
    if (Math.abs(touchDelta) > 50) go(touchDelta < 0 ? 1 : -1);
    setTouchStart(null);
    setTouchDelta(0);
    setDragging(false);
  };

  const isHome = active === 0;
  const cat = isHome ? null : CATEGORIES[active - 1];
  const activeColor = isHome ? "#1e1c18" : cat.color;

  return (
    <div className="board-screen" style={S.screen}>
      {/* Header */}
      <div className="board-header" style={S.header}>
        <div style={S.headerLeft}>
          <span style={S.headerDot} />
          <span className="board-header-title" style={S.headerTitle}>留学生掲示板</span>
        </div>
        <span className="board-page-num" style={S.pageNum}>{active + 1}/{TOTAL_PAGES}</span>
      </div>

      {/* Tab bar - detail pages only */}
      {!isHome && (
        <div style={S.tabs}>
          <div ref={tabScrollRef} className="board-tabs tabs-scroll" style={S.tabScroll}>
            {TAB_LABELS.map((label, i) => {
              const tabColor = i === 0 ? "#1e1c18" : CATEGORIES[i - 1].color;
              return (
                <button
                  key={i}
                  className="board-tab"
                  onClick={() => setActive(i)}
                  style={{
                    ...S.tab,
                    ...(i === active ? { background: tabColor, color: "#fff", borderColor: tabColor } : {}),
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Main panel */}
      <div
        style={S.panelWrap}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div
          style={{
            ...S.panel,
            transform: dragging ? `translateX(${touchDelta * 0.4}px)` : "translateX(0)",
            transition: dragging ? "none" : "transform 0.25s ease",
          }}
        >
          {isHome ? (
            <HomePage onNav={setActive} />
          ) : (
            <>
              <div className="board-cat-header" style={{ ...S.catHeader, background: cat.bg }}>
                <div className="board-cat-icon" style={{
                  width: 38, height: 38, borderRadius: 10,
                  background: cat.color, color: "#fff",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 16, fontWeight: 800, flexShrink: 0,
                }}>
                  {cat.label.charAt(0)}
                </div>
                <div>
                  <div className="board-cat-title" style={{ fontSize: 16, fontWeight: 800, color: cat.color, letterSpacing: -0.5 }}>{cat.label}</div>
                  <div className="board-cat-sub" style={{ fontSize: 10, color: "#999", marginTop: 1 }}>
                    {cat.items.length} 个条目
                  </div>
                </div>
              </div>

              {cat.ready ? (
                <div className="board-items" style={S.itemList}>
                  {cat.items.map((item, i) => {
                    if (item.kind === "ai-help") {
                      return <AnonymousHelpCard key={i} item={item} cat={cat} />;
                    }
                    const Tag = item.url ? "a" : "div";
                    const linkProps = item.url
                      ? { href: item.url, target: "_blank", rel: "noopener noreferrer" }
                      : {};
                    return (
                      <Tag
                        key={i}
                        className="board-item"
                        {...linkProps}
                        style={S.item}
                        onMouseEnter={(e) => { e.currentTarget.style.background = "#f8f8f8"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = "#fff"; }}
                      >
                        <div className="board-item-icon" style={{ ...S.itemIcon, background: cat.bg, color: cat.color }}>
                          {item.icon}
                        </div>
                        <div style={S.itemBody}>
                          <div className="board-item-name" style={S.itemName}>{item.name}</div>
                          <div className="board-item-desc" style={S.itemDesc}>{item.desc}</div>
                        </div>
                        {item.tag && (
                          <span className="board-item-tag" style={{
                            ...S.itemTag,
                            color: item.tagColor || cat.color,
                            background: `${item.tagColor || cat.color}12`,
                          }}>
                            {item.tag}
                          </span>
                        )}
                        {item.url && <span style={S.arrow}>›</span>}
                      </Tag>
                    );
                  })}
                </div>
              ) : (
                <div style={S.comingSoon}>
                  <div style={{ ...S.comingSoonIcon, background: cat.bg, color: cat.color }}>{cat.label.charAt(0)}</div>
                  <div style={S.comingSoonTitle}>即将上线</div>
                  <div style={S.comingSoonText}>该功能正在开发中，敬请期待</div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Nav arrows + dots */}
      <div className="board-footer" style={S.footer}>
        <button
          className="board-nav-btn"
          style={{ ...S.navBtn, opacity: active === 0 ? 0.25 : 1 }}
          onClick={() => go(-1)}
          disabled={active === 0}
        >‹</button>
        <div style={S.dots}>
          {TAB_LABELS.map((_, i) => (
            <div
              key={i}
              className="board-dot"
              onClick={() => setActive(i)}
              style={{
                width: i === active ? 16 : 5, height: 5, borderRadius: 3,
                background: i === active ? activeColor : "#ddd",
                transition: "all 0.25s ease", cursor: "pointer",
              }}
            />
          ))}
        </div>
        <button
          className="board-nav-btn"
          style={{ ...S.navBtn, opacity: active === TOTAL_PAGES - 1 ? 0.25 : 1 }}
          onClick={() => go(1)}
          disabled={active === TOTAL_PAGES - 1}
        >›</button>
      </div>

    </div>
  );
}

const AH = {
  row: {
    display: "flex", alignItems: "center", gap: 12,
    padding: "10px 12px", borderRadius: 12,
    background: "#fff", border: "0.5px solid #eee",
    cursor: "pointer",
  },
  panel: {
    padding: "12px", borderRadius: 12,
    background: "#fff", border: "0.5px solid #eee",
    display: "flex", flexDirection: "column", gap: 8,
  },
  panelHead: { display: "flex", alignItems: "center", gap: 10 },
  icon: {
    width: 38, height: 38, borderRadius: 10,
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 14, fontWeight: 700, flexShrink: 0,
  },
  name: { fontSize: 13, fontWeight: 650, lineHeight: 1.3, color: "#1e1c18", flex: 1 },
  desc: {
    fontSize: 11, color: "#999", lineHeight: 1.4, marginTop: 1,
    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
  },
  tag: {
    fontSize: 10, fontWeight: 650, padding: "2px 8px", borderRadius: 4,
    flexShrink: 0, whiteSpace: "nowrap",
  },
  arrow: { fontSize: 16, color: "#ccc", flexShrink: 0, marginLeft: 2 },
  closeBtn: {
    width: 24, height: 24, borderRadius: 12, border: "none",
    background: "#f0efed", color: "#999", fontSize: 15, lineHeight: 1,
    cursor: "pointer", flexShrink: 0,
  },
  textarea: {
    width: "100%", minHeight: 80, borderRadius: 10,
    border: "0.5px solid #ddd", padding: "8px 10px",
    fontSize: 12.5, fontFamily: "inherit", resize: "vertical",
    boxSizing: "border-box",
  },
  submitBtn: {
    padding: "8px 12px", borderRadius: 10, border: "none",
    background: "#6840a0", color: "#fff", fontSize: 12.5, fontWeight: 650,
    cursor: "pointer", fontFamily: "inherit",
  },
  error: { fontSize: 11, color: "#c0392b" },
  result: { display: "flex", flexDirection: "column", gap: 8 },
  resultTag: {
    alignSelf: "flex-start", fontSize: 10, fontWeight: 650,
    padding: "2px 8px", borderRadius: 4,
    color: "#6840a0", background: "#6840a012",
  },
  resultText: { fontSize: 12.5, color: "#333", lineHeight: 1.6 },
  againBtn: {
    alignSelf: "flex-start", padding: "6px 12px", borderRadius: 10,
    border: "1.5px solid #e0e0e0", background: "transparent",
    fontSize: 11.5, fontWeight: 600, color: "#666", cursor: "pointer",
    fontFamily: "inherit",
  },
};

const H = {
  wrap: {
    flex: 1, overflowY: "auto", display: "flex", flexDirection: "column",
  },
  banner: {
    margin: "8px 12px", padding: "14px 16px",
    background: "linear-gradient(135deg, #1e1c18 0%, #3a3630 100%)",
    borderRadius: 12, color: "#fff", position: "relative", overflow: "hidden",
  },
  bannerDecor: {
    position: "absolute", right: -20, top: -20,
    width: 80, height: 80, borderRadius: 40,
    background: "rgba(255,255,255,0.06)",
  },
  bannerName: {
    fontSize: 16, fontWeight: 800, letterSpacing: -0.5, position: "relative",
  },
  bannerSub: {
    fontSize: 10, opacity: 0.6, marginTop: 3, position: "relative",
  },
  bannerTags: {
    display: "flex", gap: 4, marginTop: 8, position: "relative",
  },
  bannerTag: {
    fontSize: 9, padding: "2px 8px", borderRadius: 10,
    background: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.85)",
  },
  sectionHead: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "8px 14px 4px",
  },
  sectionTitle: {
    fontSize: 12, fontWeight: 700, color: "#1e1c18",
  },
  sectionCount: {
    fontSize: 10, color: "#999",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 0, padding: "0 8px 4px",
  },
  tile: {
    display: "flex", flexDirection: "column", alignItems: "center",
    padding: "8px 2px", cursor: "pointer",
  },
  tileIcon: {
    width: 50, height: 50, borderRadius: 14,
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 18, fontWeight: 800, color: "#fff",
    boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
  },
  tileLabel: {
    fontSize: 10, fontWeight: 500, color: "#333",
    marginTop: 5, letterSpacing: -0.2,
  },
  tileSoon: {
    fontSize: 8, color: "#bbb", marginTop: 1,
  },
  quickScroll: {
    display: "flex", gap: 8, padding: "4px 12px 10px",
    overflowX: "auto", WebkitOverflowScrolling: "touch",
    scrollbarWidth: "none", msOverflowStyle: "none",
  },
  quickCard: {
    flexShrink: 0, width: 140, padding: "10px 12px",
    background: "#fff", borderRadius: 10,
    border: "0.5px solid #eee", textDecoration: "none", color: "inherit",
  },
  quickHead: {
    display: "flex", alignItems: "center", gap: 6,
  },
  quickIcon: {
    width: 24, height: 24, borderRadius: 6,
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 10, fontWeight: 700,
  },
  quickTitle: {
    fontSize: 11, fontWeight: 600, color: "#1e1c18",
  },
  quickDesc: {
    fontSize: 9, color: "#999", marginTop: 4, lineHeight: 1.3,
  },
  contact: {
    textAlign: "center", padding: "12px 0",
    fontSize: 10, color: "#999", marginTop: "auto",
  },
  contactLink: { color: "#666", textDecoration: "none" },
  contactDot: { color: "#ddd", margin: "0 4px" },
};

const S = {
  screen: {
    width: "100%", maxWidth: 520, margin: "0 auto",
    display: "flex", flexDirection: "column",
    background: "#f7f7f7", overflow: "hidden", flex: 1,
  },
  header: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "8px 14px", background: "#fff",
    borderBottom: "0.5px solid #eee", flexShrink: 0,
  },
  headerLeft: { display: "flex", alignItems: "center", gap: 8 },
  headerDot: {
    width: 8, height: 8, borderRadius: 4, background: "#1e1c18",
  },
  headerTitle: { fontSize: 14, fontWeight: 700, letterSpacing: -0.3, color: "#1e1c18" },
  pageNum: { fontSize: 11, color: "#999", fontWeight: 500 },
  tabs: {
    background: "#fff", borderBottom: "0.5px solid #eee",
    flexShrink: 0, overflowX: "auto", WebkitOverflowScrolling: "touch",
    scrollbarWidth: "none", msOverflowStyle: "none",
  },
  tabScroll: {
    display: "flex", gap: 6, padding: "6px 14px 8px", minWidth: "min-content",
  },
  tab: {
    display: "flex", alignItems: "center", padding: "4px 12px",
    borderRadius: 20, border: "1.5px solid #e0e0e0",
    background: "transparent", color: "#666", cursor: "pointer",
    whiteSpace: "nowrap", transition: "all 0.2s",
    fontFamily: "inherit", fontSize: 11.5, fontWeight: 600,
  },
  panelWrap: { flex: 1, overflow: "hidden", position: "relative", display: "flex", flexDirection: "column" },
  panel: { flex: 1, display: "flex", flexDirection: "column", minHeight: 0 },
  catHeader: {
    display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", flexShrink: 0,
  },
  itemList: {
    flex: 1, overflowY: "auto", padding: "4px 12px 12px",
    display: "flex", flexDirection: "column", gap: 6,
  },
  item: {
    display: "flex", alignItems: "center", gap: 12,
    padding: "10px 12px", borderRadius: 12,
    background: "#fff", border: "0.5px solid #eee",
    textDecoration: "none", color: "inherit",
    transition: "background 0.12s", cursor: "pointer",
  },
  itemIcon: {
    width: 38, height: 38, borderRadius: 10,
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 14, fontWeight: 700, flexShrink: 0,
  },
  itemBody: { flex: 1, minWidth: 0 },
  itemName: { fontSize: 13, fontWeight: 650, lineHeight: 1.3, color: "#1e1c18" },
  itemDesc: {
    fontSize: 11, color: "#999", lineHeight: 1.4, marginTop: 1,
    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
  },
  itemTag: {
    fontSize: 10, fontWeight: 650, padding: "2px 8px", borderRadius: 4,
    flexShrink: 0, whiteSpace: "nowrap",
  },
  arrow: { fontSize: 16, color: "#ccc", flexShrink: 0, marginLeft: 2 },
  footer: {
    display: "flex", alignItems: "center", justifyContent: "center",
    gap: 12, padding: "8px 14px",
    background: "#fff", borderTop: "0.5px solid #eee", flexShrink: 0,
  },
  navBtn: {
    width: 28, height: 28, borderRadius: 14,
    border: "1.5px solid #e0e0e0", background: "transparent",
    fontSize: 15, color: "#666", cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontFamily: "inherit", transition: "opacity 0.2s",
  },
  dots: { display: "flex", alignItems: "center", gap: 3 },
  comingSoon: {
    flex: 1, display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center", gap: 8,
    color: "#ccc",
  },
  comingSoonIcon: {
    width: 56, height: 56, borderRadius: 14,
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 22, fontWeight: 800, opacity: 0.4,
  },
  comingSoonTitle: {
    fontSize: 16, fontWeight: 700, color: "#bbb",
  },
  comingSoonText: {
    fontSize: 11, color: "#ccc",
  },
};
