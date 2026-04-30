const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend/src/App.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Restore EventCard's missing parts and remove AptCard
// We need to find the broken part and replace it with the correct code.
// The broken part starts around: onChange={() => onToggle(event.id, alias.id, isChecked)} 

const brokenPartStart = 'onChange={() => onToggle(event.id, alias.id, isChecked)}';
const brokenPartEnd = '// ============ Ipo Modal Component ============';

// Correct code for the end of EventCard
const restoredEventCardTail = `                    disabled={!isActive}
                  />
                  <div className="w-4 h-4 md:w-5 md:h-5 rounded border border-outline-variant group-hover:border-primary peer-checked:bg-primary peer-checked:border-primary transition-all flex items-center justify-center">
                    {isChecked && <span className="material-symbols-outlined text-[10px] md:text-[14px] text-on-primary font-bold">check</span>}
                  </div>
                </div>
                <span className={`text-xs md:text-sm font-medium transition-colors \${isChecked ? 'text-primary' : 'text-on-surface-variant group-hover:text-on-surface'}`}>{alias.name}</span>
              </label>
            );
          })
        )}
      </div>
    </div>
  );
}

`;

// We will find the index of brokenPartStart and brokenPartEnd and replace everything in between.
const startIndex = content.indexOf(brokenPartStart);
const endIndex = content.indexOf(brokenPartEnd);

if (startIndex !== -1 && endIndex !== -1) {
    const before = content.substring(0, startIndex + brokenPartStart.length + 1);
    const after = content.substring(endIndex);
    content = before + restoredEventCardTail + after;
    console.log('Restored EventCard and removed broken AptCard section.');
} else {
    console.error('Could not find broken indices.');
}

// 2. Ensure Imports are correct
if (!content.includes('import AptCalendar from "./AptCalendar";')) {
    content = content.replace('import LandingPage from "./LandingPage";', 'import LandingPage from "./LandingPage";\nimport AptCalendar from "./AptCalendar";');
    console.log('Added AptCalendar import.');
}

// 3. Update Apartment section in App component to use AptCalendar
// Find the apartment section in the render logic
const aptSectionOld = `{subscriptionSubTab === "ipo" ? (
              <IpoCalendar 
                ipoEvents={ipoEvents} 
                onSelectIpo={setSelectedIpo} 
                aliases={aliases}
                onToggleIpo={handleToggleIpo}
              />
            ) : (
              aptLoading ? (
                <div className="py-20 flex flex-col items-center justify-center"><div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div></div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 animate-in fade-in py-6 md:py-12">
                  {(() => {
                    const name = apt.name || "";
                    const region = apt.region || "";
                    const matchesSearch = name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                        region.toLowerCase().includes(searchQuery.toLowerCase());
                    return matchesSearch;
                  });
                  
                  if (filteredApts.length === 0) {
                    return (
                      <div className="col-span-full py-32 flex flex-col items-center justify-center text-center animate-in fade-in">
                        <div className="w-24 h-24 rounded-full bg-surface-container flex items-center justify-center mb-6">
                          <span className="material-symbols-outlined text-6xl text-outline-variant">home_work</span>
                        </div>
                        <p className="text-on-surface-variant">검색 결과가 없습니다.</p>
                      </div>
                    );
                  }
                  return filteredApts.map(apt => (
                    <AptCard key={apt.id} apt={apt} />
                  ));
                })()}
                </div>
              )
            )}`;

// This search might fail due to previous manual edits. Let's use a more robust search.
const aptSearch = 'subscriptionSubTab === "ipo" ?';
const aptIndex = content.indexOf(aptSearch);

if (aptIndex !== -1) {
    // We need to replace the entire ternary content for the apartment part.
    // Let's use a simpler replacement for the whole subscription block if possible.
    
    // Find the end of the apartment block (it should end with ) ) before activeTab === "parking" or similar
    // Actually, I'll just replace the specific section from the subscriptionSubTab === "ipo" ? (...) : (...) block.
}

fs.writeFileSync(filePath, content, 'utf8');
