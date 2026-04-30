const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend/src/App.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add subscriptionSubTab state
content = content.replace(
    'const [activeTab, setActiveTab] = useState("landing");',
    'const [activeTab, setActiveTab] = useState("landing");\n  const [subscriptionSubTab, setSubscriptionSubTab] = useState("ipo"); // "ipo" or "apt"'
);

// 2. Update Header: Replace "공모주" and "아파트" with "청약"
const headerButtonsRegex = /<button[^>]*onClick=\{[^}]*setActiveTab\("ipo"\)[^>]*>공모주<\/button>\s*<button[^>]*onClick=\{[^}]*setActiveTab\("apt"\)[^>]*>아파트<\/button>/;
const newHeaderButton = `<button className={\`pb-1 font-headline transition-colors \${activeTab === 'subscription' ? 'text-primary border-b-2 border-primary' : 'text-[#ebedfb]/60 hover:text-[#ebedfb]'}\`} onClick={() => { setActiveTab("subscription"); setSubscriptionSubTab("ipo"); }}>청약</button>`;
content = content.replace(headerButtonsRegex, newHeaderButton);

// 3. Update Mobile Nav: Replace "공모주" and "아파트" with "청약"
const mobileIpoBtn = /<button onClick=\{\(\) => { setActiveTab\("ipo"\);[\s\S]*?<\/button>/;
const mobileAptBtn = /<button onClick=\{\(\) => { setActiveTab\("apt"\);[\s\S]*?<\/button>/;

const newMobileSubBtn = `        <button onClick={() => { setActiveTab("subscription"); setSubscriptionSubTab("ipo"); window.scrollTo(0,0); }} className={\`flex flex-col items-center gap-1 \${activeTab === 'subscription' ? 'text-primary' : 'text-on-surface-variant'}\`}>
          <span className="material-symbols-outlined text-2xl" data-weight={activeTab === 'subscription' ? 'fill' : 'normal'}>assignment</span>
          <span className="text-[10px] font-bold">청약</span>
        </button>`;

content = content.replace(mobileIpoBtn, newMobileSubBtn);
content = content.replace(mobileAptBtn, ''); // Remove the second button

// 4. Update Sidebar: Add "청약" section
const sidebarAptBlock = ") : activeTab === 'dashboard' ? (";
const subscriptionSidebarContent = `) : activeTab === 'subscription' ? (
            <>
              <p className="px-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-2 mt-4">청약 종류</p>
              <button 
                onClick={() => { setSubscriptionSubTab("ipo"); window.scrollTo(0,0); if (ipoEvents.length === 0) { setIpoLoading(true); fetchIpoEvents(session?.user?.id).then(d => { setIpoEvents(d); setIpoLoading(false); }).catch(() => setIpoLoading(false)); } }} 
                className={\`w-full text-left rounded-lg flex items-center gap-3 px-3 py-2.5 transition-all duration-300 \${subscriptionSubTab === 'ipo' ? 'bg-[#262c3a] text-[#73ffba] shadow-lg border border-white/5' : 'text-[#ebedfb]/70 hover:bg-[#262c3a]/30 hover:text-[#73ffba]'}\`}
              >
                <span className="material-symbols-outlined text-xl">calendar_month</span>
                <span className="font-medium text-sm">공모주 일정</span>
              </button>
              <button 
                onClick={() => { setSubscriptionSubTab("apt"); window.scrollTo(0,0); if (aptEvents.length === 0) { setAptLoading(true); fetchAptSubscriptions().then(d => { setAptEvents(d); setAptLoading(false); }).catch(() => setAptLoading(false)); } }} 
                className={\`w-full text-left rounded-lg flex items-center gap-3 px-3 py-2.5 transition-all duration-300 \${subscriptionSubTab === 'apt' ? 'bg-[#262c3a] text-[#73ffba] shadow-lg border border-white/5' : 'text-[#ebedfb]/70 hover:bg-[#262c3a]/30 hover:text-[#73ffba]'}\`}
              >
                <span className="material-symbols-outlined text-xl">home_work</span>
                <span className="font-medium text-sm">아파트 청약</span>
              </button>
            </>
          `;
content = content.replace(sidebarAptBlock, subscriptionSidebarContent + sidebarAptBlock);

// 5. Update Main Content Switch
const mainContentIpoAptRegex = /activeTab === "ipo" \? \([\s\S]*?\) : activeTab === "apt" \? \([\s\S]*?\)/;
const newMainContentSubscription = `activeTab === "subscription" ? (
          subscriptionSubTab === "ipo" ? (
            ipoLoading ? (
              <div className="py-20 flex flex-col items-center justify-center"><div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div></div>
            ) : (
              <IpoCalendar ipoEvents={ipoEvents} onSelectIpo={setSelectedIpo} />
            )
          ) : (
            aptLoading ? (
              <div className="py-20 flex flex-col items-center justify-center"><div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div></div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 animate-in fade-in py-6 md:py-12">
                {(() => {
                  const filteredApts = aptEvents.filter(apt => {
                    const matchesSearch = apt.house_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                        apt.location.toLowerCase().includes(searchQuery.toLowerCase());
                    return matchesSearch;
                  });
                  
                  if (filteredApts.length === 0) {
                    return (
                      <div className="col-span-full py-32 flex flex-col items-center justify-center text-center animate-in fade-in">
                        <div className="w-24 h-24 rounded-full bg-surface-container flex items-center justify-center mb-6">
                          <span className="material-symbols-outlined text-6xl text-outline-variant">home_work</span>
                        </div>
                        <p className="text-on-surface-variant">현재 예정된 아파트 청약 일정이 없습니다.</p>
                      </div>
                    );
                  }
                  return filteredApts.map(apt => (
                    <AptCard key={apt.id} apt={apt} />
                  ));
                })()}
              </div>
            )
          )`;

content = content.replace(mainContentIpoAptRegex, newMainContentSubscription);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully merged IPO and Apartment into Subscription tab.');
