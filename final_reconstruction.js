const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend/src/App.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Fix EventCard tail
const brokenPartStart = 'onChange={() => onToggle(event.id, alias.id, isChecked)}';
const brokenPartEnd = '// ============ Ipo Modal Component ============';

const restoredEventCardTail = `
                    disabled={!isActive}
                  />
                  <div className="w-4 h-4 md:w-5 md:h-5 rounded border border-outline-variant group-hover:border-primary peer-checked:bg-primary peer-checked:border-primary transition-all flex items-center justify-center">
                    {isChecked && <span className="material-symbols-outlined text-[10px] md:text-[14px] text-on-primary font-bold">check</span>}
                  </div>
                </div>
                <span className={\`text-xs md:text-sm font-medium transition-colors \${isChecked ? 'text-primary' : 'text-on-surface-variant group-hover:text-on-surface'}\`}>{alias.name}</span>
              </label>
            );
          })
        )}
      </div>
    </div>
  );
}

`;

const startIndex = content.indexOf(brokenPartStart);
const endIndex = content.indexOf(brokenPartEnd);

if (startIndex !== -1 && endIndex !== -1) {
    const before = content.substring(0, startIndex + brokenPartStart.length + 1);
    const after = content.substring(endIndex);
    content = before + restoredEventCardTail + after;
    console.log('Restored EventCard tail.');
}

// 2. Ensure Import
if (!content.includes('import AptCalendar from "./AptCalendar";')) {
    content = content.replace('import LandingPage from "./LandingPage";', 'import LandingPage from "./LandingPage";\nimport AptCalendar from "./AptCalendar";');
    console.log('Added AptCalendar import.');
}

// 3. Update Apartment section to use AptCalendar
const aptSectionOldStart = 'subscriptionSubTab === "ipo" ? (';
const aptSectionOldEnd = 'activeTab === "parking" ? (';

// We'll replace everything between these two markers to be safe
const sIndex = content.indexOf(aptSectionOldStart);
const eIndex = content.indexOf(aptSectionOldEnd);

if (sIndex !== -1 && eIndex !== -1) {
    const before = content.substring(0, sIndex);
    const after = content.substring(eIndex);
    
    const newSubscriptionSection = `subscriptionSubTab === "ipo" ? (
            ipoLoading ? (
              <div className="py-20 flex flex-col items-center justify-center"><div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div></div>
            ) : (
              <IpoCalendar 
                ipoEvents={ipoEvents} 
                onSelectIpo={setSelectedIpo} 
                aliases={aliases}
                onToggleIpo={handleToggleIpo}
              />
            )
          ) : (
            aptLoading ? (
              <div className="py-20 flex flex-col items-center justify-center"><div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div></div>
            ) : (
              <AptCalendar aptEvents={aptEvents} searchQuery={searchQuery} />
            )
          )
        ) : `;
    
    content = before + newSubscriptionSection + after;
    console.log('Updated Apartment section to use AptCalendar.');
}

fs.writeFileSync(filePath, content, 'utf8');
