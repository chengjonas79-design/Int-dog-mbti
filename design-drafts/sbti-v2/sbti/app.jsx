function App() {
  const [tone, setTone] = React.useState(
    (window.__TWEAKS__ && window.__TWEAKS__.paperTone) || 'cream'
  );
  const [resultType, setResultType] = React.useState('CTRL');
  const [shareType,  setShareType]  = React.useState('CTRL');

  // update paper var
  React.useEffect(() => {
    const root = document.documentElement;
    const bg = tone === 'white' ? '#FFFFFF' : tone === 'linen' ? '#F3EDE1' : '#FAF7F0';
    root.style.setProperty('--paper', bg);
  }, [tone]);

  // result page is taller than 844 — measure content
  const RESULT_H = 2100;

  return (
    <>
      <DesignCanvas>
        <DCSection id="sbti" title="SBTI 人格测试 · 诊断报告书"
          subtitle="5 张 iPhone 13 高保真 · 诊断报告风 · low-poly 参考图为主角">

          <DCArtboard id="p1" label="Page 1 · Intro 诊断入口" width={390} height={844}>
            <Page1Intro/>
          </DCArtboard>

          <DCArtboard id="p2" label="Page 2 · Question 诊断题" width={390} height={844}>
            <Page2Question/>
          </DCArtboard>

          <DCArtboard id="p5" label="Page 5 · Loading 诊断中" width={390} height={844}>
            <Page5Loading/>
          </DCArtboard>

          <DCArtboard id="p3" label="Page 3 · Result 诊断结果（CTRL/DEL/TAB 可切）" width={390} height={RESULT_H}>
            <Page3Result type={resultType} onChangeType={setResultType}/>
          </DCArtboard>

          <DCArtboard id="p4" label="Page 4 · Share Card 诊断证明书（3 版本可切）" width={390} height={844}>
            <Page4Share type={shareType} onChangeType={setShareType}/>
          </DCArtboard>
        </DCSection>
      </DesignCanvas>

      <TweaksPanel tone={tone} setTone={setTone}/>
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
