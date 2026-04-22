// Figure — the low-poly character illustrations
// CTRL uses the uploaded reference image. DEL and TAB are SVG pastiches
// matching the same muted low-poly vocabulary (same palette as CTRL).

function FigureCTRL({ size = 260 }) {
  return (
    <img src="sbti/assets/ctrl-figure.png" alt="CTRL 拿捏者"
      style={{ width: size, height: size, objectFit:'contain', display:'block' }}/>
  );
}

// A lightweight low-poly stand-in — same ochre skin + dark cube hair
function FigureDEL({ size = 260 }) {
  // The "deleter" — face obscured by a pixelated blur square / partly dissolving
  return (
    <svg viewBox="0 0 260 260" width={size} height={size} style={{ display:'block' }}>
      {/* ground shadow */}
      <ellipse cx="130" cy="236" rx="56" ry="5" fill="#000" opacity=".18"/>

      {/* body — ochre */}
      <polygon points="100,180 160,180 170,225 90,225" fill="#C8956F"/>
      <polygon points="90,225 170,225 165,232 95,232" fill="#A67D5A"/>
      <polygon points="160,180 170,225 182,220 175,170" fill="#A67D5A"/>

      {/* shoulders/arms */}
      <polygon points="80,175 100,170 105,210 85,215" fill="#C8956F"/>
      <polygon points="160,170 180,175 175,215 155,210" fill="#C8956F"/>
      <polygon points="80,215 100,210 100,224 82,226" fill="#8A6646"/>
      <polygon points="160,210 180,215 178,226 160,224" fill="#8A6646"/>

      {/* neck */}
      <polygon points="115,160 145,160 150,178 110,178" fill="#B9835D"/>

      {/* head box — ochre */}
      <polygon points="90,95 170,95 175,162 85,162" fill="#D6A07B"/>
      <polygon points="85,162 175,162 172,168 88,168" fill="#A47153"/>
      <polygon points="170,95 175,162 180,100" fill="#B9835D"/>

      {/* hair — dark geometric */}
      <polygon points="88,95 172,95 178,108 82,108" fill="#2D2A26"/>
      <polygon points="82,108 102,70 155,68 178,108 160,90 105,92" fill="#2D2A26"/>
      <polygon points="82,108 90,140 98,108" fill="#2D2A26"/>
      <polygon points="178,108 170,140 162,108" fill="#2D2A26"/>

      {/* OBSCURED FACE — pixel-deleted region */}
      {(() => {
        const cells = [];
        const sz = 10;
        const xs = 95, ys = 110, cols = 8, rows = 5;
        for (let r=0;r<rows;r++) for(let c=0;c<cols;c++){
          const hash = (r*37 + c*73) % 5;
          const colors = ['#2D2A26','#5c574f','#C8956F','#FAF7F0','#7A9970'];
          cells.push(<rect key={`${r}-${c}`} x={xs+c*sz} y={ys+r*sz} width={sz-.5} height={sz-.5} fill={colors[hash]}/>);
        }
        return cells;
      })()}

      {/* "deleted" stamp overlay */}
      <g transform="translate(162,142) rotate(-8)">
        <rect x="0" y="0" width="54" height="16" fill="none" stroke="#B94A3A" strokeWidth="1.5"/>
        <text x="27" y="11.5" textAnchor="middle" fill="#B94A3A"
          style={{ fontFamily:'DM Mono, monospace', fontSize:9, fontWeight:700, letterSpacing:'.1em' }}>
          DELETED
        </text>
      </g>
    </svg>
  );
}

