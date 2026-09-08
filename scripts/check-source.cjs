const fs = require('fs');
const path = require('path');
const app = process.argv[2];
if (!app) throw new Error('Missing app path');
const required = [
  'src/features/auth/LoginScreen.tsx',
  'src/features/activity/ActivityView.tsx',
  'src/features/chat/ChatView.tsx',
  'src/features/emoji/EmojiView.tsx',
  'src/features/home/HomeView.tsx',
  'src/features/invites/InvitesView.tsx',
  'src/features/notes/NotesView.tsx',
  'src/features/roles/RolesView.tsx',
  'src/features/overview/WorkspaceOverview.tsx',
  'src/features/account/PersonalSettings.tsx',
  'src/features/support/SupportConsole.tsx',
  'src/features/staff/StaffView.tsx',
  'src/features/members/MembersView.tsx',
  'src/features/settings/SettingsView.tsx',
  'src/features/shell/AppShell.tsx',
  'src/styles/standalone-v18.css'
];
const missing = required.filter(rel => !fs.existsSync(path.join(app, rel)));
if (missing.length) {
  console.error('[ERROR] Missing restored source files:');
  for (const f of missing) console.error('  ' + f);
  process.exit(1);
}
console.log(`[OK] Required source files present (${required.length}/${required.length}).`);
