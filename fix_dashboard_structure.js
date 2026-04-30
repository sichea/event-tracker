const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend/src/App.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Remove the misplaced </\> at line 2491 (approx)
// It's after the closing tag of the health system section.
content = content.replace('              </section>\n            </>\n          ) : (', '              </section>\n          ) : (');

// 2. Fix the ending tags at the end of the dashboard/main content
// We need to match the sequence of closing tags.
// Currently it might be:
//                 </div>
//               )}
//             </div>
//           )
//         )}
//         </>
//         )}

const oldEnd = '                </div>\n              )}\n            </div>\n          )\n        )}\n        </>\n        )}';
const newEnd = '                </div>\n              )}\n            </div>\n          )\n        )}\n      </>\n    )}';

if (content.indexOf(oldEnd) !== -1) {
    content = content.replace(oldEnd, newEnd);
    console.log('Successfully fixed the main content closing tags.');
} else {
    // If exact match fails, let's try a more general cleanup
    console.log('Exact end match failed, performing targeted fixes.');
    content = content.replace('        </>\n        )}', '      </>\n    )}');
}

fs.writeFileSync(filePath, content, 'utf8');
