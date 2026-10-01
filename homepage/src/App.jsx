import Board from './Board.jsx'
import './App.css'

export default function App() {
  return (
    <>
      <header className="hero-wrap" style={hero.wrap}>
        <div style={hero.inner}>
          <div className="hero-badge" style={hero.badge}>東北学友会</div>
          <h1 className="hero-title" style={hero.title}>東北地区中国学友会</h1>
          <p className="hero-sub" style={hero.sub}>服务东北地区中国留学生 · 学术交流 · 文化活动 · 生活互助</p>
        </div>
      </header>

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Board />
      </main>

      <footer className="site-footer" style={footer.wrap}>
        <div style={footer.inner}>
          <div className="site-footer-brand" style={footer.brand}>東北地区中国学友会</div>
          <div className="site-footer-links" style={footer.links}>
            <a href="https://events.tohokucssa.org" style={footer.link}>活动平台</a>
            <span style={footer.dot}>·</span>
            <a href="mailto:tohokucssa@gmail.com" style={footer.link}>联系我们</a>
          </div>
          <div className="site-footer-copy" style={footer.copy}>© 2025 東北地区中国学友会 (東北CSSA)</div>
        </div>
      </footer>
    </>
  )
}

const hero = {
  wrap: {
    background: '#fffefa',
    borderBottom: '1px solid #eae7e0',
    padding: '16px 20px 12px',
    textAlign: 'center',
    flexShrink: 0,
  },
  inner: { maxWidth: 600, margin: '0 auto' },
  badge: {
    display: 'inline-block', fontSize: 11, fontWeight: 700,
    padding: '3px 12px', borderRadius: 20,
    background: '#1e1c18', color: '#fffefa', letterSpacing: 1, marginBottom: 8,
  },
  title: {
    fontSize: 'clamp(20px, 5vw, 28px)', fontWeight: 900,
    letterSpacing: -0.5, color: '#1e1c18', lineHeight: 1.2, margin: 0,
  },
  sub: { fontSize: 12, color: '#8a8480', marginTop: 6, lineHeight: 1.5 },
}

const footer = {
  wrap: {
    background: '#1e1c18', color: '#fffefa',
    padding: '16px 20px', textAlign: 'center', flexShrink: 0,
  },
  inner: { maxWidth: 480, margin: '0 auto' },
  brand: { fontSize: 13, fontWeight: 700, letterSpacing: -0.3 },
  links: {
    marginTop: 8, fontSize: 12,
    display: 'flex', justifyContent: 'center', gap: 8,
  },
  link: { color: '#b0a89e', textDecoration: 'none' },
  dot: { color: '#5a5550' },
  copy: { marginTop: 8, fontSize: 10, color: '#5a5550' },
}
