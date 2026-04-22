// Page 5 · Loading — clinical white, terminal-ish
function Page5Loading() {
  const [dots, setDots] = React.useState(1);
  React.useEffect(()=>{
    const t = setInterval(()=>setDots(d => (d%3)+1), 450);
    return ()=>clearInterval(t);
  },[]);

  const lines = [
    { t:'> initializing sbti.engine v2.3',             c:'var(--ink-2)' },
    { t:'> loading savage_database.json',               c:'var(--ink-2)' },
    { t:'> subject_id: #A031',                           c:'var(--ink)'  },
    { t:'> parsing 31 response vectors...',             c:'var(--ink-2)' },
    { t:'> matching pathology against 24 subtypes',     c:'var(--ink-2)' },
    { t:'> detected traits: [CTRL, DEL, TAB]',          c:'var(--ochre)' },
    { t:'> calibrating 暴论量表 v2.3',                  c:'var(--ink-2)' },
    { t:'> cross-ref 朋友圈人设 vs 真实人格...',         c:'var(--ink-2)' },
    { t:'> [WARN] 人格碎片过多，正在拼合',               c:'var(--ochre)' },
    { t:'> 生成诊断书中...',                            c:'var(--green)' },
    { t:'> [OK] 报告已无法撤回',                         c:'var(--green)' },
  ];

  return (
    <Page note="Page 5 · Loading" className="page-844" style={{ background:'#fff' }}>
      <StatusBar/>
      <ReportHeader subtitle="ANALYZING · 请勿关闭页面 · DO NOT CLOSE"/>

      {/* tiny icon + main line */}
      <div style={{ padding:'56px 32px 0', textAlign:'center' }}>
        {/* a rotating hand-drawn scanner */}
        <div style={{ display:'inline-block', position:'relative' }}>
          <div style={{
            width: 74, height: 74, border:'1px solid var(--green)', borderRadius:'50%',
            display:'flex', alignItems:'center', justifyContent:'center',
            color:'var(--green)',
          }}>
            <span style={{ fontFamily:'Playfair Display, serif', fontStyle:'italic', fontSize: 28, fontWeight: 500 }}>
              Rx.
            </span>
          </div>
          <div style={{
            position:'absolute', inset:-8, borderRadius:'50%',
            border:'1px dashed var(--line-2)',
            animation:'rot 6s linear infinite',
          }}/>
          <style>{`@keyframes rot { to { transform: rotate(360deg); } }`}</style>
        </div>

        <div className="f-serif" style={{
          fontSize: 26, lineHeight: 1.25, marginTop: 26, color:'var(--ink)',
        }}>
          正在分析您的<br/>
          <span style={{ color:'var(--green)' }}>人格样本{'.'.repeat(dots)}</span>
        </div>

        <div className="f-play" style={{
          fontStyle:'italic', fontSize: 12, color:'var(--ink-2)', marginTop: 10,
        }}>
          Matching pathology against 24 subtypes
        </div>
      </div>

      {/* fake terminal */}
      <div style={{
        margin:'28px 22px 0',
        background:'#fff', border:'1px solid var(--line-2)',
      }}>
        <div style={{
          borderBottom:'1px solid var(--line)', padding:'6px 10px',
          display:'flex', alignItems:'center', gap: 6,
          background:'#FAF7F0',
        }}>
          <div style={{ width: 7, height: 7, borderRadius:'50%', background:'var(--red)' }}/>
          <div style={{ width: 7, height: 7, borderRadius:'50%', background:'var(--ochre)' }}/>
          <div style={{ width: 7, height: 7, borderRadius:'50%', background:'var(--green)' }}/>
          <div className="f-mono" style={{ fontSize: 8.5, color:'var(--ink-2)', letterSpacing:'.12em', marginLeft: 6 }}>
            sbti@diagnostic:~/analyze
          </div>
        </div>
        <div style={{ padding:'10px 12px', minHeight: 200 }}>
          {lines.map((l,i)=>(
            <div key={i} className="f-mono" style={{
              fontSize: 10, fontWeight: 500, lineHeight: 1.7, color: l.c, letterSpacing:'.01em',
            }}>
              {l.t}
            </div>
          ))}
          <div className="f-mono" style={{ color:'var(--green)', fontSize: 11, fontWeight:700, marginTop: 2 }}>
            <span style={{
              display:'inline-block', width:7, height:11, background:'var(--green)',
              verticalAlign:'middle', animation:'blink 1s step-end infinite',
            }}/>
          </div>
          <style>{`@keyframes blink { 50% { opacity: 0; } }`}</style>
        </div>
      </div>

      {/* progress (thin muted green) */}
      <div style={{ padding:'22px 22px 0' }}>
        <div style={{
          display:'flex', justifyContent:'space-between', alignItems:'baseline',
          fontFamily:'DM Mono, monospace', fontSize: 10, color:'var(--ink-2)', letterSpacing:'.12em',
        }}>
          <span>ANALYZING · 扒皮中</span>
          <span style={{ color:'var(--ink)', fontWeight:700 }}>72%</span>
        </div>
        <div style={{ marginTop: 6, height: 2, background:'var(--line)', position:'relative' }}>
          <div style={{ position:'absolute', inset:0, width:'72%', background:'var(--green)' }}/>
        </div>
        <div className="f-mono" style={{
          marginTop: 14, textAlign:'center', fontSize: 9, color:'var(--ochre)', letterSpacing:'.14em',
          animation:'pulse 1.2s ease-in-out infinite',
        }}>
          ⎯ 预计 3 秒后出具报告 · REPORT IN 3S ⎯
        </div>
        <style>{`@keyframes pulse { 50% { opacity: .3; } }`}</style>
      </div>

      {/* footer */}
      <div style={{
        position:'absolute', bottom: 18, left: 22, right: 22,
        display:'flex', justifyContent:'space-between', borderTop:'1px solid var(--line)',
        paddingTop: 8,
        fontFamily:'DM Mono, monospace', fontSize: 9, color:'var(--ink-2)', letterSpacing:'.12em',
      }}>
        <span>SBTI · DIAGNOSTIC ENGINE</span>
        <span>v2.3 · no escape</span>
      </div>
    </Page>
  );
}

window.Page5Loading = Page5Loading;
