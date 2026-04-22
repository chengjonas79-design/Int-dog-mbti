// Tweaks panel — paper tone (cream / white)
function TweaksPanel({ tone, setTone }) {
  const [active, setActive] = React.useState(false);

  React.useEffect(() => {
    const onMsg = (e) => {
      if (!e.data || typeof e.data !== 'object') return;
      if (e.data.type === '__activate_edit_mode')   setActive(true);
      if (e.data.type === '__deactivate_edit_mode') setActive(false);
    };
    window.addEventListener('message', onMsg);
    window.parent.postMessage({ type: '__edit_mode_available' }, '*');
    return () => window.removeEventListener('message', onMsg);
  }, []);

  if (!active) return null;

  const pick = (key) => {
    setTone(key);
    window.parent.postMessage({ type: '__edit_mode_set_keys', edits: { paperTone: key } }, '*');
  };

  const opts = [
    { k:'cream', label:'暖米 #FAF7F0' },
    { k:'white', label:'纯白 #FFFFFF' },
    { k:'linen', label:'亚麻 #F3EDE1' },
  ];

  return (
    <div style={{
      position:'fixed', bottom: 20, right: 20, zIndex: 500,
      background:'#fff', border:'1px solid var(--ink)',
      padding: 14, width: 220, fontFamily:'Noto Sans SC, sans-serif',
      boxShadow:'0 4px 16px rgba(0,0,0,.08)',
    }}>
      <div style={{
        display:'flex', alignItems:'center', gap: 6, marginBottom: 8,
        borderBottom:'1px solid var(--line)', paddingBottom: 6,
      }}>
        <div className="f-mono" style={{ fontSize: 9, fontWeight: 700, letterSpacing:'.14em', color:'var(--ink)' }}>
          § TWEAKS
        </div>
        <span className="f-play" style={{ fontStyle:'italic', fontSize: 10, color:'var(--ink-2)' }}>v2.0</span>
      </div>
      <div className="f-serif-m" style={{ fontSize: 12, marginBottom: 8 }}>纸张色调</div>
      <div style={{ display:'flex', flexDirection:'column', gap: 5 }}>
        {opts.map(o => (
          <button key={o.k} onClick={() => pick(o.k)} style={{
            border:`1px solid ${tone === o.k ? 'var(--green)':'var(--line-2)'}`,
            background: tone === o.k ? 'var(--green)' : '#fff',
            color: tone === o.k ? '#fff' : 'var(--ink)',
            fontFamily:'DM Mono, monospace', fontSize: 10, fontWeight: 500,
            padding:'6px 10px', textAlign:'left', cursor:'pointer',
            letterSpacing:'.08em',
          }}>
            {o.label}
          </button>
        ))}
      </div>
      <div className="f-mono" style={{ fontSize: 9, color:'var(--ink-2)', marginTop: 10, letterSpacing:'.06em' }}>
        // 切换画布底色
      </div>
    </div>
  );
}

window.TweaksPanel = TweaksPanel;
