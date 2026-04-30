const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend/src/App.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add Import
content = content.replace(
  'import "./index.css"; // for any residual global styles',
  'import LandingPage from "./LandingPage";\nimport "./index.css";'
);

// 2. Remove inlined components
content = content.replace(/\/\/ --- New Landing Page Components ---[\s\S]*?\/\/ Event Card using Tailwind/g, '// Event Card using Tailwind');

// 3. Rename "AI 분석" tab to "통찰력"
// Specifically match the first nav button
content = content.replace(
    'onClick={() => setActiveTab("landing")}>AI 분석</button>',
    'onClick={() => setActiveTab("landing")}>통찰력</button>'
);

// 4. Update Mobile Nav (specifically the one that says 인사이트)
content = content.replace(
    'setActiveTab("insights"); window.scrollTo(0,0); }} className={`flex flex-col items-center gap-1 ${activeTab === \'insights\'',
    'setActiveTab("landing"); window.scrollTo(0,0); }} className={`flex flex-col items-center gap-1 ${activeTab === \'landing\''
);
content = content.replace(
    '<span className="text-[10px] font-bold">인사이트</span>',
    '<span className="text-[10px] font-bold">통찰력</span>'
);

// 5. Update the onAnalyze logic using Regex
const logicRegex = /\{activeTab === "landing" \? \([\s\S]*?<LandingPage[\s\S]*?\/>\s*?\)\s*?:/g;
const newLogicBlock = `{activeTab === "landing" ? (
          <LandingPage 
            onAnalyze={async (input) => {
              if (!input) {
                setActiveTab("dashboard");
                return;
              }
              setIsAnalyzing(true);
              try {
                const res = await fetch('http://localhost:8000/api/analyze', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ scenario: input })
                });
                const data = await res.json();
                setAnalysisResult(data);
              } catch (e) {
                console.error("Analysis error:", e);
              } finally {
                setIsAnalyzing(false);
              }
            }}
            isAnalyzing={isAnalyzing}
            analysisResult={analysisResult}
            onReset={() => setAnalysisResult(null)}
          />
        ) :`;

content = content.replace(logicRegex, newLogicBlock);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully patched App.jsx');
