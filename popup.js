const messages = {
  bookmarked: { en: 'Bookmarked', zh: '已收藏' },
  unbookmarked: { en: 'Removed', zh: '已取消收藏' },
  cannotGetPage: { en: 'Cannot get page', zh: '无法获取页面' },
  pageNotSupported: { en: 'Page not supported', zh: '不支持此页面' }
};

let userLang = 'auto';

function getEffectiveLang() {
  if (userLang === 'auto') {
    const browserLang = chrome.i18n.getUILanguage() || navigator.language || 'en';
    return browserLang.startsWith('zh') ? 'zh' : 'en';
  }
  return userLang.startsWith('zh') ? 'zh' : 'en';
}

function i18n(key) {
  const lang = getEffectiveLang();
  return messages[key] ? messages[key][lang] : key;
}

function showToast(type, msgKey) {
  const icon = document.getElementById('toastIcon');
  const textEl = document.getElementById('toastText');
  const container = document.querySelector('.toast-container');
  
  container.className = 'toast-container';
  
  if (type === 'success') {
    icon.innerHTML = '✓';
    container.classList.add('toast-success');
  } else if (type === 'remove') {
    icon.innerHTML = '✕';
    container.classList.add('toast-remove');
  } else {
    icon.innerHTML = '⋯';
    container.classList.add('toast-loading');
  }
  
  textEl.textContent = i18n(msgKey);
  
  setTimeout(() => window.close(), 800);
}

function generateGroupId() {
  return 'grp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
}

chrome.storage.local.get({ language: 'auto' }, function(settings) {
  userLang = settings.language;
  
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
  const tab = tabs[0];
  if (!tab || !tab.url) {
    showToast('remove', 'cannotGetPage');
    return;
  }

  if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
    showToast('remove', 'pageNotSupported');
    return;
  }

  chrome.storage.local.get({ bookmarks: [], groups: [], deletedUrls: {} }, function(data) {
    const bookmarks = data.bookmarks;
    const groups = data.groups || [];
    const deletedUrls = data.deletedUrls || {};
    const idx = bookmarks.findIndex(b => b.url === tab.url);
    
    if (idx !== -1) {
      const removed = bookmarks.splice(idx, 1)[0];
      deletedUrls[removed.url] = Date.now();
      chrome.storage.local.set({ bookmarks, deletedUrls }, function() {
        showToast('remove', 'unbookmarked');
      });
    } else {
      const favicon = tab.favIconUrl || '';
      const newUrlHostname = (new URL(tab.url)).hostname;
      let targetGroupId = '';
      let targetGroupName = newUrlHostname;

      for (const existingB of bookmarks) {
        try {
          const existingHostname = (new URL(existingB.url)).hostname;
          if (existingHostname === newUrlHostname) {
            targetGroupId = existingB.groupId || '';
            targetGroupName = existingB.group || newUrlHostname;
            break;
          }
        } catch (e) {}
      }

      if (!targetGroupId) {
        let existingGroup = groups.find(g => g.name === targetGroupName);
        if (!existingGroup) {
          existingGroup = { id: generateGroupId(), name: targetGroupName, updatedAt: Date.now() };
          groups.push(existingGroup);
        }
        targetGroupId = existingGroup.id;
      }

      bookmarks.push({
        id: Date.now() + Math.random().toString(36).substr(2, 5),
        url: tab.url,
        title: tab.title,
        favicon,
        groupId: targetGroupId,
        group: targetGroupName,
        tags: [],
        clickCount: 1,
        lastActiveAt: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
      
      chrome.storage.local.set({ bookmarks, groups }, function() {
        showToast('success', 'bookmarked');
      });
    }
  });
  });
});
