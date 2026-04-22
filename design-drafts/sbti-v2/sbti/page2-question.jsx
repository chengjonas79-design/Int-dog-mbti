// Page 2 · Question — clinical diagnostic item
function Page2Question() {
  const [sel, setSel] = React.useState('B');

  const options = [
    { k:'A', t:'已读 + 秒退，假装没看见',         tag:'EVASION',     cn:'回避型' },
    { k:'B', t:'立刻装机器人：「[自动回复]」',     tag:'PERFORMANCE', cn:'表演型' },
    { k:'C', t:'把手机扔进马桶，人间蒸发',         tag:'NUCLEAR',     cn:'核反应型' },
    { k:'D', t:'秒回「收到老板」，心里已经把他挂了', tag:'DUAL-FACE',   cn:'双面型' },
  ];

  return (
    <Page note="Page 2 · Question" className="page-844">
      <StatusBar/>
      <ReportHeader subtitle="SECTION 01 / 职场求生 · CHAPTER 02 决策风格 × 情感稳定性" />

      {/* progress */}
      <div style={{ padding:'14px 22px 0' }}>
        <div style={{
          display:'flex', justifyContent:'space-between', alignItems:'baseline',
          fontFamily:'DM Mono, monospace', fontSize:10, fontWeight:500, color:'var(--ink-2)', letterSpacing:'.12em',
        }}>
          <span>§ 01 · PROGRESS</span>
          <span style={{ color:'var(--ink)', fontWeight:700 }}>12 / 31</span>
        </div>
        <div style={{
          marginTop: 6, height: 2, background:'var(--line)', position:'relative',
        }}>
          <div style={{ position:'absolute', inset:0, width: '38.7%', background:'var(--green)' }}/>
        </div>
      </div>

      {/* question head */}
      <div style={{ padding:'22px 22px 0', display:'flex', gap: 12, alignItems:'flex-start' }}>
        <Seal size={44} color="ink" rotate={0}>
          <span className="f-mono" style={{ fontSize: 7, letterSpacing:'.1em', opacity:.75 }}>ITEM</span>
          <span className="f-serif-m" style={{ fontSize: 15, lineHeight:1 }}>Q.12</span>
        </Seal>
        <div style={{ flex:1 }}>
          <div className="f-mono" style={{ fontSize: 9, fontWeight:500, color:'var(--ink-2)', letterSpacing:'.14em' }}>
            CATEGORY · 职场求生 / WORKPLACE
          </div>
          <div className="f-play" style={{ fontStyle:'italic', fontSize: 11, color:'var(--ink-2)', marginTop: 2 }}>
            Fig. A — Decision pattern under authority pressure
          </div>
        </div>
      </div>

      {/* question text */}
      <div style={{ padding:'16px 22px 0', position:'relative' }}>
        <div className="f-serif" style={{
          fontSize: 22, lineHeight: 1.35, color:'var(--ink)', letterSpacing:'-.005em',
        }}>
          老板周五下午 6 点<br/>
          在群里 @ 你，<br/>
          你的第一反应是？
        </div>
      </div>

      {/* options */}
      <div style={{ padding:'22px 22px 0', display:'flex', flexDirection:'column', gap: 8 }}>
        {options.map((o) => {
          const active = sel === o.k;
          return (
            <div key={o.k} onClick={() => setSel(o.k)}
              style={{
                position:'relative',
                border:`1px solid ${active ? 'var(--green)' : 'var(--line-2)'}`,
                background:'#fff',
                padding:'12px 14px 12px 18px',
                display:'flex', alignItems:'center', gap: 12,
                cursor:'pointer',
                transition:'border-color .15s',
              }}>
              {/* left accent bar when active */}
              {active && <div style={{
                position:'absolute', left:0, top:0, bottom:0, width: 3, background:'var(--green)',
              }}/>}
              {/* letter */}
              <div style={{
                flexShrink: 0, width: 22, height: 22,
                border:`1px solid ${active ? 'var(--green)' : 'var(--ink-2)'}`,
                color: active ? 'var(--green)' : 'var(--ink)',
                borderRadius:'50%',
                display:'flex', alignItems:'center', justifyContent:'center',
                fontFamily:'Playfair Display, serif', fontSize: 12, fontWeight:700, fontStyle:'italic',
              }}>{o.k}</div>
              <div style={{ flex:1 }}>
                <div className="f-sans" style={{ fontSize: 13.5, fontWeight: 500, lineHeight:1.35, color:'var(--ink)' }}>
                  {o.t}
                </div>
                <div style={{ marginTop: 4, display:'flex', alignItems:'center', gap:6 }}>
                  <span className="f-mono" style={{ fontSize:9, fontWeight:500, color:'var(--ink-2)', letterSpacing:'.12em' }}>
                    [{o.tag}]
                  </span>
                  <span className="f-play" style={{ fontStyle:'italic', fontSize: 10, color:'var(--ink-2)' }}>
                    {o.cn}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* meta note */}
      <div style={{ padding:'18px 22px 0' }}>
        <div className="hr-thin"/>
        <div style={{
          padding:'8px 0', display:'flex', justifyContent:'space-between',
          fontFamily:'DM Mono, monospace', fontSize:9, color:'var(--ink-2)', letterSpacing:'.1em',
        }}>
          <span>ITEM WEIGHT · 0.08</span>
          <span>§ 01 · 12 / 31</span>
        </div>
      </div>

      {/* submit */}
      <div style={{ position:'absolute', left: 22, right: 22, bottom: 30 }}>
        <button className="btn-clinical" style={{ width:'100%', fontSize: 14 }}>
          提交本题 · SUBMIT
        </button>
        <div className="f-mono" style={{
          textAlign:'center', fontSize: 9, color:'var(--ink-2)', marginTop: 8, letterSpacing:'.14em', fontWeight:500,
        }}>
          ANSWER LOCKED AFTER SUBMISSION · 提交后不可修改
        </div>
      </div>
    </Page>
  );
}

window.Page2Question = Page2Question;
