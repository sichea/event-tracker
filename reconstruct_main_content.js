const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend/src/App.jsx');
let content = fs.readFileSync(filePath, 'utf8');

const lines = content.split('\n');

// We will replace the entire block from line 2293 to 2507
// Line 2293 starts with "{activeTab === \"landing\" ? ("
// Line 2507 ends with ")}" (or similar)

const startIdx = 2292; // 2293rd line
const endIdx = 2506;   // 2507th line

const newMainContent = `        {activeTab === "landing" ? (
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
        ) : activeTab === "insights" ? (
          <InvestmentInsights subTab={insightSubTab} />
        ) : activeTab === "subscription" ? (
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
          )
        ) : activeTab === "parking" ? (
          <ParkingCmaComparison parkingFilter={parkingFilter} />
        ) : (
          <>
            {/* Dashboard Header */}
            <div className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div>
                <h1 className="text-4xl lg:text-5xl font-extrabold tracking-tighter text-on-surface font-headline mb-2">
                  {selectedProvider ? \`\${PROVIDERS.find(p=>p.key===selectedProvider)?.name} 이벤트\` : "이벤트"}
                </h1>
                <p className="text-on-surface-variant max-w-xl italic">미래의 내가 보낸 수익 시그널을 확인하세요.</p>
              </div>
            </div>

            {/* Status Filters - Main View */}
            <div className="flex flex-wrap items-center gap-3 mb-10 bg-surface-container/30 p-4 rounded-3xl border border-white/5">
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

            <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6 mb-8">
              {/* Registered Accounts */}
              <div className="bg-surface-container border border-white/5 rounded-2xl md:rounded-3xl p-4 md:p-6 relative overflow-hidden group">
                <div className="absolute -right-2 -top-2 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity">
                  <span className="material-symbols-outlined text-6xl md:text-8xl">account_balance_wallet</span>
                </div>
                <p className="text-[10px] md:text-sm font-bold text-on-surface-variant mb-1 uppercase tracking-wider">등록 계좌</p>
                <h3 className="text-2xl md:text-4xl font-extrabold text-on-surface font-headline">{aliases.length}<span className="text-xs md:text-base ml-1 opacity-50 font-medium">개</span></h3>
              </div>

              {/* Active Events */}
              <div className="bg-surface-container border border-white/5 rounded-2xl md:rounded-3xl p-4 md:p-6 relative overflow-hidden group">
                <div className="absolute -right-2 -top-2 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity">
                  <span className="material-symbols-outlined text-6xl md:text-8xl">bolt</span>
                </div>
                <p className="text-[10px] md:text-sm font-bold text-on-surface-variant mb-1 uppercase tracking-wider">진행중 이벤트</p>
                <h3 className="text-2xl md:text-4xl font-extrabold text-on-surface font-headline">{activeEventsCount}</h3>
                <p className="mt-1 md:mt-2 text-[9px] md:text-xs text-primary flex items-center gap-1">
                  <span className="material-symbols-outlined text-[12px] md:text-[14px]">sync</span>
                  {scrapingStatus?.last_run ? new Date(scrapingStatus.last_run).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '오늘'}
                </p>
              </div>

              {/* Participation Rate */}
              <div className="bg-surface-container border border-white/5 rounded-2xl md:rounded-3xl p-4 md:p-6 relative overflow-hidden group">
                <div className="absolute -right-2 -top-2 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity">
                  <span className="material-symbols-outlined text-6xl md:text-8xl">analytics</span>
                </div>
                <p className="text-[10px] md:text-sm font-bold text-on-surface-variant mb-1 uppercase tracking-wider">참여율</p>
                <h3 className="text-2xl md:text-4xl font-extrabold text-primary font-headline">{checkPercent}%</h3>
                <div className="mt-2 md:mt-4 w-full bg-surface-container-highest rounded-full h-1 md:h-1.5 overflow-hidden">
                  <div className="bg-primary h-full rounded-full shadow-[0_0_8px_#73ffba] transition-all duration-1000" style={{width: \`\${checkPercent}%\`}}></div>
                </div>
              </div>

              {/* Closing Soon */}
              <div className="bg-surface-container border border-white/5 rounded-2xl md:rounded-3xl p-4 md:p-6 relative overflow-hidden group border-primary/10">
                <div className="absolute -right-2 -top-2 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity">
                  <span className="material-symbols-outlined text-6xl md:text-8xl text-tertiary">notification_important</span>
                </div>
                <p className="text-[10px] md:text-sm font-bold text-on-surface-variant mb-1 uppercase tracking-wider">마감 임박</p>
                <h3 className="text-2xl md:text-4xl font-extrabold text-tertiary font-headline">{upcomingEvents}</h3>
                <p className="mt-1 md:mt-2 text-[9px] md:text-xs text-tertiary/70">3일 이내 종료</p>
              </div>
            </section>

            {loading && events.length === 0 ? (
              <div className="py-20 flex flex-col items-center justify-center"><div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div></div>
            ) : (
              (selectedProvider === null && (selectedStatus === "전체 보기" || selectedStatus === "전체 이벤트")) && !searchQuery ? (
                <section className="mt-12 grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-2 bg-surface-container border border-white/5 rounded-3xl p-8 overflow-hidden relative">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -mr-32 -mt-32"></div>
                    <h3 className="text-2xl font-bold mb-6 font-headline flex items-center gap-3">
                      <span className="material-symbols-outlined text-primary" data-weight="fill">bolt</span> 최근 활동 알림
                    </h3>
                    <div className="space-y-6">
                      {uniqueEvents.slice(0,3).map((ev, i) => (
                        <div key={ev.id} className="flex gap-4 items-start">
                          <div className={\`w-2 h-2 rounded-full mt-2 \${i===0?'bg-primary shadow-[0_0_8px_#73ffba]':'bg-outline-variant'}\`}></div>
                          <div className="flex-1 cursor-pointer hover:underline" onClick={() => {if(ev.link) window.open(ev.link, '_blank')}}>
                            <p className="text-on-surface font-medium line-clamp-1">{i===0?'신규':'발견'} {ev.provider} 이벤트: '{ev.title}'</p>
                            <p className="text-xs text-on-surface-variant mt-1">{formatDateRange(ev.start_date, ev.end_date)} • {ev.provider} ETF</p>
                          </div>
                          {i === 0 && <span className="text-[10px] uppercase font-bold text-on-surface-variant bg-surface-container-highest px-2 py-0.5 rounded">NEW</span>}
                          {i === 2 && <span className="material-symbols-outlined text-primary text-sm">verified</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="bg-surface-container border border-white/5 rounded-3xl p-8 flex flex-col justify-between">
                    <div>
                      <h3 className="text-2xl font-bold mb-2 font-headline">시스템 건전성</h3>
                      <p className="text-sm text-on-surface-variant mb-8">안전한 데이터 수집 및 보안 상태입니다.</p>
                      <div className="flex items-center justify-center py-10 relative">
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-32 h-32 rounded-full border-4 border-primary/10 border-t-primary border-l-primary/50 animate-[spin:5s_linear_infinite]"></div>
                        </div>
                        <div className="text-center z-10">
                          <p className="text-4xl font-black text-on-surface font-headline">{scrapingStatus?.status === 'success' || scrapingStatus?.status === '성공' ? '99.8%' : '90.2%'}</p>
                          <p className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold">안전함</p>
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-surface-container-highest p-4 rounded-2xl text-center">
                        <p className="text-[10px] uppercase font-bold text-on-surface-variant mb-1">API 상태</p>
                        <p className="text-sm font-bold text-primary">{scrapingStatus?.status === 'failed' ? '오류' : '안정'}</p>
                      </div>
                      <div className="bg-surface-container-highest p-4 rounded-2xl text-center">
                        <p className="text-[10px] uppercase font-bold text-on-surface-variant mb-1">응답 속도</p>
                        <p className="text-sm font-bold text-on-surface">최적</p>
                      </div>
                    </div>
                  </div>
                </section>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 animate-in fade-in">
                  {displayEvents.length > 0 ? displayEvents.map(e => (
                    <EventCard key={e.id} event={e} aliases={aliases} onToggle={handleToggle} showToastMsg={showToastMsg} />
                  )) : (
                    <div className="col-span-full py-20 text-center text-on-surface-variant">
                      <span className="material-symbols-outlined text-5xl mb-4 opacity-50">filter_list_off</span>
                      <p>해당 조건의 이벤트가 없습니다.</p>
                    </div>
                  )}
                </div>
              )
            )}
          </>
        )}`;

lines.splice(startIdx, endIdx - startIdx + 1, newMainContent);
content = lines.join('\n');
fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully reconstructed the main content block.');
