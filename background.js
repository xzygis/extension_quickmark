const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCPJVkFAE9QVXyit0Bm5SEUFdCoGtA5kVA",
  authDomain: "qubittool.firebaseapp.com",
  projectId: "qubittool",
  storageBucket: "qubittool.firebasestorage.app",
  messagingSenderId: "169990336049",
  appId: "1:169990336049:web:7a0812b54db215caa5af10"
};

const CHROME_CLIENT_ID = "169990336049-2qbinsm16kduu9f5k1uq514103gujf1b.apps.googleusercontent.com";
const WEB_CLIENT_ID = "169990336049-dtvmv1si491fnnu3sf5g334coooeg02c.apps.googleusercontent.com";
const FIRESTORE_BASE_URL = `https://firestore.googleapis.com/v1/projects/${FIREBASE_CONFIG.projectId}/databases/(default)/documents`;
const SYNC_ALARM_NAME = 'quickmark-daily-sync';
const SYNC_INTERVAL_MINUTES = 60 * 12;

let currentUser = null;
let idToken = null;

function isEdgeBrowser() {
  return navigator.userAgent.includes('Edg/');
}

function generateGroupId() {
  return 'grp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
}

async function migrateToGroupIds() {
  const data = await chrome.storage.local.get(['bookmarks', 'groups', 'groupOrder', 'pinnedGroups', 'collapsedGroups', 'dataMigrationVersion']);
  
  if (data.dataMigrationVersion >= 2) return;
  
  const bookmarks = data.bookmarks || [];
  const groups = data.groups || [];
  const groupOrder = data.groupOrder || [];
  const pinnedGroups = data.pinnedGroups || [];
  const collapsedGroups = data.collapsedGroups || [];
  
  const needsMigration = bookmarks.some(b => !b.groupId && b.group);
  const orderNeedsMigration = groupOrder.length > 0 && groupOrder.some(g => !g.startsWith('grp_'));
  
  if (!needsMigration && !orderNeedsMigration) {
    await chrome.storage.local.set({ dataMigrationVersion: 2 });
    return;
  }
  
  const groupNameToId = new Map();
  groups.forEach(g => {
    if (g.name && g.id) groupNameToId.set(g.name, g.id);
  });
  
  const updatedGroups = [...groups];
  
  bookmarks.forEach(b => {
    if (b.groupId) return;
    const groupName = b.group || '';
    if (!groupName) return;
    
    let gId = groupNameToId.get(groupName);
    if (!gId) {
      gId = generateGroupId();
      groupNameToId.set(groupName, gId);
      updatedGroups.push({ id: gId, name: groupName, updatedAt: Date.now() });
    }
    b.groupId = gId;
  });
  
  const updatedGroupOrder = groupOrder.map(name => {
    if (name.startsWith('grp_')) return name;
    return groupNameToId.get(name) || name;
  });
  
  const updatedPinnedGroups = pinnedGroups.map(name => {
    if (name.startsWith('grp_')) return name;
    return groupNameToId.get(name) || name;
  });
  
  const updatedCollapsedGroups = collapsedGroups.map(name => {
    if (name.startsWith('grp_')) return name;
    return groupNameToId.get(name) || name;
  });
  
  await chrome.storage.local.set({
    bookmarks,
    groups: updatedGroups,
    groupOrder: updatedGroupOrder,
    pinnedGroups: updatedPinnedGroups,
    collapsedGroups: updatedCollapsedGroups,
    dataMigrationVersion: 2
  });
  
  console.log('[Migration] Migrated to group IDs:', {
    groupsCreated: updatedGroups.length - groups.length,
    bookmarksMigrated: bookmarks.filter(b => b.groupId).length
  });
}

chrome.runtime.onInstalled.addListener(() => {
  migrateToGroupIds();
  setupSyncAlarm();
  initAllTabsBadge();
});

chrome.runtime.onStartup.addListener(() => {
  migrateToGroupIds();
  setupSyncAlarm();
  initAllTabsBadge();
});

async function initAllTabsBadge() {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
      if (tab.id && tab.url) {
        updateTabBadge(tab.id, tab.url);
      }
    });
  });
}

