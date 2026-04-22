// Page 3 · Result — diagnostic report with figure as hero
const TYPE_DATA = {
  CTRL: {
    code:'CTRL', cn:'拿捏者', en:'THE CONTROLLER',
    match: 92, category:{ n:1, cn:'死者', en:'DEAD' },
    core: '已读不回三日症候群 · 过度掌控型人格综合征',
    descriptor: ['控制欲 MAX','伪装 E 人','PPT 成瘾','咖啡续命'],
    patho: '被试对象不是在管理事情，是在管理"一切不如你意的东西"。每天醒来的第一件事是给世界列 Todo List：别人摸鱼你摸 KPI，别人哭穷你哭进度。所有"失控"瞬间都会让你当场短路、原地重启。嘴上说"随便你"，心里已经把你骂了十八遍。',
    treatment: '建议立即卸载所有项目管理软件。如出现持续性控制欲发作，请拨打闺蜜电话。禁止在深夜 11 点后打开工作群。',
  },
  DEL: {
    code:'DEL', cn:'删号者', en:'THE DELETER',
    match: 87, category:{ n:1, cn:'死者', en:'DEAD' },
    core: '数字化人间蒸发 · 反复注销重启型人格',
    descriptor: ['消失大师','断联成瘾','凌晨发癫','三天可见都嫌多'],
    patho: '被试对象不处理情绪，只处理痕迹。一吵架就拉黑，一 emo 就注销，一破防就换头像。你以为你在"释然"，你只是在"删除证据"。别人的记忆里你永远是"那个突然消失的人"，而你每隔两个月就重新注册一个号，装作自己刚来世界。',
    treatment: '请勿在 24 小时内连续注销超过 3 个账号，系统可能认为你是机器人。建议保留至少一条朋友圈超过一周。',
  },
  TAB: {
    code:'TAB', cn:'摸鱼者', en:'THE SWITCHER',
    match: 95, category:{ n:2, cn:'吗喽', en:'MALO' },
    core: '多任务注意力涣散 · 截止日前觉醒型',
    descriptor: ['切屏王者','划水之神','截止日患者','无限加载'],
    patho: '被试对象的简历写着"擅长多任务并行"，翻译过来是"同时摸鱼和划水"。一天按 Tab 切换 800 次，实际产出 0.3 件事。开会开一半去泡面，写文档写一半去买奶茶。deadline 前两小时才发现——原文档还没新建。你不是拖延，你是艺术家。',
    treatment: '每次只许打开 3 个标签页。建议在浏览器安装"自我厌恶"插件。凌晨两点前必须关闭所有窗口。',
  },
};

