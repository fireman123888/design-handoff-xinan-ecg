// elderly-canvas.jsx — design canvas wrapping the full elderly-focused app
// Shows the live interactive prototype + a tour of every screen.

const { DesignCanvas, DCSection, DCArtboard } = window;
const { ElderlyApp, ElderlyScreenDemo } = window;

function App() {
  return (
    <DesignCanvas>
      <DCSection id="live" title="心安心电 · 完整原型" subtitle="可交互的多屏应用：从首次配对开始，主页 → 记录 → 详情 → 家人 → 设置全部相连。底部导航和命令面板均可点击。">
        <DCArtboard id="full" label="完整原型 · 从配对开始" width={412} height={892}>
          <ElderlyApp initialScreen="welcome" />
        </DCArtboard>
        <DCArtboard id="full2" label="完整原型 · 直接进入应用" width={412} height={892}>
          <ElderlyApp initialScreen="app" />
        </DCArtboard>
      </DCSection>

      <DCSection id="screens" title="单屏巡览" subtitle="每个关键屏幕的独立预览，便于截图、对比与评审。">
        <DCArtboard id="welcome" label="01 · 欢迎与配对" width={412} height={892}>
          <ElderlyScreenDemo which="welcome" />
        </DCArtboard>
        <DCArtboard id="home" label="02 · 主页（实时）" width={412} height={892}>
          <ElderlyScreenDemo which="home" />
        </DCArtboard>
        <DCArtboard id="history" label="03 · 历史记录" width={412} height={892}>
          <ElderlyScreenDemo which="history" />
        </DCArtboard>
        <DCArtboard id="detail" label="04 · 当日详情" width={412} height={892}>
          <ElderlyScreenDemo which="detail" />
        </DCArtboard>
        <DCArtboard id="family" label="05 · 家人共享" width={412} height={892}>
          <ElderlyScreenDemo which="family" />
        </DCArtboard>
        <DCArtboard id="settings" label="06 · 设置" width={412} height={892}>
          <ElderlyScreenDemo which="settings" />
        </DCArtboard>
        <DCArtboard id="alarm" label="07 · 电极脱落警报" width={412} height={892}>
          <ElderlyScreenDemo which="alarm" />
        </DCArtboard>
      </DCSection>
    </DesignCanvas>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