function setupSyncAlarm() {
  chrome.alarms.get(SYNC_ALARM_NAME, (alarm) => {
    if (!alarm) {
      chrome.alarms.create(SYNC_ALARM_NAME, {
        delayInMinutes: 1,
        periodInMinutes: SYNC_INTERVAL_MINUTES
      });
    }
  });
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === SYNC_ALARM_NAME) {
    try {
      const user = await initAuth();
      if (user) {
        const stored = await chrome.storage.local.get(['autoSyncEnabled']);
        if (stored.autoSyncEnabled !== false) {
          console.log('[Sync Alarm] Performing scheduled sync...');
          await performSync();
          console.log('[Sync Alarm] Sync completed');
        }
      }
    } catch (err) {
      console.error('[Sync Alarm] Failed:', err);
    }
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'firebase_init') {
    initAuth().then(user => sendResponse({ user })).catch(err => sendResponse({ error: err.message }));
    return true;
  }
  
  if (request.action === 'firebase_signIn') {
    signInWithGoogle().then(user => sendResponse({ user })).catch(err => sendResponse({ error: err.message }));
    return true;
  }
  
  if (request.action === 'firebase_signOut') {
    signOut().then(() => sendResponse({ success: true })).catch(err => sendResponse({ error: err.message }));
    return true;
  }
  
  if (request.action === 'firebase_getCurrentUser') {
    sendResponse({ user: currentUser });
    return false;
  }
  
  if (request.action === 'firebase_performSync') {
    performSync().then(result => sendResponse({ result })).catch(err => sendResponse({ error: err.message }));
    return true;
  }
  
  if (request.action === 'firebase_shouldAutoSync') {
    shouldAutoSync().then(should => sendResponse({ should })).catch(err => sendResponse({ error: err.message }));
    return true;
  }
  
  if (request.action === 'firebase_clearCloud') {
    clearCloudData().then(() => sendResponse({ success: true })).catch(err => sendResponse({ error: err.message }));
    return true;
  }
});

async function initAuth() {
  const stored = await chrome.storage.local.get(['firebaseUser', 'firebaseToken', 'firebaseRefreshToken', 'tokenExpiry']);
  
  if (stored.firebaseUser) {
    currentUser = stored.firebaseUser;
  }
  
  const bufferTime = 5 * 60 * 1000;
  if (stored.firebaseUser && stored.firebaseToken && stored.tokenExpiry && stored.tokenExpiry > Date.now() + bufferTime) {
    idToken = stored.firebaseToken;
    return currentUser;
  }
  
  if (stored.firebaseRefreshToken && stored.firebaseUser) {
    try {
      console.log('[Auth] Token missing or expired, refreshing...');
      await refreshToken({ signOutOnAuthError: false });
      return currentUser;
    } catch (err) {
      console.warn('[Auth] Token refresh skipped during init:', err.message);
      return currentUser;
    }
  }
  
  return null;
}

async function signInWithGoogle() {
  if (isEdgeBrowser()) {
    return signInWithWebAuthFlow();
  }
  
  try {
    return await signInWithChromeIdentity();
  } catch (err) {
    console.log('[Auth] Chrome identity failed, falling back to web auth flow:', err.message);
    return signInWithWebAuthFlow();
  }
}

async function signInWithChromeIdentity() {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: true }, async (token) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      
      if (!token) {
        reject(new Error('No token received'));
        return;
      }
      
      try {
        const credential = await exchangeGoogleToken(token, false);
        resolve(credential);
      } catch (error) {
        reject(error);
      }
    });
  });
}