function Page3Result({ type: typeKey, onChangeType }) {
  const T = TYPE_DATA[typeKey] || TYPE_DATA.CTRL;

  const weaknesses = [
    { n:'已读不回耐受度',           v: 28 },
    { n:'甩锅熟练度',               v: 72 },
    { n:'摆烂隐蔽性',               v: 85 },
    { n:'朋友圈人设崩塌风险',       v: 91 },
    { n:'凌晨 3 点发疯浓度',        v: 84 },
    { n:'前任残留量',               v: 46 },
    { n:'PPT 成瘾度',               v: 82 },
    { n:'嘴硬强度',                 v: 95 },
    { n:'互联网身份割裂度',         v: 78 },
    { n:'自我 PUA 熟练度',          v: 69 },
    { n:'精神内耗 KWH',             v: 93 },
    { n:'嘴上说不要身体很诚实度',   v: 61 },
    { n:'下班消失速度',             v: 99 },
    { n:'已读老板不回概率',         v: 12 },
    { n:'假装在努力表演分',         v: 86 },
  ];

  return (
    <Page note="Page 3 · Result">
      <StatusBar/>
      <ReportHeader subtitle={`PERSONALITY DIAGNOSTIC REPORT · TYPE ${typeKey === 'CTRL'?'001':typeKey==='DEL'?'007':'013'} / 25 · SUBJECT #A031`} />

      {/* HERO */}
      <div style={{ padding:'22px 22px 0' }}>
        <div className="f-mono" style={{ fontSize:10, color:'var(--ink-2)', letterSpacing:'.14em' }}>
          FIG.A — 你的人格类型是
        </div>

        {/* type labels */}
        <div style={{ marginTop: 10, display:'flex', alignItems:'baseline', gap: 14 }}>
          <span className="f-serif" style={{ fontSize: 40, color:'var(--green)', lineHeight: 1, letterSpacing:'-.01em' }}>
            {T.cn}
          </span>
          <span className="f-play" style={{
            fontSize: 38, color:'var(--green)', fontWeight: 500, lineHeight: 1, letterSpacing:'.02em',
          }}>
            {T.code}
          </span>
        </div>
        <div className="f-play" style={{
          fontStyle:'italic', fontSize: 13, color:'var(--ink-2)', marginTop: 6, letterSpacing:'.02em',
        }}>
          — {T.en}
        </div>

        {/* FIGURE card — the visual anchor */}
        <div style={{
          marginTop: 18, position:'relative',
          border:'1px solid var(--line)', background:'#fff',
          padding:'10px 10px 8px',
        }}>
          {/* corner marks */}
          {['tl','tr','bl','br'].map(p => (
            <div key={p} style={{
              position:'absolute', width: 10, height: 10, border:'1px solid var(--ink)',
              ...(p==='tl' ? { top:-1, left:-1, borderRight:'none', borderBottom:'none' } :
                  p==='tr' ? { top:-1, right:-1, borderLeft:'none', borderBottom:'none' } :
                  p==='bl' ? { bottom:-1, left:-1, borderRight:'none', borderTop:'none' } :
                             { bottom:-1, right:-1, borderLeft:'none', borderTop:'none' }),
            }}/>
          ))}
          <div style={{ display:'flex', justifyContent:'center', alignItems:'center', padding:'4px 0' }}>
            <Figure type={typeKey} size={270}/>
          </div>
          <div style={{
            display:'flex', justifyContent:'space-between', alignItems:'center',
            paddingTop: 6, borderTop:'1px solid var(--line)', marginTop: 4,
          }}>
            <span className="f-mono" style={{ fontSize: 9, color:'var(--ink-2)', letterSpacing:'.12em' }}>
              FIG.A · SPECIMEN {typeKey}
            </span>
            <span className="f-play" style={{ fontStyle:'italic', fontSize: 11, color:'var(--ink-2)' }}>
              low-poly rendering · not to scale
            </span>
          </div>

          {/* match seal floating */}
          <div style={{ position:'absolute', right: -12, top: 14 }}>
            <div style={{
              width: 78, height: 78, borderRadius:'50%',
              border:'1px solid var(--green)',
              background:'#FAF7F0',
              display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
              color:'var(--green)',
              transform:'rotate(-10deg)',
            }}>
              <span className="f-mono" style={{ fontSize: 8, fontWeight:500, letterSpacing:'.14em' }}>MATCH</span>
              <span className="f-serif" style={{ fontSize: 22, lineHeight:1, margin:'2px 0' }}>{T.match}%</span>
              <span className="f-mono" style={{ fontSize: 7, letterSpacing:'.1em' }}>CONFIDENCE</span>
            </div>
          </div>
        </div>

        {/* descriptor chips */}
        <div style={{ display:'flex', flexWrap:'wrap', gap: 6, marginTop: 14 }}>
          {T.descriptor.map((d,i)=>(
            <span key={i} className="f-mono" style={{
              fontSize: 10, fontWeight:500, padding:'3px 7px',
              border:'1px solid var(--line-2)', color:'var(--ink)',
              background:'#fff',
            }}>{d}</span>
          ))}
        </div>

        {/* switcher (demo) */}
        <div style={{
          marginTop: 14, display:'flex', gap: 4, alignItems:'center',
          borderTop:'1px dashed var(--line-2)', paddingTop: 10,
        }}>
          <span className="f-mono" style={{ fontSize: 9, color:'var(--ink-2)', letterSpacing:'.14em', marginRight: 4 }}>
            DEMO · 切换样本 ↓
          </span>
          {Object.keys(TYPE_DATA).map(k=>(
            <button key={k} onClick={()=>onChangeType(k)} style={{
              border:`1px solid ${typeKey===k ? 'var(--green)' : 'var(--line-2)'}`,
              background: typeKey===k ? 'var(--green)' : '#fff',
              color: typeKey===k ? '#fff' : 'var(--ink)',
              fontFamily:'DM Mono, monospace', fontSize: 10, fontWeight: 700,
              padding:'3px 8px', cursor:'pointer', letterSpacing:'.1em',
            }}>{k}</button>
          ))}
        </div>
      </div>

      {/* § 01 CORE PATHOLOGY */}
      <div style={{ padding:'26px 22px 0' }}>
        <SectionMark num={1} cnTitle="核心病灶" enTitle="CORE PATHOLOGY"/>
        <div className="f-mono" style={{ fontSize: 10, color:'var(--ochre)', fontWeight:500, letterSpacing:'.1em', marginBottom: 8 }}>
          ▸ DIAGNOSIS · {T.core}
        </div>
        <p className="f-sans" style={{
          fontSize: 12.5, lineHeight: 1.7, color:'var(--ink)', fontWeight: 500, margin: 0,
          textIndent:'2em',
        }}>
          {T.patho}
        </p>
      </div>

      {/* § 02 COMORBIDITIES */}
      <div style={{ padding:'26px 22px 0' }}>
        <SectionMark num={2} cnTitle="并发症状" enTitle="COMORBIDITIES (15)"/>
        <div style={{ border:'1px solid var(--line)', background:'#fff' }}>
          {/* table header */}
          <div style={{
            display:'grid', gridTemplateColumns:'28px 1fr 90px 36px',
            gap: 10, padding:'6px 10px', borderBottom:'1px solid var(--line)',
            fontFamily:'DM Mono, monospace', fontSize: 9, color:'var(--ink-2)', letterSpacing:'.12em',
          }}>
            <span>No.</span><span>SYMPTOM</span><span>SEVERITY</span><span style={{textAlign:'right'}}>%</span>
          </div>
          {weaknesses.map((w,i)=>(
            <div key={i} style={{
              display:'grid', gridTemplateColumns:'28px 1fr 90px 36px',
              gap: 10, padding:'7px 10px',
              borderBottom: i<weaknesses.length-1 ? '1px solid var(--line)' : 'none',
              alignItems:'center',
            }}>
              <span className="f-mono" style={{ fontSize:9, color:'var(--ink-2)', letterSpacing:'.1em' }}>
                {String(i+1).padStart(2,'0')}
              </span>
              <span className="f-sans" style={{ fontSize: 11.5, fontWeight: 500, color:'var(--ink)' }}>
                {w.n}
              </span>
              <Bar value={w.v} width={88}/>
              <span className="f-mono" style={{ fontSize: 10, fontWeight:700, color:'var(--ink)', textAlign:'right' }}>
                {w.v}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* § 03 ATTENDING PHYSICIAN'S NOTE */}
      <div style={{ padding:'26px 22px 0' }}>
        <SectionMark num={3} cnTitle="医嘱" enTitle="ATTENDING PHYSICIAN'S NOTE"/>
        <div style={{ border:'1px solid var(--ink)', padding:'12px 14px', background:'#fff' }}>
          <div style={{ display:'flex', alignItems:'center', gap: 8, marginBottom: 6 }}>
            <div className="f-play" style={{
              fontStyle:'italic', fontSize: 13, color:'var(--ochre)',
            }}>Rx.</div>
            <div className="f-mono" style={{ fontSize: 9, color:'var(--ink-2)', letterSpacing:'.12em' }}>
              PRESCRIPTION · 2026.04.21
            </div>
          </div>
          <p className="f-sans" style={{ fontSize: 12, lineHeight: 1.65, color:'var(--ink)', margin: 0, fontWeight:500 }}>
            {T.treatment}
          </p>
          <div style={{
            display:'flex', justifyContent:'space-between', alignItems:'flex-end',
            marginTop: 12, paddingTop: 10, borderTop:'1px dashed var(--line-2)',
          }}>
            <div className="f-mono" style={{ fontSize: 9, color:'var(--ink-2)', letterSpacing:'.1em' }}>
              本单据仅供娱乐 · NOT FOR MEDICAL USE
            </div>
            <div className="f-play" style={{ fontStyle:'italic', fontSize: 14, color:'var(--ink)' }}>
              Dr. SBTI
            </div>
          </div>
        </div>
      </div>

      {/* § 04 RELATED CASES */}
      <div style={{ padding:'26px 22px 0' }}>
        <SectionMark num={4} cnTitle="相关案例" enTitle="RELATED CASES · CROSS-REFERENCE"/>
        <div className="f-mono" style={{ fontSize: 10, color:'var(--ink-2)', letterSpacing:'.08em', marginBottom: 10 }}>
          人类已测 · 动物还未测
        </div>
        <div style={{ display:'flex', gap: 10 }}>
          <button style={{
            flex:1, border:'1px solid var(--line-2)', background:'#fff',
            padding:'12px 12px', textAlign:'left', cursor:'pointer',
            fontFamily:'Noto Sans SC',
          }}>
            <div style={{ fontSize: 24, lineHeight:1 }}>🐶</div>
            <div className="f-serif-m" style={{ fontSize: 14, marginTop: 6, color:'var(--ink)' }}>
              狗狗宠格
            </div>
            <div className="f-mono" style={{ fontSize: 9, marginTop: 4, color:'var(--ink-2)', letterSpacing:'.08em' }}>
              DBTI · 20 items →
            </div>
          </button>
          <button style={{
            flex:1, border:'1px solid var(--line-2)', background:'#fff',
            padding:'12px 12px', textAlign:'left', cursor:'pointer',
            fontFamily:'Noto Sans SC',
          }}>
            <div style={{ fontSize: 24, lineHeight:1 }}>🐱</div>
            <div className="f-serif-m" style={{ fontSize: 14, marginTop: 6, color:'var(--ink)' }}>
              猫咪宠格
            </div>
            <div className="f-mono" style={{ fontSize: 9, marginTop: 4, color:'var(--ink-2)', letterSpacing:'.08em' }}>
              CBTI · 18 items →
            </div>
          </button>
        </div>
      </div>

      {/* CTA */}
      <div style={{ padding:'26px 22px 0', display:'flex', flexDirection:'column', gap: 8 }}>
        <button className="btn-clinical" style={{ width:'100%', fontSize: 14 }}>
          📋 复制诊断书 · 朋友圈
          <span className="f-mono" style={{ fontSize: 10, opacity:.75, marginLeft: 4 }}>192 字</span>
        </button>
        <div style={{ display:'flex', gap: 8 }}>
          <button className="btn-ghost" style={{ flex: 1 }}>不服 · 复测一次</button>
          <button className="btn-ghost" style={{ flex: 1 }}>回到挂号处</button>
        </div>
      </div>

      {/* footer */}
      <div style={{
        marginTop: 24, padding:'14px 22px 20px', borderTop:'1px solid var(--ink)',
        display:'flex', justifyContent:'space-between',
        fontFamily:'DM Mono, monospace', fontSize: 9, color:'var(--ink-2)', letterSpacing:'.12em',
      }}>
        <span>SBTI / REPORT #A031-{typeKey}</span>
        <span>— Dr. SBTI</span>
      </div>
    </Page>
  );
}

window.Page3Result = Page3Result;
window.TYPE_DATA = TYPE_DATA;
