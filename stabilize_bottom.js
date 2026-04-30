const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend/src/App.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// Count question marks and colons to see if they match
const qCount = (content.match(/\?/g) || []).length;
const cCount = (content.match(/:/g) || []).length;
console.log(`Question marks: ${qCount}, Colons: ${cCount}`);

// Re-write the bottom part of the file to ensure absolute clarity
const lines = content.split('\n');
const endIdx = lines.length - 1;

// Find where the main content ends (after </main>)
let cutIdx = -1;
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('</main>')) {
        cutIdx = i + 1;
        break;
    }
}

if (cutIdx !== -1) {
    const bottomContent = `
      {/* Mobile Bottom Navigation Bar */}
      <div className="md:hidden fixed bottom-0 left-0 w-full h-16 bg-[#0a0e17]/90 backdrop-blur-xl border-t border-white/10 flex items-center justify-around z-50 px-6 pb-safe">
        <button onClick={() => { setActiveTab("landing"); window.scrollTo(0,0); }} className={\`flex flex-col items-center gap-1 \${activeTab === 'landing' ? 'text-primary' : 'text-on-surface-variant'}\`}>
          <span className="material-symbols-outlined text-2xl" data-weight={activeTab === 'landing' ? 'fill' : 'normal'}>insights</span>
          <span className="text-[10px] font-bold text-center">투자 인사이트</span>
        </button>
        <button onClick={() => {setActiveTab("dashboard"); setSelectedProvider(null); setSelectedStatus("전체 보기"); window.scrollTo(0,0);}} className={\`flex flex-col items-center gap-1 \${activeTab === 'dashboard' ? 'text-primary' : 'text-on-surface-variant'}\`}>
          <span className="material-symbols-outlined text-2xl" data-weight={activeTab === 'dashboard' ? 'fill' : 'normal'}>layers</span>
          <span className="text-[10px] font-bold text-center">이벤트</span>
        </button>
        <button onClick={() => { setActiveTab("subscription"); setSubscriptionSubTab("ipo"); window.scrollTo(0,0); }} className={\`flex flex-col items-center gap-1 \${activeTab === 'subscription' ? 'text-primary' : 'text-on-surface-variant'}\`}>
          <span className="material-symbols-outlined text-2xl" data-weight={activeTab === 'subscription' ? 'fill' : 'normal'}>assignment</span>
          <span className="text-[10px] font-bold text-center">청약</span>
        </button>
        <button onClick={() => { setActiveTab("parking"); window.scrollTo(0,0); }} className={\`flex flex-col items-center gap-1 \${activeTab === 'parking' ? 'text-primary' : 'text-on-surface-variant'}\`}>
          <span className="material-symbols-outlined text-2xl" data-weight={activeTab === 'parking' ? 'fill' : 'normal'}>account_balance</span>
          <span className="text-[10px] font-bold text-center">금리 비교</span>
        </button>
        <button onClick={() => setShowSettings(!showSettings)} className={\`flex flex-col items-center gap-1 \${showSettings ? 'text-primary' : 'text-on-surface-variant'}\`}>
          <span className="material-symbols-outlined text-2xl" data-weight={showSettings ? 'fill' : 'normal'}>person</span>
          <span className="text-[10px] font-bold text-center">내 정보</span>
        </button>
      </div>

      {/* Modal Rendering */}
      <IpoModal ipo={selectedIpo} aliases={aliases} onClose={() => setSelectedIpo(null)} onToggleIpo={handleToggleIpo} />

      {/* FAB */}
      {(selectedProvider || selectedStatus === "참여 목록" || selectedStatus === "마감 임박") && (
         <button onClick={() => {setSelectedProvider(null); setSelectedStatus("전체 보기");}} className="fixed bottom-20 md:bottom-8 right-6 md:right-8 w-14 h-14 bg-surface-container-highest text-on-surface rounded-full shadow-2xl flex items-center justify-center z-40 active:scale-95 transition-all hover:scale-105 hover:bg-surface-bright border border-white/10">
           <span className="material-symbols-outlined">arrow_back</span>
         </button>
      )}

      {/* Global Toast */}
      {toast.visible && (
        <div className="fixed bottom-24 md:bottom-8 left-1/2 -translate-x-1/2 bg-surface-container-highest text-on-surface px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 z-50 animate-in slide-in-from-bottom-8 border border-white/10 w-[90%] md:w-auto text-center justify-center">
          <span className={\`material-symbols-outlined \${toast.type==='success'?'text-primary':'text-error'}\`}>
            {toast.type==='success'?'check_circle':'error'}
          </span>
          <span className="font-medium text-sm">{toast.message}</span>
        </div>
      )}
    </>
  );
}

export default App;`;

    lines.splice(cutIdx, endIdx - cutIdx + 1, bottomContent);
    content = lines.join('\n');
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Successfully stabilized the bottom part of App.jsx.');
} else {
    console.error('Could not find </main> to cut from.');
}
