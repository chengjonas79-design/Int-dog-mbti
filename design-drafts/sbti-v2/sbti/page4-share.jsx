// Page 4 · Share Card — certificate, figure is the anchor (~55%)
const SHARE_QUOTES = {
  CTRL: { cn:'拿捏者', match: 92, category:'死者 DEAD',
    quote:'被试对象具备极强的情绪拿捏能力，建议远离。' },
  DEL:  { cn:'删号者', match: 87, category:'死者 DEAD',
    quote:'被试对象已主动删除自我，存续状态存疑。' },
  TAB:  { cn:'摸鱼者', match: 95, category:'吗喽 MALO',
    quote:'被试对象正在任意切换人格，无法锁定真实状态。' },
};

function Page4Share({ type: typeKey, onChangeType }) {
  const D = SHARE_QUOTES[typeKey] || SHARE_QUOTES.CTRL;

  return (
    <Page note="Page 4 · Share Card" className="page-844">
      {/* Type switcher */}
      <div style={{
        position:'absolute', top: 12, right: 12, display:'flex', gap: 4, zIndex: 20,
      }}>
        {Object.keys(SHARE_QUOTES).map(k => (
          <button key={k} onClick={()=>onChangeType(k)} style={{
            border:`1px solid ${typeKey===k?'var(--green)':'var(--line-2)'}`,
            padding:'2px 7px',
            background: typeKey === k ? 'var(--green)' : '#fff',
            color: typeKey === k ? '#fff' : 'var(--ink)',
            fontFamily:'DM Mono, monospace', fontSize: 9, fontWeight:700,
            cursor:'pointer', letterSpacing:'.1em',
          }}>{k}</button>
        ))}
      </div>

      {/* Certificate frame (3:4) */}
      <div style={{
        position:'absolute', top: 52, left: 20, right: 20, height: 770,
        background:'#fff', border:'1px solid var(--ink)',
        padding: 6,
      }}>
        {/* inner border (double-rule feel) */}
        <div style={{
          width:'100%', height:'100%', border:'1px solid var(--line-2)',
          position:'relative', overflow:'hidden', padding:'18px 20px',
        }}>
          {/* header */}
          <div style={{
            display:'flex', justifyContent:'space-between', alignItems:'baseline',
            borderBottom:'1px solid var(--ink)', paddingBottom: 6,
            fontFamily:'DM Mono, monospace', fontSize: 8.5, fontWeight:500, letterSpacing:'.16em', color:'var(--ink)',
          }}>
            <span>SBTI · DIAGNOSTIC CERTIFICATE</span>
            <span>No.{typeKey==='CTRL'?'A031':typeKey==='DEL'?'A087':'A195'}</span>
          </div>

          {/* tiny classification line */}
          <div style={{
            display:'flex', justifyContent:'space-between', padding:'8px 0',
            fontFamily:'DM Mono, monospace', fontSize: 9, color:'var(--ink-2)', letterSpacing:'.12em',
          }}>
            <span>CLASSIFICATION · {D.category}</span>
            <span className="f-play" style={{ fontStyle:'italic' }}>Est. 2026</span>
          </div>

          {/* Playfair cert line */}
          <div style={{ textAlign:'center', marginTop: 2 }}>
            <div className="f-play" style={{
              fontStyle:'italic', fontSize: 14, color:'var(--ink-2)',
            }}>
              This is to certify that the subject's true nature is
            </div>
            <div className="f-sans" style={{ fontSize: 11, color:'var(--ink-2)', marginTop: 2, fontWeight:500 }}>
              兹证明 · 被试对象的真面目是
            </div>
          </div>

          {/* FIGURE — star of the page */}
          <div style={{
            marginTop: 14, padding: '8px',
            display:'flex', justifyContent:'center', alignItems:'center',
            position:'relative',
            background:'#FAF7F0',
            border:'1px solid var(--line)',
          }}>
            {/* corner tick marks */}
            {['tl','tr','bl','br'].map(p => (
              <div key={p} style={{
                position:'absolute', width: 8, height: 8, border:'1px solid var(--ink)',
                ...(p==='tl' ? { top:-1, left:-1, borderRight:'none', borderBottom:'none' } :
                    p==='tr' ? { top:-1, right:-1, borderLeft:'none', borderBottom:'none' } :
                    p==='bl' ? { bottom:-1, left:-1, borderRight:'none', borderTop:'none' } :
                               { bottom:-1, right:-1, borderLeft:'none', borderTop:'none' }),
              }}/>
            ))}
            <Figure type={typeKey} size={270}/>
          </div>

          {/* type labels */}
          <div style={{ textAlign:'center', marginTop: 16 }}>
            <div className="f-serif" style={{ fontSize: 44, color:'var(--green)', lineHeight:1, letterSpacing:'-.01em' }}>
              {D.cn}
            </div>
            <div className="f-play" style={{
              fontSize: 34, color:'var(--green)', lineHeight:1, marginTop: 6, letterSpacing:'.02em', fontWeight: 500,
            }}>
              {typeKey}
            </div>
          </div>

          {/* match + id row */}
          <div style={{
            display:'flex', alignItems:'center', justifyContent:'space-between',
            marginTop: 16, paddingTop: 10, borderTop:'1px solid var(--line)',
          }}>
            <div>
              <div className="f-mono" style={{ fontSize: 8.5, color:'var(--ink-2)', letterSpacing:'.14em' }}>
                SUBJECT ID
              </div>
              <div className="f-serif-m" style={{ fontSize: 13, color:'var(--ink)', whiteSpace:'nowrap' }}>
                #{typeKey==='CTRL'?'A031':typeKey==='DEL'?'A087':'A195'}
              </div>
            </div>
            <Seal size={62} color="green" rotate={-8}>
              <span className="f-mono" style={{ fontSize: 7.5, letterSpacing:'.14em' }}>MATCH</span>
              <span className="f-serif" style={{ fontSize: 20, lineHeight:1, margin:'2px 0' }}>{D.match}%</span>
              <span className="f-mono" style={{ fontSize: 7, letterSpacing:'.1em', opacity:.85 }}>无力挽回</span>
            </Seal>
            <div style={{ textAlign:'right' }}>
              <div className="f-mono" style={{ fontSize: 8.5, color:'var(--ink-2)', letterSpacing:'.14em' }}>
                DATE
              </div>
              <div className="f-serif-m" style={{ fontSize: 13, color:'var(--ink)', whiteSpace:'nowrap' }}>
                26.04.21
              </div>
            </div>
          </div>

          {/* quote */}
          <div style={{ padding:'16px 4px 0', position:'relative' }}>
            <div className="f-serif" style={{
              position:'absolute', top:-4, left: 0, fontSize: 60, lineHeight:1, color:'var(--ochre)', opacity:.5,
            }}>"</div>
            <div className="f-serif-m" style={{
              fontSize: 15, lineHeight: 1.5, color:'var(--ink)',
              padding:'0 18px', textAlign:'center',
            }}>
              {D.quote}
            </div>
            <div className="f-serif" style={{
              textAlign:'right', fontSize: 60, lineHeight:.2, color:'var(--ochre)', opacity:.5, marginTop: 10,
            }}>"</div>
          </div>

          {/* bottom — QR + signature */}
          <div style={{
            position:'absolute', bottom: 16, left: 20, right: 20,
            display:'flex', alignItems:'flex-end', justifyContent:'space-between', gap: 10,
            paddingTop: 10, borderTop:'1px solid var(--ink)',
          }}>
            <div style={{
              width: 62, height: 62, background:'#fff', border:'1px solid var(--ink)',
              padding: 3, flexShrink:0,
            }}>
              <QRBlock/>
            </div>
            <div style={{ flex: 1, paddingLeft: 4 }}>
              <div className="f-serif-m" style={{ fontSize: 12, color:'var(--ink)', lineHeight:1.3 }}>
                扫码也领一份<br/>你的诊断书 →
              </div>
              <div className="f-mono" style={{ fontSize: 8.5, color:'var(--ink-2)', letterSpacing:'.1em', marginTop: 3 }}>
                sbti.test · 31Q / 3MIN
              </div>
            </div>
            <div style={{ textAlign:'right' }}>
              <div className="f-play" style={{ fontStyle:'italic', fontSize: 14, color:'var(--ink)' }}>
                Dr. SBTI
              </div>
              <div className="f-mono" style={{ fontSize: 8, color:'var(--ink-2)', letterSpacing:'.14em', marginTop: 1 }}>
                ATTENDING
              </div>
            </div>
          </div>
        </div>
      </div>
    </Page>
  );
}

function QRBlock() {
  const N = 21;
  const cells = React.useMemo(()=>{
    let x = 1337;
    const rand = () => { x = (x*9301 + 49297) % 233280; return x/233280; };
    const out = [];
    for (let r=0;r<N;r++) for(let c=0;c<N;c++) {
      const inMarker = (r<7&&c<7) || (r<7&&c>=N-7) || (r>=N-7&&c<7);
      if (inMarker) {
        const lr = r<7?r:r-(N-7);
        const lc = c<7?c:c-(N-7);
        const b = (lr===0||lr===6||lc===0||lc===6) || (lr>=2&&lr<=4&&lc>=2&&lc<=4);
        out.push(b?1:0);
        continue;
      }
      out.push(rand() > .55 ? 1 : 0);
    }
    return out;
  }, []);
  return (
    <div style={{ display:'grid', gridTemplateColumns:`repeat(${N}, 1fr)`, width:'100%', height:'100%' }}>
      {cells.map((v,i)=>(
        <div key={i} style={{ background: v?'var(--ink)':'transparent' }}/>
      ))}
    </div>
  );
}

window.Page4Share = Page4Share;
