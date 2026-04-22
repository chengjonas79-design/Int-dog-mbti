// shared primitives — v2 clinical/report style

// ============= page shell =============
function Page({ note, children, className = '', style = {} }) {
  return (
    <div className={`sbti page ${className}`} style={style}>
      {note && <div className="page-note">{note}</div>}
      {children}
    </div>
  );
}

// ============= report header =============
function ReportHeader({ subtitle }) {
  return (
    <div style={{ padding:'10px 22px 10px', borderBottom:'1px solid var(--ink)' }}>
      <div style={{
        display:'flex', justifyContent:'space-between', alignItems:'baseline',
        fontFamily:'DM Mono, monospace', fontSize:9, fontWeight:500, color:'var(--ink)',
        letterSpacing:'.14em', gap: 8,
      }}>
        <span style={{ whiteSpace:'nowrap' }}>SBTI<span style={{opacity:.55}}>·</span>DIAGNOSTIC REPORT</span>
        <span style={{opacity:.65, whiteSpace:'nowrap'}}>No.031 / 2026</span>
      </div>
      {subtitle && (
        <div className="f-mono" style={{
          fontSize: 8.5, fontWeight: 400, marginTop: 4, color:'var(--ink-2)',
          letterSpacing:'.08em', lineHeight: 1.4,
        }}>
          {subtitle}
        </div>
      )}
    </div>
  );
}

// ============= status bar (minimal, ink) =============
function StatusBar({ time = '9:41' }) {
  return (
    <div style={{
      height: 34, padding: '0 18px',
      display:'flex', alignItems:'center', justifyContent:'space-between',
      fontFamily:'DM Mono, monospace', fontWeight: 500, fontSize: 11, color:'var(--ink)',
    }}>
      <span>{time}</span>
      <div style={{ display:'flex', alignItems:'center', gap: 5, opacity:.85 }}>
        <svg width="15" height="9" viewBox="0 0 15 9" fill="currentColor">
          <rect x="0" y="5" width="2.5" height="3.5" rx=".4"/>
          <rect x="4" y="3.5" width="2.5" height="5" rx=".4"/>
          <rect x="8" y="1.8" width="2.5" height="6.7" rx=".4"/>
          <rect x="12" y="0" width="2.5" height="8.5" rx=".4"/>
        </svg>
        <svg width="14" height="10" viewBox="0 0 15 11" fill="currentColor">
          <path d="M7.5 0C4.5 0 1.9 1.1 0 2.9l1.4 1.5C2.9 2.9 5 2 7.5 2s4.6.9 6.1 2.4L15 2.9C13.1 1.1 10.5 0 7.5 0zm0 3.5C5.5 3.5 3.7 4.3 2.4 5.5l1.4 1.4c.9-.9 2.2-1.4 3.7-1.4s2.8.5 3.7 1.4L12.6 5.5c-1.3-1.2-3.1-2-5.1-2zm0 3.5c-1 0-1.9.4-2.5 1L7.5 10l2.5-2c-.6-.6-1.5-1-2.5-1z"/>
        </svg>
        <svg width="22" height="10" viewBox="0 0 25 11" fill="none" stroke="currentColor" strokeWidth="1">
          <rect x=".5" y=".5" width="21" height="10" rx="2"/>
          <rect x="2" y="2" width="18" height="7" rx="1" fill="currentColor"/>
          <rect x="22" y="3.5" width="1.5" height="4" rx=".5" fill="currentColor"/>
        </svg>
      </div>
    </div>
  );
}

// ============= section marker =============
function SectionMark({ num, cnTitle, enTitle }) {
  return (
    <div className="sec-mark" style={{ marginBottom: 10 }}>
      <span className="glyph">§</span>
      <span className="num">{String(num).padStart(2,'0')}</span>
      <span className="f-serif-m" style={{ fontSize: 14, color:'var(--ink)' }}>{cnTitle}</span>
      {enTitle && <span className="en">/ {enTitle}</span>}
      <span className="line"/>
    </div>
  );
}

// ============= seal (round, 1px) =============
function Seal({ children, size = 64, color = 'green', rotate = 0, style = {} }) {
  const cls = color === 'ink' ? 'seal' : color === 'ochre' ? 'seal seal-ochre' : 'seal seal-green';
  return (
    <div className={cls} style={{
      width: size, height: size, transform:`rotate(${rotate}deg)`, ...style,
    }}>{children}</div>
  );
}

// ============= bar (horizontal, 1px outline with muted green fill) =============
function Bar({ value = 50, width = 88, color = 'var(--green)' }) {
  return (
    <div style={{
      width, height: 6, border: '1px solid var(--line-2)', position: 'relative', background:'#fff',
    }}>
      <div style={{
        position:'absolute', top:0, bottom:0, left:0, width: `${Math.max(0,Math.min(100,value))}%`,
        background: color,
      }}/>
    </div>
  );
}

// ============= ascii bar for terminal =============
function asciiBar(v, len = 10) {
  const n = Math.round((v/100) * len);
  return '█'.repeat(n) + '░'.repeat(len - n);
}

Object.assign(window, {
  Page, ReportHeader, StatusBar, SectionMark, Seal, Bar, asciiBar,
});
