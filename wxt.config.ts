import { defineConfig } from 'wxt';

const notebookHosts = [
  'https://notebooklm.google.com/*',
  'https://notebook.google.com/*',
  'https://*.usercontent.goog/*',
];

export default defineConfig({
  srcDir: '.',
  manifest: {
    name: 'Satchel',
    description: 'Pack NotebookLM flashcards into Anki-ready CSV.',
    version: '0.1.0',
    permissions: ['scripting', 'clipboardWrite', 'webNavigation', 'activeTab'],
    host_permissions: notebookHosts,
    action: {
      default_title: 'Satchel',
    },
    icons: {
      16: 'icon.svg',
      48: 'icon.svg',
      128: 'icon.svg',
    },
  },
});