async function signInWithWebAuthFlow() {
  const redirectUri = chrome.identity.getRedirectURL();
  const scopes = ['openid', 'email', 'profile'].join(' ');
  
  console.log('[Auth] Redirect URI:', redirectUri);
  console.log('[Auth] Using Web Client ID for launchWebAuthFlow');
  
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', WEB_CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'token');
  authUrl.searchParams.set('scope', scopes);
  authUrl.searchParams.set('prompt', 'select_account');
  
  return new Promise((resolve, reject) => {
    chrome.identity.launchWebAuthFlow(
      { url: authUrl.toString(), interactive: true },
      async (responseUrl) => {
        if (chrome.runtime.lastError) {
          console.error('[Auth] WebAuthFlow error:', chrome.runtime.lastError.message);
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        
        if (!responseUrl) {
          reject(new Error('No response URL'));
          return;
        }
        
        try {
          const url = new URL(responseUrl);
          const hashParams = new URLSearchParams(url.hash.substring(1));
          const accessToken = hashParams.get('access_token');
          
          if (!accessToken) {
            reject(new Error('No access token in response'));
            return;
          }
          
          const credential = await exchangeGoogleToken(accessToken, true);
          resolve(credential);
        } catch (error) {
          reject(error);
        }
      }
    );
  });
}

async function exchangeGoogleToken(googleAccessToken, useWebAuthFlow = false) {
  const requestUri = useWebAuthFlow 
    ? chrome.identity.getRedirectURL()
    : `https://${chrome.runtime.id}.chromiumapp.org/`;
  
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=${FIREBASE_CONFIG.apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        postBody: `access_token=${googleAccessToken}&providerId=google.com`,
        requestUri: requestUri,
        returnIdpCredential: true,
        returnSecureToken: true
      })
    }
  );
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Authentication failed');
  }
  
  const data = await response.json();
  
  currentUser = {
    uid: data.localId,
    email: data.email,
    displayName: data.displayName || data.email?.split('@')[0],
    photoURL: data.photoUrl
  };
  idToken = data.idToken;
  
  const tokenExpiry = Date.now() + (parseInt(data.expiresIn) * 1000) - 60000;
  
  await chrome.storage.local.set({
    firebaseUser: currentUser,
    firebaseToken: idToken,
    firebaseRefreshToken: data.refreshToken,
    tokenExpiry: tokenExpiry
  });
  
  await ensureUserDocument();
  
  return currentUser;
}

function shouldSignOutAfterRefreshFailure(errorMessage) {
  const authFailureKeywords = [
    'INVALID_REFRESH_TOKEN',
    'INVALID_GRANT',
    'TOKEN_EXPIRED',
    'USER_DISABLED',
    'PROJECT_NUMBER_MISMATCH',
    'MISSING_REFRESH_TOKEN'
  ];
  return authFailureKeywords.some(keyword => errorMessage.includes(keyword));
}

async function refreshToken(options = {}) {
  const signOutOnAuthError = options.signOutOnAuthError !== false;
  const stored = await chrome.storage.local.get(['firebaseRefreshToken']);
  if (!stored.firebaseRefreshToken) {
    throw new Error('No refresh token available');
  }
  
  const response = await fetch(
    `https://securetoken.googleapis.com/v1/token?key=${FIREBASE_CONFIG.apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=refresh_token&refresh_token=${stored.firebaseRefreshToken}`
    }
  );
  
  if (!response.ok) {
    let errorMessage = 'Token refresh failed';
    try {
      const errorData = await response.json();
      if (errorData?.error?.message) {
        errorMessage = errorData.error.message;
      }
    } catch (e) {
      errorMessage = 'Token refresh failed';
    }
    
    if (signOutOnAuthError && shouldSignOutAfterRefreshFailure(errorMessage)) {
      await signOut();
    }
    throw new Error(errorMessage);
  }
  
  const data = await response.json();
  idToken = data.id_token;
  
  const tokenExpiry = Date.now() + (parseInt(data.expires_in) * 1000) - 60000;
  
  const userStored = await chrome.storage.local.get(['firebaseUser']);
  currentUser = userStored.firebaseUser;
  
  await chrome.storage.local.set({
    firebaseToken: idToken,
    firebaseRefreshToken: data.refresh_token,
    tokenExpiry: tokenExpiry
  });
  
  return idToken;
}

async function getValidToken() {
  const stored = await chrome.storage.local.get(['tokenExpiry']);
  const bufferTime = 5 * 60 * 1000;
  if (!idToken || !stored.tokenExpiry || stored.tokenExpiry < Date.now() + bufferTime) {
    return await refreshToken({ signOutOnAuthError: true });
  }
  return idToken;
}

