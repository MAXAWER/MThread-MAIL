const fs = require('fs');
let content = fs.readFileSync('index.html', 'utf-8');

const replacements = [
  [/onclick="window\.location\.reload\(\)"/g, 'id="logo-btn"'],
  [/onclick="switchTab\('dm'\)"/g, ''],
  [/onclick="switchTab\('groups'\)"/g, ''],
  [/onclick="showSettings\(\)"/g, 'id="sidebar-profile-btn"'],
  [/onclick="openCreateGroupModal\(\)"/g, ''],
  [/onclick="toggleMobileChat\(true\)"/g, ''],
  [/onclick="toggleMobileChat\(false\)"/g, 'id="mob-back-btn"'],
  [/onclick="openGroupSettings\(\)"/g, ''],
  [/onclick="document\.getElementById\('chat-image-input'\)\.click\(\)"/g, 'id="chat-attach-btn"'],
  [/onclick="showStep\('step-register'\)"/g, 'id="to-register-btn"'],
  [/onclick="showStep\('step-login'\)"/g, 'id="to-login-btn"'],
  [/onclick="closeSettings\(\)"/g, 'id="close-settings-btn"'],
  [/onclick="document\.getElementById\('avatar-upload-input'\)\.click\(\)"/g, 'id="avatar-upload-trigger"'],
  [/onclick="firebase\.auth\(\)\.signOut\(\)"/g, 'id="settings-logout-btn"'],
  [/onclick="closeCreateGroupModal\(\)"/g, 'id="close-create-group-btn"'],
  [/onclick="closeGroupSettings\(\)"/g, 'id="close-group-settings-btn"'],
  [/onclick="deleteEntireGroupFromSettings\(\)"/g, ''],
  [/onclick="saveGroupSettings\(\)"/g, '']
];

replacements.forEach(([pattern, replacement]) => {
  content = content.replace(pattern, replacement);
});

// Since mob-nav-profile replaces showSettings() but sidebar-profile-btn already did, let's fix it by adding ID to mob nav profile manually
// Wait, the regex replaces globally. Let's fix the duplicates.
// Instead of simple string replace, let's just write the specific tags correctly or add a class.
// A simpler way: we'll just fix app.js to bind by ID, and here we just replace them globally, and then fix duplicates.
// Actually, since I used global replace for showSettings(), both will get id="sidebar-profile-btn". That's invalid HTML.
// Let's do it right.
content = content.replace('<button class="text-on-surface-variant flex flex-col items-center gap-1 ripple-container p-2 rounded-xl" id="sidebar-profile-btn">', '<button class="text-on-surface-variant flex flex-col items-center gap-1 ripple-container p-2 rounded-xl" id="mob-nav-profile">');

fs.writeFileSync('index.html', content);
