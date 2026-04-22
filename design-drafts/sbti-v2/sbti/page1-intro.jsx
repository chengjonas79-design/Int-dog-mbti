// Page 1 · Intro — diagnostic entry
function Page1Intro() {
  const cats = [
    { n: 1, cn: '死者', en: 'DEAD',    meta:'社交意愿 -99%',       tone:'green' },
    { n: 2, cn: '吗喽', en: 'MALO',    meta:'内耗指数 ★★★★★',     tone:'ink' },
    { n: 3, cn: '废物', en: 'POOR',    meta:'摆烂熟练度 MAX',      tone:'ochre' },
    { n: 4, cn: '小丑', en: 'JOKE-R',  meta:'自嘲浓度 · 满配',     tone:'ink' },
    { n: 5, cn: '草者', en: 'FUCK',    meta:'暴躁阈值 · 随时',     tone:'red' },
  ];

  const toneColor = (t) => ({
    green:'var(--green)', ink:'var(--ink)', ochre:'var(--ochre)', red:'var(--red)',
  }[t]);

  return (
    <Page note="Page 1 · Intro" className="page-844">
      <StatusBar/>
      <ReportHeader subtitle="PERSONALITY DIAGNOSTIC · BASED ON MBTI FRAMEWORK, UNMITIGATED" />

      {/* HERO */}
      <div style={{ padding:'22px 22px 0' }}>
        <div className="f-mono" style={{ fontSize:10, fontWeight:500, color:'var(--ink-2)', letterSpacing:'.16em' }}>
          VOL. 01 · FOR SUBJECTS OVER 18
        </div>

        <h1 className="f-serif" style={{
          fontSize: 34, lineHeight: 1.12, margin:'16px 0 0',
          letterSpacing:'-.01em',
        }}>
          MBTI 已经过时，<br/>
          <span style={{ color:'var(--green)' }}>SBTI</span> 来了。
        </h1>

        <div className="f-play" style={{
          fontStyle:'italic', fontSize: 14, color:'var(--ink-2)', marginTop: 10, letterSpacing:'.01em',
        }}>
          A diagnostic report you probably don't want to read.
        </div>

        <p className="f-sans" style={{
          fontSize: 13, lineHeight: 1.6, color:'var(--ink)', margin:'10px 0 0',
          fontWeight: 500,
        }}>
          一份你可能不太想看的人格诊断书。31 题诊断，5 大病理分类，15 项并发症状，24 个细分人格亚型。
        </p>
      </div>

      {/* thin rule */}
      <div style={{ padding:'22px 22px 0' }}>
        <div className="hr-ink"/>
        <div style={{
          display:'flex', justifyContent:'space-between', padding:'6px 0 0',
          fontFamily:'DM Mono, monospace', fontSize: 9, fontWeight:500, color:'var(--ink-2)', letterSpacing:'.14em',
        }}>
          <span>CLASSIFICATION</span>
          <span>5 CATEGORIES</span>
        </div>
      </div>

      {/* categories table */}
      <div style={{ padding:'2px 22px 0' }}>
        {cats.map((c) => (
          <div key={c.n} className="diag-row" style={{
            gridTemplateColumns:'20px 28px 1fr 1fr auto',
            gap: 10, padding:'12px 0',
          }}>
            <span className="f-mono" style={{ fontSize: 9, color:'var(--ink-2)', fontWeight: 500, letterSpacing:'.1em' }}>
              §{String(c.n).padStart(2,'0')}
            </span>
            <span className="f-mono" style={{ fontSize: 10, color:'var(--ink-2)', letterSpacing:'.14em' }}>
              No.{String(c.n).padStart(2,'0')}
            </span>
            <span className="f-serif-m" style={{ fontSize: 18, color: toneColor(c.tone), lineHeight:1 }}>
              {c.cn}
            </span>
            <span className="f-play" style={{ fontStyle:'italic', fontSize: 12, color:'var(--ink-2)' }}>
              {c.en}
            </span>
            <span className="f-mono" style={{ fontSize: 10, color:'var(--ink)', fontWeight:500 }}>
              {c.meta}
            </span>
          </div>
        ))}
      </div>

      {/* disclaimer-ish middle note */}
      <div style={{ padding:'18px 22px 0' }}>
        <div style={{
          border:'1px solid var(--line-2)', padding:'10px 12px',
          display:'flex', gap: 10, alignItems:'flex-start',
        }}>
          <div style={{
            flexShrink:0, width: 20, height: 20, borderRadius:'50%',
            border:'1px solid var(--ochre)', color:'var(--ochre)',
            display:'flex', alignItems:'center', justifyContent:'center',
            fontFamily:'Playfair Display, serif', fontSize: 12, fontWeight:700, fontStyle:'italic',
          }}>i</div>
          <div style={{ fontSize: 11, lineHeight:1.55, color:'var(--ink-2)', fontWeight:500 }}>
            本测试仅作娱乐用途，不构成任何医学、心理或人生建议。结果可能比你预想的更难听。
          </div>
        </div>
      </div>

      {/* CTA */}
      <div style={{ padding:'24px 22px 0', display:'flex', flexDirection:'column', gap: 8 }}>
        <button className="btn-clinical" style={{ width:'100%', padding:'14px 18px', fontSize: 15 }}>
          我同意接受诊断 →
        </button>
        <div className="f-mono" style={{
          textAlign:'center', fontSize: 10, color:'var(--ink-2)', fontWeight:500,
          letterSpacing:'.14em', marginTop: 4,
        }}>
          3 MIN · 31 ITEMS · FOR ENTERTAINMENT ONLY
        </div>
      </div>

      {/* bottom signature */}
      <div style={{
        position:'absolute', bottom: 18, left: 22, right: 22,
        display:'flex', justifyContent:'space-between', alignItems:'flex-end',
        fontFamily:'DM Mono, monospace', fontSize: 9, color:'var(--ink-2)', letterSpacing:'.12em',
      }}>
        <span>SBTI · EST.2026</span>
        <span>—— ATTENDING PHYSICIAN / 人格科</span>
      </div>
    </Page>
  );
}

window.Page1Intro = Page1Intro;
