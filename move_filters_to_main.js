const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend/src/App.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Remove "상태 필터" from Sidebar
const sidebarStatusFilterRegex = /<p className="px-3 text-\[10px\] font-bold text-on-surface-variant uppercase tracking-wider mb-2 mt-4">상태 필터<\/p>[\s\S]*?{\s*\[\s*{\s*id: '전체 보기'[\s\S]*?}\s*\]\.map[\s\S]*?<\/button>\s*}\)\s*}/;
// Need to be careful with the mapping end. Let's use a more specific match.
const sidebarStatusFilterBlock = `              <p className="px-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-2 mt-4">상태 필터</p>
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
              ))}`;

if (content.indexOf(sidebarStatusFilterBlock) !== -1) {
    content = content.replace(sidebarStatusFilterBlock, '');
    console.log('Successfully removed status filters from sidebar.');
}

// 2. Add Status Filters to Dashboard Main View
// We will place them right before the stats section cards.
const statsSectionStart = '<section className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8 mb-12">';
const statusFiltersMain = `        {/* Status Filters - Main View */}
        <div className="flex flex-wrap items-center gap-3 mb-8">
          {[
            { id: '전체 보기', label: '전체 보기', icon: 'list' },
            { id: '마감 임박', label: '마감 임박', icon: 'schedule' },
            { id: '참여 목록', label: '참여 목록', icon: 'task_alt' }
          ].map(f => (
            <button 
              key={f.id}
              onClick={() => { setSelectedStatus(f.id); setSelectedProvider(null); }} 
              className={\`px-6 py-2.5 rounded-2xl flex items-center gap-2 transition-all duration-300 font-bold text-sm \${selectedStatus === f.id ? 'bg-primary text-on-primary shadow-lg shadow-primary/20 border border-primary/20' : 'bg-surface-container border border-white/5 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'}\`}
            >
              <span className="material-symbols-outlined text-lg">{f.icon}</span>
              <span>{f.label}</span>
            </button>
          ))}
        </div>

        `;

if (content.indexOf(statsSectionStart) !== -1) {
    content = content.replace(statsSectionStart, statusFiltersMain + statsSectionStart);
    console.log('Successfully added status filters to dashboard main view.');
} else {
    console.error('Could not find the stats section to insert filters.');
}

fs.writeFileSync(filePath, content, 'utf8');
