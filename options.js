let currentLang = 'auto';
let currentTheme = 'light';

const messages = {
  en: {},
  zh_CN: {}
};

async function loadMessages() {
  try {
    const [enRes, zhRes] = await Promise.all([
      fetch(chrome.runtime.getURL('_locales/en/messages.json')),
      fetch(chrome.runtime.getURL('_locales/zh_CN/messages.json'))
    ]);
    messages.en = await enRes.json();
    messages.zh_CN = await zhRes.json();
  } catch (e) {
    console.error('Failed to load messages:', e);
  }
}

function getEffectiveLang() {
  if (currentLang === 'auto') {
    const browserLang = navigator.language || navigator.userLanguage;
    if (browserLang.startsWith('zh')) return 'zh_CN';
    return 'en';
  }
  return currentLang;
}

function i18n(key) {
  const lang = getEffectiveLang();
  const msg = messages[lang]?.[key]?.message || messages.en?.[key]?.message || key;
  return msg;
}

function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    el.textContent = i18n(key);
  });
}

function applyTheme(theme) {
  let effectiveTheme = theme;
  if (theme === 'auto') {
    effectiveTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  
  if (effectiveTheme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
  
  document.querySelectorAll('.theme-option').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.theme === theme);
  });
}

function showToast(message, type = '') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = 'toast show ' + type;
  
  setTimeout(() => {
    toast.classList.remove('show');
  }, 2000);
}

function loadSettings() {
  chrome.storage.local.get({
    lang: 'auto',
    theme: 'light',
    viewMode: 'card',
    sortMode: 'recent'
  }, (data) => {
    currentLang = data.lang;
    currentTheme = data.theme;
    
    document.getElementById('langSelect').value = data.lang;
    document.getElementById('defaultView').value = data.viewMode;
    document.getElementById('defaultSort').value = data.sortMode;
    
    applyTheme(data.theme);
    applyI18n();
  });
}

function saveSettings(key, value) {
  chrome.storage.local.set({ [key]: value }, () => {
    showToast(i18n('saved'), 'success');
  });
}

function exportBookmarks() {
  chrome.storage.local.get({ bookmarks: [], groupOrder: [] }, (data) => {
    const exportData = {
      bookmarks: data.bookmarks,
      groupOrder: data.groupOrder,
      exportedAt: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quickmark-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    showToast(i18n('exportSuccess'), 'success');
  });
}

function importBookmarks() {
  document.getElementById('importFile').click();
}

function handleImport(e) {
  const file = e.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const parsed = JSON.parse(event.target.result);
      
      let importedBookmarks = [];
      let groupOrder = [];
      
      if (Array.isArray(parsed)) {
        importedBookmarks = parsed;
      } else if (parsed.bookmarks && Array.isArray(parsed.bookmarks)) {
        importedBookmarks = parsed.bookmarks;
        groupOrder = parsed.groupOrder || [];
      } else {
        throw new Error('Invalid format');
      }
      
      if (importedBookmarks.length === 0) {
        throw new Error('No bookmarks found');
      }
      
      chrome.storage.local.get({ bookmarks: [], groupOrder: [] }, (existing) => {
        const existingUrls = new Set(existing.bookmarks.map(b => b.url));
        const newBookmarks = importedBookmarks.filter(b => b.url && !existingUrls.has(b.url));
        const merged = [...existing.bookmarks, ...newBookmarks];
        
        const mergedGroupOrder = groupOrder.length > 0 ? groupOrder : existing.groupOrder;
        
        chrome.storage.local.set({ 
          bookmarks: merged,
          groupOrder: mergedGroupOrder
        }, () => {
          showToast(i18n('importSuccess').replace('{count}', newBookmarks.length), 'success');
        });
      });
    } catch (err) {
      console.error('Import error:', err);
      showToast(i18n('importFailed'), 'error');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
}

function clearAllData() {
  if (confirm(i18n('confirmClearAll'))) {
    chrome.storage.local.clear(() => {
      showToast(i18n('dataCleared'), 'success');
      setTimeout(() => location.reload(), 1000);
    });
  }
}

async function init() {
  await loadMessages();
  loadSettings();
  
  document.getElementById('themeSelector').addEventListener('click', (e) => {
    const btn = e.target.closest('.theme-option');
    if (!btn) return;
    
    const theme = btn.dataset.theme;
    currentTheme = theme;
    applyTheme(theme);
    saveSettings('theme', theme);
  });
  
  document.getElementById('langSelect').addEventListener('change', (e) => {
    currentLang = e.target.value;
    saveSettings('lang', currentLang);
    applyI18n();
  });
  
  document.getElementById('defaultView').addEventListener('change', (e) => {
    saveSettings('viewMode', e.target.value);
  });
  
  document.getElementById('defaultSort').addEventListener('change', (e) => {
    saveSettings('sortMode', e.target.value);
  });
  
  document.getElementById('exportBtn').addEventListener('click', exportBookmarks);
  document.getElementById('importBtn').addEventListener('click', importBookmarks);
  document.getElementById('importFile').addEventListener('change', handleImport);
  document.getElementById('clearBtn').addEventListener('click', clearAllData);
  
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (currentTheme === 'auto') {
      applyTheme('auto');
    }
  });
}

document.addEventListener('DOMContentLoaded', init);