async function signOut() {
  currentUser = null;
  idToken = null;
  
  if (!isEdgeBrowser()) {
    try {
      const token = await new Promise((resolve) => {
        chrome.identity.getAuthToken({ interactive: false }, resolve);
      });
      if (token) {
        await fetch(`https://accounts.google.com/o/oauth2/revoke?token=${token}`);
        await new Promise((resolve) => {
          chrome.identity.removeCachedAuthToken({ token }, resolve);
        });
      }
      await new Promise((resolve) => {
        chrome.identity.clearAllCachedAuthTokens(resolve);
      });
    } catch (e) {
      console.warn('[Auth] Error during sign out:', e);
    }
  }
  
  await chrome.storage.local.remove([
    'firebaseUser', 
    'firebaseToken', 
    'firebaseRefreshToken', 
    'tokenExpiry',
    'lastSyncTime'
  ]);
}

async function ensureUserDocument() {
  if (!currentUser) return;
  
  const token = await getValidToken();
  const userDocUrl = `${FIRESTORE_BASE_URL}/users/${currentUser.uid}`;
  
  const getResponse = await fetch(userDocUrl, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  if (getResponse.status === 404) {
    await fetch(userDocUrl, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fields: {
          email: { stringValue: currentUser.email },
          displayName: { stringValue: currentUser.displayName || '' },
          photoURL: { stringValue: currentUser.photoURL || '' },
          createdAt: { stringValue: new Date().toISOString() }
        }
      })
    });
  }
}

async function syncBookmarksToCloud(bookmarks, groups = [], groupOrder = [], deletedUrls = {}, pinnedGroups = []) {
  if (!currentUser) {
    throw new Error('Not authenticated');
  }
  
  const token = await getValidToken();
  const bookmarksDocUrl = `${FIRESTORE_BASE_URL}/users/${currentUser.uid}/quickmark/bookmarks`;
  
  const bookmarksData = bookmarks.map(b => ({
    mapValue: {
      fields: {
        id: { stringValue: b.id },
        url: { stringValue: b.url },
        title: { stringValue: b.title || '' },
        favicon: { stringValue: b.favicon || '' },
        group: { stringValue: b.group || '' },
        groupId: { stringValue: b.groupId || '' },
        tags: { arrayValue: { values: (b.tags || []).map(t => ({ stringValue: t })) } },
        createdAt: { integerValue: String(b.createdAt || Date.now()) },
        clickCount: { integerValue: String(b.clickCount || 0) },
        lastActiveAt: { integerValue: String(b.lastActiveAt || 0) },
        updatedAt: { integerValue: String(b.updatedAt || 0) }
      }
    }
  }));
  
  const groupsData = groups.map(g => ({
    mapValue: {
      fields: {
        id: { stringValue: g.id },
        name: { stringValue: g.name || '' },
        updatedAt: { integerValue: String(g.updatedAt || 0) }
      }
    }
  }));
  
  const deletedUrlsData = Object.entries(deletedUrls).map(([url, timestamp]) => ({
    mapValue: {
      fields: {
        url: { stringValue: url },
        deletedAt: { integerValue: String(timestamp) }
      }
    }
  }));
  
  const response = await fetch(bookmarksDocUrl, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      fields: {
        bookmarks: { arrayValue: { values: bookmarksData } },
        groups: { arrayValue: { values: groupsData } },
        groupOrder: { arrayValue: { values: groupOrder.map(g => ({ stringValue: g })) } },
        pinnedGroups: { arrayValue: { values: (pinnedGroups || []).map(g => ({ stringValue: g })) } },
        deletedUrls: { arrayValue: { values: deletedUrlsData } },
        updatedAt: { timestampValue: new Date().toISOString() },
        deviceId: { stringValue: await getDeviceId() }
      }
    })
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Sync failed');
  }
  
  await chrome.storage.local.set({ lastSyncTime: Date.now() });
  
  return true;
}

// === Bookmark Badge/Icon Indicator Logic ===

