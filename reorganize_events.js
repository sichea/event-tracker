const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend/src/App.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Rename labels
content = content.replace(/>ETF 이벤트<\/button>/g, '>이벤트</button>');
content = content.replace(/>ETF 이벤트<\/span>/g, '>이벤트</span>');
content = content.replace(
    'selectedProvider ? `${PROVIDERS.find(p=>p.key===selectedProvider)?.name} 이벤트` : "ETF 이벤트"',
    'selectedProvider ? `${PROVIDERS.find(p=>p.key===selectedProvider)?.name} 이벤트` : "이벤트"'
);

// 2. Remove the Provider Grid from the dashboard main view
// The regex finds the section containing PROVIDERS.map for the grid
const providerGridRegex = /<section className="mt-12 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-6">[\s\S]*?{PROVIDERS\.map[\s\S]*?<\/section>/;
content = content.replace(providerGridRegex, '');

// 3. Update Sidebar to show filters and providers when activeTab === 'dashboard'
const sidebarInsertPoint = ") : activeTab === 'parking' ? (";
const dashboardSidebarContent = `) : activeTab === 'dashboard' ? (
            <>
              <p className="px-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-2 mt-4">상태 필터</p>
              {[
                { id: '전체 보기', label: '전체 보기', icon: 'list' },
                { id: '마감 임박', label: '마감 임박', icon: 'schedule' },
                { id: '참여 목록', label: '참여 목록', icon: 'task_alt' }
              ].map(f => (
                <button 
                  key={f.id}
                  onClick={() => { setSelectedStatus(f.id); setSelectedProvider(null); window.scrollTo(0,0); }} 
                  className={\`w-full text-left rounded-lg flex items-center gap-3 px-3 py-2.5 transition-all duration-300 \${selectedStatus === f.id ? 'bg-[#262c3a] text-[#73ffba] shadow-lg border border-white/5' : 'text-[#ebedfb]/70 hover:bg-[#262c3a]/30 hover:text-[#73ffba]'}\`}
                >
                  <span className="material-symbols-outlined text-xl">{f.icon}</span>
                  <span className="font-medium text-sm">{f.label}</span>
                </button>
              ))}

              <p className="px-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-2 mt-6">운용사별</p>
              <div className="space-y-1 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {PROVIDERS.map(p => (
                  <button 
                    key={p.key}
                    onClick={() => { setSelectedProvider(p.key); setSelectedStatus("전체 보기"); window.scrollTo(0,0); }} 
                    className={\`w-full text-left rounded-lg flex items-center gap-3 px-3 py-2 transition-all duration-300 \${selectedProvider === p.key ? 'bg-[#262c3a] text-[#73ffba] shadow-lg border border-white/5' : 'text-[#ebedfb]/70 hover:bg-[#262c3a]/30 hover:text-[#73ffba]'}\`}
                  >
                    <div className={\`w-6 h-6 rounded flex items-center justify-center text-[8px] font-bold \${p.bgColor} \${p.textCol || 'text-white'}\`}>
                      {p.textLabel}
                    </div>
                    <span className="font-medium text-xs">{p.name}</span>
                  </button>
                ))}
              </div>
            </>
          `;

content = content.replace(sidebarInsertPoint, dashboardSidebarContent + sidebarInsertPoint);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully renamed Event tab, updated Sidebar, and cleaned up Dashboard grid.');
