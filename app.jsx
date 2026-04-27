// app.jsx — composes the design canvas with all 5 variants
const { DesignCanvas, DCSection, DCArtboard } = window;
const { V1ClinicalMinimal, V2CalmWellness, V3DarkMonitor, V4PaperChart, V5StatusFirst } = window;

function App() {
  return (
    <DesignCanvas>
      <DCSection id="ecg-app" title="心电 APP · 患者端" subtitle="同一份 BLE 协议规范，五种患者端设计语言。每个原型实时模拟 4 帧/秒 ECG 数据流，可发送命令、查看数据包。">
        <DCArtboard id="v1" label="A · 临床极简" width={412} height={892}>
          <V1ClinicalMinimal />
        </DCArtboard>
        <DCArtboard id="v2" label="B · 温和健康" width={412} height={892}>
          <V2CalmWellness />
        </DCArtboard>
        <DCArtboard id="v3" label="C · 暗色监护仪" width={412} height={892}>
          <V3DarkMonitor />
        </DCArtboard>
        <DCArtboard id="v4" label="D · 心电纸张" width={412} height={892}>
          <V4PaperChart />
        </DCArtboard>
        <DCArtboard id="v5" label="E · 状态优先 (适老化)" width={412} height={892}>
          <V5StatusFirst />
        </DCArtboard>
      </DCSection>
    </DesignCanvas>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