async function updateTabBadge(tabId, url) {
  if (!url || url.startsWith('chrome://') || url.startsWith('chrome-extension://')) {
    chrome.action.setIcon({
      tabId: tabId,
      path: {
        "16": "icon_gray16.png",
        "48": "icon_gray48.png",
        "128": "icon_gray128.png"
      }
    });
    chrome.action.setBadgeText({ text: '', tabId: tabId });
    chrome.action.setTitle({ title: chrome.i18n.getMessage("extName"), tabId: tabId });
    return;
  }

  const data = await chrome.storage.local.get({ bookmarks: [] });
  const isBookmarked = data.bookmarks.some(b => b.url === url);

  if (isBookmarked) {
    chrome.action.setIcon({
      tabId: tabId,
      path: {
        "16": "icon16.png",
        "48": "icon48.png",
        "128": "icon128.png"
      }
    });
    chrome.action.setBadgeText({ text: '', tabId: tabId });
    
    // We get the localized string or fallback
    const titleText = chrome.i18n.getMessage("actionRemoveBookmark") || "取消收藏 / Remove Bookmark";
    chrome.action.setTitle({ title: titleText, tabId: tabId });
  } else {
    chrome.action.setIcon({
      tabId: tabId,
      path: {
        "16": "icon_gray16.png",
        "48": "icon_gray48.png",
        "128": "icon_gray128.png"
      }
    });
    chrome.action.setBadgeText({ text: '', tabId: tabId });
    
    const titleText = chrome.i18n.getMessage("actionAddBookmark") || "添加收藏 / Add Bookmark";
    chrome.action.setTitle({ title: titleText, tabId: tabId });
  }
}

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    updateTabBadge(activeInfo.tabId, tab.url);
  } catch (err) {
    console.warn('[Badge] Error getting tab on activated:', err);
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url || changeInfo.status === 'complete') {
    updateTabBadge(tabId, tab.url);
    
    // Automatically update bookmark access stats if the URL matches a bookmark
    if (changeInfo.status === 'complete' && tab.url) {
      updateBookmarkVisit(tab.url);
    }
  }
});

async function updateBookmarkVisit(url) {
  // Normalize URL to handle trailing slashes etc.
  const normalize = (u) => {
    try {
      const urlObj = new URL(u);
      return urlObj.origin + urlObj.pathname.replace(/\/$/, '') + urlObj.search;
    } catch (e) {
      return u;
    }
  };

  const normalizedUrl = normalize(url);
  const data = await chrome.storage.local.get({ bookmarks: [] });
  const bookmarks = data.bookmarks;
  
  let changed = false;
  bookmarks.forEach(b => {
    if (normalize(b.url) === normalizedUrl) {
      b.clickCount = (b.clickCount || 0) + 1;
      b.lastActiveAt = Date.now();
      changed = true;
    }
  });

  if (changed) {
    await chrome.storage.local.set({ bookmarks });
    console.log('[Visit] Updated bookmark stats for:', url);
    
    // Optionally trigger a sync if needed, but maybe not every time to save quota
    // shouldAutoSync().then(should => { if (should) performSync(); });
  }
}

chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes.bookmarks) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length > 0) {
        updateTabBadge(tabs[0].id, tabs[0].url);
      }
    });
  }
});

async function fetchBookmarksFromCloud() {
  if (!currentUser) {
    throw new Error('Not authenticated');
  }
  
  const token = await getValidToken();
  const bookmarksDocUrl = `${FIRESTORE_BASE_URL}/users/${currentUser.uid}/quickmark/bookmarks`;
  
  const response = await fetch(bookmarksDocUrl, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  if (response.status === 404) {
    return { bookmarks: [], groups: [], groupOrder: [], pinnedGroups: [] };
  }
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Fetch failed');
  }
  
  const data = await response.json();
  
  if (!data.fields) {
    return { bookmarks: [], groups: [], groupOrder: [], pinnedGroups: [], deletedUrls: {} };
  }
  
  const bookmarks = (data.fields.bookmarks?.arrayValue?.values || []).map(item => {
    const fields = item.mapValue.fields;
    return {
      id: fields.id?.stringValue || '',
      url: fields.url?.stringValue || '',
      title: fields.title?.stringValue || '',
      favicon: fields.favicon?.stringValue || '',
      group: fields.group?.stringValue || '',
      groupId: fields.groupId?.stringValue || '',
      tags: (fields.tags?.arrayValue?.values || []).map(t => t.stringValue),
      createdAt: parseInt(fields.createdAt?.integerValue || '0'),
      clickCount: parseInt(fields.clickCount?.integerValue || '0'),
      lastActiveAt: parseInt(fields.lastActiveAt?.integerValue || '0'),
      updatedAt: parseInt(fields.updatedAt?.integerValue || '0')
    };
  });
  
  const groupOrder = (data.fields.groupOrder?.arrayValue?.values || []).map(g => g.stringValue);
  const pinnedGroups = (data.fields.pinnedGroups?.arrayValue?.values || []).map(g => g.stringValue);
  
  const groups = (data.fields.groups?.arrayValue?.values || []).map(item => {
    const fields = item.mapValue.fields;
    return {
      id: fields.id?.stringValue || '',
      name: fields.name?.stringValue || '',
      updatedAt: parseInt(fields.updatedAt?.integerValue || '0')
    };
  });
  
  const deletedUrls = {};
  (data.fields.deletedUrls?.arrayValue?.values || []).forEach(item => {
    const fields = item.mapValue.fields;
    const url = fields.url?.stringValue;
    const deletedAt = parseInt(fields.deletedAt?.integerValue || '0');
    if (url) {
      deletedUrls[url] = deletedAt;
    }
  });
  
  return { bookmarks, groups, groupOrder, pinnedGroups, deletedUrls };
}