// The "switcher" — two overlapping tab-like figures
function FigureTAB({ size = 260 }) {
  return (
    <svg viewBox="0 0 260 260" width={size} height={size} style={{ display:'block' }}>
      <ellipse cx="130" cy="236" rx="60" ry="5" fill="#000" opacity=".18"/>

      {/* BACK figure (slightly offset) — ghosted */}
      <g opacity=".45" transform="translate(-18,-4)">
        {/* body */}
        <polygon points="100,180 160,180 170,225 90,225" fill="#C8956F"/>
        <polygon points="115,160 145,160 150,178 110,178" fill="#B9835D"/>
        {/* head */}
        <polygon points="90,95 170,95 175,162 85,162" fill="#D6A07B"/>
        <polygon points="85,162 175,162 172,168 88,168" fill="#A47153"/>
        {/* hair */}
        <polygon points="82,108 102,70 155,68 178,108 160,90 105,92" fill="#2D2A26"/>
        <polygon points="88,95 172,95 178,108 82,108" fill="#2D2A26"/>
      </g>

      {/* FRONT figure */}
      <g transform="translate(18,0)">
        {/* body */}
        <polygon points="100,180 160,180 170,225 90,225" fill="#C8956F"/>
        <polygon points="90,225 170,225 165,232 95,232" fill="#A67D5A"/>
        <polygon points="160,180 170,225 182,220 175,170" fill="#A67D5A"/>
        {/* neck */}
        <polygon points="115,160 145,160 150,178 110,178" fill="#B9835D"/>
        {/* head */}
        <polygon points="90,95 170,95 175,162 85,162" fill="#D6A07B"/>
        <polygon points="85,162 175,162 172,168 88,168" fill="#A47153"/>
        <polygon points="170,95 175,162 180,100" fill="#B9835D"/>
        {/* hair */}
        <polygon points="88,95 172,95 178,108 82,108" fill="#2D2A26"/>
        <polygon points="82,108 102,70 155,68 178,108 160,90 105,92" fill="#2D2A26"/>
        <polygon points="82,108 90,140 98,108" fill="#2D2A26"/>
        <polygon points="178,108 170,140 162,108" fill="#2D2A26"/>
        {/* face: eyes */}
        <ellipse cx="115" cy="130" rx="2" ry="3" fill="#2D2A26"/>
        <ellipse cx="145" cy="130" rx="2" ry="3" fill="#2D2A26"/>
        {/* tiny mouth */}
        <path d="M120 148 Q130 152 140 148" stroke="#2D2A26" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
        {/* eyebrows — slanted, tired */}
        <line x1="108" y1="120" x2="120" y2="122" stroke="#2D2A26" strokeWidth="1.5" strokeLinecap="round"/>
        <line x1="152" y1="122" x2="140" y2="120" stroke="#2D2A26" strokeWidth="1.5" strokeLinecap="round"/>
      </g>

      {/* tab indicator chips — like browser tabs over head */}
      <g transform="translate(40,62)">
        <rect x="0" y="0" width="36" height="14" fill="#7A9970" stroke="#2D2A26" strokeWidth=".8"/>
        <text x="18" y="10" textAnchor="middle" fill="#fff" style={{ fontFamily:'DM Mono', fontSize: 8, fontWeight:700 }}>TAB 1</text>
      </g>
      <g transform="translate(82,56)">
        <rect x="0" y="0" width="36" height="14" fill="#FAF7F0" stroke="#2D2A26" strokeWidth=".8"/>
        <text x="18" y="10" textAnchor="middle" fill="#2D2A26" style={{ fontFamily:'DM Mono', fontSize: 8, fontWeight:700 }}>TAB 2</text>
      </g>
      <g transform="translate(130,62)">
        <rect x="0" y="0" width="36" height="14" fill="#FAF7F0" stroke="#2D2A26" strokeWidth=".8"/>
        <text x="18" y="10" textAnchor="middle" fill="#2D2A26" style={{ fontFamily:'DM Mono', fontSize: 8, fontWeight:700 }}>TAB 3</text>
      </g>
      <g transform="translate(178,56)">
        <rect x="0" y="0" width="36" height="14" fill="#C8956F" stroke="#2D2A26" strokeWidth=".8"/>
        <text x="18" y="10" textAnchor="middle" fill="#fff" style={{ fontFamily:'DM Mono', fontSize: 8, fontWeight:700 }}>···</text>
      </g>
    </svg>
  );
}

function Figure({ type, size = 260 }) {
  if (type === 'DEL') return <FigureDEL size={size}/>;
  if (type === 'TAB') return <FigureTAB size={size}/>;
  return <FigureCTRL size={size}/>;
}

// decorative set of small figures (for Intro — row of specimens)
function MiniFigureCTRL({ size = 64 }) { return <FigureCTRL size={size}/>; }

Object.assign(window, { Figure, FigureCTRL, FigureDEL, FigureTAB });