async function mergeBookmarks(localBookmarks, cloudBookmarks, localDeletedUrls, cloudDeletedUrls) {
  const merged = new Map();
  const mergedDeletedUrls = { ...localDeletedUrls, ...cloudDeletedUrls };
  
  Object.entries(localDeletedUrls).forEach(([url, localTime]) => {
    const cloudTime = cloudDeletedUrls[url] || 0;
    mergedDeletedUrls[url] = Math.max(localTime, cloudTime);
  });
  
  Object.entries(cloudDeletedUrls).forEach(([url, cloudTime]) => {
    const localTime = localDeletedUrls[url] || 0;
    mergedDeletedUrls[url] = Math.max(localTime, cloudTime);
  });
  
  cloudBookmarks.forEach(b => {
    const deletedAt = mergedDeletedUrls[b.url];
    const bookmarkTime = Math.max(b.lastActiveAt || 0, b.createdAt || 0);
    if (!deletedAt || bookmarkTime > deletedAt) {
      merged.set(b.url, b);
    }
  });
  
  localBookmarks.forEach(b => {
    const deletedAt = mergedDeletedUrls[b.url];
    const bookmarkTime = Math.max(b.lastActiveAt || 0, b.createdAt || 0);
    
    if (deletedAt && bookmarkTime <= deletedAt) {
      return;
    }
    
    const existing = merged.get(b.url);
    if (!existing) {
      merged.set(b.url, b);
    } else {
      const localUpdated = b.updatedAt || b.lastActiveAt || b.createdAt || 0;
      const cloudUpdated = existing.updatedAt || existing.lastActiveAt || existing.createdAt || 0;
      
      if (localUpdated >= cloudUpdated) {
        merged.set(b.url, {
          ...existing,
          ...b,
          clickCount: Math.max(b.clickCount || 0, existing.clickCount || 0)
        });
      } else {
        merged.set(b.url, {
          ...b,
          ...existing,
          clickCount: Math.max(b.clickCount || 0, existing.clickCount || 0)
        });
      }
    }
  });
  
  const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
  const cleanedDeletedUrls = {};
  Object.entries(mergedDeletedUrls).forEach(([url, timestamp]) => {
    if (timestamp > thirtyDaysAgo) {
      cleanedDeletedUrls[url] = timestamp;
    }
  });
  
  return { 
    bookmarks: Array.from(merged.values()),
    deletedUrls: cleanedDeletedUrls
  };
}

function mergeGroups(localGroups, cloudGroups) {
  const merged = new Map();
  
  cloudGroups.forEach(g => {
    if (g.id) merged.set(g.id, g);
  });
  
  localGroups.forEach(g => {
    if (!g.id) return;
    const existing = merged.get(g.id);
    if (!existing) {
      merged.set(g.id, g);
    } else {
      const localTime = g.updatedAt || 0;
      const cloudTime = existing.updatedAt || 0;
      if (localTime >= cloudTime) {
        merged.set(g.id, g);
      }
    }
  });
  
  return Array.from(merged.values());
}

async function getDeviceId() {
  const stored = await chrome.storage.local.get(['deviceId']);
  if (stored.deviceId) {
    return stored.deviceId;
  }
  const deviceId = 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  await chrome.storage.local.set({ deviceId });
  return deviceId;
}

async function shouldAutoSync() {
  const stored = await chrome.storage.local.get(['lastSyncTime', 'autoSyncEnabled']);
  
  if (stored.autoSyncEnabled === false) {
    return false;
  }
  
  if (!currentUser) {
    const user = await initAuth();
    if (!user) return false;
  }
  
  const lastSync = stored.lastSyncTime || 0;
  const twelveHoursMs = 12 * 60 * 60 * 1000;
  
  return Date.now() - lastSync > twelveHoursMs;
}

async function performSync() {
  if (!currentUser) {
    const user = await initAuth();
    if (!user) {
      throw new Error('Not authenticated');
    }
  }
  
  const localData = await chrome.storage.local.get(['bookmarks', 'groups', 'groupOrder', 'pinnedGroups', 'deletedUrls']);
  const localBookmarks = localData.bookmarks || [];
  const localGroups = localData.groups || [];
  const localGroupOrder = localData.groupOrder || [];
  const localPinnedGroups = localData.pinnedGroups || [];
  const localDeletedUrls = localData.deletedUrls || {};
  
  console.log('[Sync] Local bookmarks:', localBookmarks.length);
  
  const cloudData = await fetchBookmarksFromCloud();
  
  const mergeResult = await mergeBookmarks(
    localBookmarks, 
    cloudData.bookmarks, 
    localDeletedUrls, 
    cloudData.deletedUrls || {}
  );
  
  const mergedGroups = mergeGroups(localGroups, cloudData.groups || []);
  
  const actualGroupIds = new Set(mergeResult.bookmarks.map(b => b.groupId).filter(Boolean));
  
  const localOrderNewer = localGroupOrder.length > 0;
  const baseGroupOrder = localOrderNewer ? localGroupOrder : cloudData.groupOrder;
  const otherGroupOrder = localOrderNewer ? cloudData.groupOrder : localGroupOrder;
  
  const mergedGroupOrder = [...baseGroupOrder];
  otherGroupOrder.forEach(g => {
    if (!mergedGroupOrder.includes(g)) {
      mergedGroupOrder.push(g);
    }
  });
  
  const cleanedGroupOrder = mergedGroupOrder.filter(g => actualGroupIds.has(g));
  actualGroupIds.forEach(g => {
    if (g && !cleanedGroupOrder.includes(g)) {
      cleanedGroupOrder.push(g);
    }
  });
  
  const basePinnedGroups = localOrderNewer ? localPinnedGroups : (cloudData.pinnedGroups || []);
  const otherPinnedGroups = localOrderNewer ? (cloudData.pinnedGroups || []) : localPinnedGroups;
  
  const mergedPinnedGroups = [...basePinnedGroups];
  otherPinnedGroups.forEach(g => {
    if (!mergedPinnedGroups.includes(g)) {
      mergedPinnedGroups.push(g);
    }
  });
  const cleanedPinnedGroups = mergedPinnedGroups.filter(g => actualGroupIds.has(g));
  
  await chrome.storage.local.set({
    bookmarks: mergeResult.bookmarks,
    groups: mergedGroups,
    groupOrder: cleanedGroupOrder,
    pinnedGroups: cleanedPinnedGroups,
    deletedUrls: mergeResult.deletedUrls
  });
  
  await syncBookmarksToCloud(mergeResult.bookmarks, mergedGroups, cleanedGroupOrder, mergeResult.deletedUrls, cleanedPinnedGroups);
  
  return {
    localCount: localBookmarks.length,
    cloudCount: cloudData.bookmarks.length,
    mergedCount: mergeResult.bookmarks.length
  };
}

async function clearCloudData() {
  if (!currentUser) {
    throw new Error('Not authenticated');
  }
  
  const token = await getValidToken();
  const bookmarksDocUrl = `${FIRESTORE_BASE_URL}/users/${currentUser.uid}/quickmark/bookmarks`;
  
  const response = await fetch(bookmarksDocUrl, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  if (!response.ok && response.status !== 404) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Clear cloud data failed');
  }
  
  return true;
}
