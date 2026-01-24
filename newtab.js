const GROUP_COLORS = ['#4f8cff', '#52c41a', '#faad14', '#ff4d4f', '#722ed1', '#13c2c2', '#eb2f96', '#fa8c16'];
let bookmarks = [];
let selectedIds = new Set();
let currentView = 'card';
let currentSort = 'recent';
let activeTagFilter = null;
let batchMode = false;
let editingBookmarkId = null;
let groupOrder = [];
let draggedGroup = null;
let currentLang = 'auto';

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
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    el.placeholder = i18n(key);
  });
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.getAttribute('data-i18n-title');
    el.title = i18n(key);
  });
}

function getGroupColor(groupName) {
  let hash = 0;
  for (let i = 0; i < groupName.length; i++) {
    hash = groupName.charCodeAt(i) + ((hash << 5) - hash);
  }
  return GROUP_COLORS[Math.abs(hash) % GROUP_COLORS.length];
}

function formatTime(timestamp) {
  if (!timestamp) return '';
  const now = Date.now();
  const diff = now - timestamp;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const week = 7 * day;
  const month = 30 * day;
  const year = 365 * day;
  
  if (diff < minute) return i18n('timeJustNow');
  if (diff < hour) return i18n('timeMinutesAgo').replace('{n}', Math.floor(diff / minute));
  if (diff < day) return i18n('timeHoursAgo').replace('{n}', Math.floor(diff / hour));
  if (diff < week) return i18n('timeDaysAgo').replace('{n}', Math.floor(diff / day));
  if (diff < month) return i18n('timeWeeksAgo').replace('{n}', Math.floor(diff / week));
  if (diff < year) return i18n('timeMonthsAgo').replace('{n}', Math.floor(diff / month));
  return i18n('timeYearsAgo').replace('{n}', Math.floor(diff / year));
}

function getDomain(url) {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return url;
  }
}

function getAllTags() {
  const tagCount = {};
  bookmarks.forEach(b => {
    if (b.tags && Array.isArray(b.tags)) {
      b.tags.forEach(t => {
        tagCount[t] = (tagCount[t] || 0) + 1;
      });
    }
  });
  return Object.entries(tagCount).sort((a, b) => a[0].localeCompare(b[0]));
}

function showTip(msg, type = 'success') {
  let tip = document.getElementById('quickmark-tip');
  if (!tip) {
    tip = document.createElement('div');
    tip.id = 'quickmark-tip';
    document.body.appendChild(tip);
  }
  tip.textContent = msg;
  tip.className = 'quickmark-tip ' + (type === 'error' ? 'quickmark-tip-error' : 'quickmark-tip-success');
  tip.style.opacity = '1';
  setTimeout(() => { tip.style.opacity = '0'; }, 2000);
}

function saveBookmarks(callback) {
  chrome.storage.local.set({ bookmarks, groupOrder }, callback);
}

function loadBookmarks(callback) {
  chrome.storage.local.get({ bookmarks: [], groupOrder: [], viewMode: 'card', sortMode: 'recent', lang: 'auto' }, (data) => {
    bookmarks = data.bookmarks;
    groupOrder = data.groupOrder || [];
    currentView = data.viewMode || 'card';
    currentSort = data.sortMode || 'recent';
    currentLang = data.lang || 'auto';
    if (callback) callback();
  });
}

function getLastActiveTime(b) {
  return b.lastActiveAt || b.createdAt || 0;
}

function sortBookmarks(items) {
  const sorted = [...items];
  switch (currentSort) {
    case 'recent':
      sorted.sort((a, b) => getLastActiveTime(b) - getLastActiveTime(a));
      break;
    case 'alpha':
      sorted.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
      break;
    case 'clicks':
      sorted.sort((a, b) => (b.clickCount || 0) - (a.clickCount || 0));
      break;
  }
  return sorted;
}

function filterByTag(items) {
  if (!activeTagFilter) return items;
  return items.filter(b => b.tags && b.tags.includes(activeTagFilter));
}

function groupBookmarks() {
  const groups = {};
  filterByTag(bookmarks).forEach(b => {
    const g = b.group || i18n('ungrouped');
    if (!groups[g]) groups[g] = [];
    groups[g].push(b);
  });
  
  Object.keys(groups).forEach(g => {
    groups[g] = [...groups[g]].sort((a, b) => getLastActiveTime(b) - getLastActiveTime(a));
  });
  
  const existingGroups = Object.keys(groups);
  const orderedGroups = [];
  
  groupOrder.forEach(g => {
    if (groups[g]) orderedGroups.push(g);
  });
  
  existingGroups.forEach(g => {
    if (!orderedGroups.includes(g)) orderedGroups.push(g);
  });
  
  return { groups, orderedGroups };
}

function renderTagFilter() {
  const tags = getAllTags();
  const toolbar = document.getElementById('tagToolbar');
  const filter = document.getElementById('tagFilter');
  const clearBtn = document.getElementById('clearTagFilter');
  
  if (tags.length === 0) {
    toolbar.style.display = 'none';
    return;
  }
  
  toolbar.style.display = 'flex';
  filter.innerHTML = tags.map(([tag, count]) => `
    <span class="tag-chip ${activeTagFilter === tag ? 'active' : ''}" data-tag="${tag}">
      #${tag} <span class="tag-count">${count}</span>
    </span>
  `).join('');
  
  clearBtn.style.display = activeTagFilter ? 'block' : 'none';
  
  filter.querySelectorAll('.tag-chip').forEach(chip => {
    chip.onclick = () => {
      const tag = chip.dataset.tag;
      activeTagFilter = activeTagFilter === tag ? null : tag;
      render();
    };
  });
  
  clearBtn.onclick = () => {
    activeTagFilter = null;
    render();
  };
}

function createBookmarkCard(b) {
  const card = document.createElement('div');
  card.className = 'bookmark-card' + (selectedIds.has(b.id) ? ' selected' : '') + ' view-' + currentView;
  card.dataset.id = b.id;
  card.draggable = true;
  
  const tagsHtml = b.tags && b.tags.length > 0 
    ? `<div class="bookmark-tags">${b.tags.map(t => `<span class="bookmark-tag">#${t}</span>`).join('')}</div>` 
    : '';
  
  const noteHtml = b.note 
    ? `<div class="bookmark-note">${b.note}</div>` 
    : '';
  
  const activeTime = formatTime(getLastActiveTime(b));
  
  let cardContent = '';
  
  if (currentView === 'headline') {
    cardContent = `
      <input type="checkbox" class="bookmark-checkbox" ${selectedIds.has(b.id) ? 'checked' : ''}>
      <img class="bookmark-favicon" src="${b.favicon || 'icon16.png'}" onerror="this.src='icon16.png'">
      <div class="bookmark-content">
        <div class="bookmark-title" title="${b.title}">${b.title}</div>
      </div>
      <div class="bookmark-actions">
        <button class="bookmark-action-btn edit-btn" title="编辑">✏️</button>
        <button class="bookmark-action-btn danger delete-btn" title="删除">🗑️</button>
      </div>
    `;
  } else if (currentView === 'list') {
    cardContent = `
      <input type="checkbox" class="bookmark-checkbox" ${selectedIds.has(b.id) ? 'checked' : ''}>
      <img class="bookmark-favicon" src="${b.favicon || 'icon16.png'}" onerror="this.src='icon16.png'">
      <div class="bookmark-content">
        <div class="bookmark-title" title="${b.title}">${b.title}</div>
        <div class="bookmark-meta">
          <span class="bookmark-domain">${getDomain(b.url)}</span>
          <span class="bookmark-time">${activeTime}</span>
        </div>
      </div>
      <div class="bookmark-actions">
        <button class="bookmark-action-btn edit-btn" title="编辑">✏️</button>
        <button class="bookmark-action-btn danger delete-btn" title="删除">🗑️</button>
      </div>
    `;
  } else {
    cardContent = `
      <input type="checkbox" class="bookmark-checkbox" ${selectedIds.has(b.id) ? 'checked' : ''}>
      <img class="bookmark-favicon" src="${b.favicon || 'icon16.png'}" onerror="this.src='icon16.png'">
      <div class="bookmark-content">
        <div class="bookmark-title" title="${b.title}">${b.title}</div>
        <div class="bookmark-meta">
          <span class="bookmark-domain">${getDomain(b.url)}</span>
          <span class="bookmark-time">${activeTime}</span>
        </div>
        ${tagsHtml}
        ${noteHtml}
      </div>
      <div class="bookmark-actions">
        <button class="bookmark-action-btn edit-btn" title="编辑">✏️</button>
        <button class="bookmark-action-btn danger delete-btn" title="删除">🗑️</button>
      </div>
    `;
  }
  
  card.innerHTML = cardContent;
  
  if (batchMode) {
    card.classList.add('batch-mode');
  }
  
  const checkbox = card.querySelector('.bookmark-checkbox');
  checkbox.onclick = (e) => {
    e.stopPropagation();
    if (checkbox.checked) {
      selectedIds.add(b.id);
      card.classList.add('selected');
    } else {
      selectedIds.delete(b.id);
      card.classList.remove('selected');
    }
    updateBatchToolbar();
  };
  
  card.querySelector('.edit-btn').onclick = (e) => {
    e.stopPropagation();
    openEditModal(b);
  };
  
  card.querySelector('.delete-btn').onclick = (e) => {
    e.stopPropagation();
    bookmarks = bookmarks.filter(x => x.id !== b.id);
    saveBookmarks(() => {
      showTip(i18n('deleted'));
      render();
    });
  };
  
  card.onclick = (e) => {
    if (batchMode) {
      checkbox.checked = !checkbox.checked;
      checkbox.onclick({ stopPropagation: () => {} });
      return;
    }
    if (e.target.closest('.bookmark-actions') || e.target.closest('.bookmark-checkbox')) return;
    
    b.clickCount = (b.clickCount || 0) + 1;
    b.lastActiveAt = Date.now();
    saveBookmarks();
    window.location.href = b.url;
  };
  
  card.ondragstart = (e) => {
    card.classList.add('dragging');
    e.dataTransfer.setData('text/plain', JSON.stringify({ id: b.id, fromGroup: b.group }));
  };
  
  card.ondragend = () => card.classList.remove('dragging');
  
  return card;
}

function createGroupElement(groupName, items) {
  const group = document.createElement('div');
  group.className = 'group';
  group.dataset.group = groupName;
  
  const color = getGroupColor(groupName);
  
  group.innerHTML = `
    <div class="group-header">
      <div class="group-title-wrapper">
        <div class="group-color" style="background: ${color}"></div>
        <span class="group-title">${groupName}</span>
        <span class="group-count">${items.length}</span>
      </div>
      <div class="group-actions">
        <button class="group-action-btn rename-btn" title="重命名">✏️</button>
      </div>
    </div>
    <div class="bookmark-list"></div>
  `;
  
  const header = group.querySelector('.group-header');
  header.draggable = true;
  
  header.ondragstart = (e) => {
    draggedGroup = groupName;
    group.classList.add('dragging');
    e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'group', groupName }));
  };
  
  header.ondragend = () => {
    draggedGroup = null;
    group.classList.remove('dragging');
  };
  
  header.ondragover = (e) => {
    e.preventDefault();
    if (draggedGroup && draggedGroup !== groupName) {
      group.style.outline = '2px dashed var(--primary)';
    }
  };
  
  header.ondragleave = () => {
    group.style.outline = '';
  };
  
  header.ondrop = (e) => {
    e.preventDefault();
    group.style.outline = '';
    
    try {
      const data = JSON.parse(e.dataTransfer.getData('text/plain'));
      
      if (data.type === 'group' && data.groupName !== groupName) {
        const fromIdx = groupOrder.indexOf(data.groupName);
        const toIdx = groupOrder.indexOf(groupName);
        
        if (fromIdx === -1) {
          groupOrder.push(data.groupName);
        }
        if (toIdx === -1) {
          groupOrder.push(groupName);
        }
        
        const newFromIdx = groupOrder.indexOf(data.groupName);
        const newToIdx = groupOrder.indexOf(groupName);
        
        groupOrder.splice(newFromIdx, 1);
        groupOrder.splice(newToIdx, 0, data.groupName);
        
        saveBookmarks(render);
      } else if (data.id) {
        const bookmark = bookmarks.find(b => b.id === data.id);
        if (bookmark && bookmark.group !== groupName) {
          bookmark.group = groupName;
          saveBookmarks(render);
        }
      }
    } catch {}
  };
  
  group.querySelector('.rename-btn').onclick = () => {
    const titleEl = group.querySelector('.group-title');
    const input = document.createElement('input');
    input.type = 'text';
    input.value = groupName;
    input.className = 'edit-input';
    
    const finishEdit = () => {
      const newName = input.value.trim();
      if (newName && newName !== groupName) {
        bookmarks.forEach(b => {
          if (b.group === groupName) b.group = newName;
        });
        const idx = groupOrder.indexOf(groupName);
        if (idx !== -1) groupOrder[idx] = newName;
        saveBookmarks(render);
      } else {
        titleEl.textContent = groupName;
      }
    };
    
    input.onblur = finishEdit;
    input.onkeydown = (e) => {
      if (e.key === 'Enter') finishEdit();
      if (e.key === 'Escape') {
        titleEl.textContent = groupName;
      }
    };
    
    titleEl.textContent = '';
    titleEl.appendChild(input);
    input.focus();
    input.select();
  };
  
  const list = group.querySelector('.bookmark-list');
  items.forEach(b => list.appendChild(createBookmarkCard(b)));
  
  list.ondragover = (e) => {
    e.preventDefault();
    list.style.background = 'var(--bg)';
  };
  
  list.ondragleave = () => {
    list.style.background = '';
  };
  
  list.ondrop = (e) => {
    e.preventDefault();
    list.style.background = '';
    
    try {
      const data = JSON.parse(e.dataTransfer.getData('text/plain'));
      if (data.id && data.fromGroup !== groupName) {
        const bookmark = bookmarks.find(b => b.id === data.id);
        if (bookmark) {
          bookmark.group = groupName;
          saveBookmarks(render);
        }
      }
    } catch {}
  };
  
  return group;
}

function render() {
  const container = document.getElementById('masonry');
  const emptyState = document.getElementById('emptyState');
  
  renderTagFilter();
  
  const filtered = filterByTag(bookmarks);
  
  if (filtered.length === 0) {
    container.innerHTML = '';
    emptyState.style.display = 'block';
    return;
  }
  
  emptyState.style.display = 'none';
  
  const { groups, orderedGroups } = groupBookmarks();
  
  const containerWidth = container.offsetWidth;
  const colCount = Math.max(1, Math.floor(containerWidth / 300));
  const cols = Array.from({ length: colCount }, () => []);
  const colHeights = Array(colCount).fill(0);
  
  orderedGroups.forEach(groupName => {
    const items = groups[groupName];
    const minIdx = colHeights.indexOf(Math.min(...colHeights));
    cols[minIdx].push({ groupName, items });
    colHeights[minIdx] += items.length + 1;
  });
  
  container.innerHTML = '';
  cols.forEach(colGroups => {
    const colDiv = document.createElement('div');
    colDiv.className = 'masonry-col';
    colGroups.forEach(({ groupName, items }) => {
      colDiv.appendChild(createGroupElement(groupName, items));
    });
    container.appendChild(colDiv);
  });
  
  updateBatchToolbar();
}

function updateBatchToolbar() {
  const toolbar = document.getElementById('batchToolbar');
  const count = document.getElementById('selectedCount');
  
  if (batchMode && selectedIds.size > 0) {
    toolbar.classList.add('show');
    count.textContent = selectedIds.size;
  } else {
    toolbar.classList.remove('show');
  }
}

function getAllGroups() {
  const groupCount = {};
  bookmarks.forEach(b => {
    const g = b.group || i18n('ungrouped');
    groupCount[g] = (groupCount[g] || 0) + 1;
  });
  return Object.entries(groupCount).sort((a, b) => b[1] - a[1]);
}

function getAllTagsWithCount() {
  const tagCount = {};
  bookmarks.forEach(b => {
    if (b.tags && Array.isArray(b.tags)) {
      b.tags.forEach(t => {
        tagCount[t] = (tagCount[t] || 0) + 1;
      });
    }
  });
  return Object.entries(tagCount).sort((a, b) => b[1] - a[1]);
}

function setupGroupDropdown() {
  const wrapper = document.getElementById('editGroupWrapper');
  const input = document.getElementById('editGroupInput');
  const dropdown = document.getElementById('groupDropdown');
  
  function getSelectedGroup() {
    const chip = wrapper.querySelector('.group-chip');
    return chip ? chip.dataset.value : null;
  }
  
  function setGroupChip(groupName) {
    wrapper.querySelectorAll('.group-chip').forEach(el => el.remove());
    
    if (groupName) {
      const chip = document.createElement('span');
      chip.className = 'group-chip';
      chip.dataset.value = groupName;
      chip.innerHTML = `<span class="group-chip-color" style="background: ${getGroupColor(groupName)}"></span>${groupName} <span class="tag-remove">×</span>`;
      chip.querySelector('.tag-remove').onclick = () => {
        chip.remove();
        input.style.display = '';
        input.focus();
      };
      wrapper.insertBefore(chip, input);
      input.value = '';
      input.style.display = 'none';
    } else {
      input.style.display = '';
    }
  }
  
  function showDropdown(filterByInput = false) {
    const groups = getAllGroups();
    let filtered = groups;
    
    if (filterByInput && input.value.trim()) {
      const currentValue = input.value.toLowerCase();
      filtered = groups.filter(([name]) => 
        name.toLowerCase().includes(currentValue)
      );
    }
    
    if (filtered.length === 0) {
      const inputVal = input.value.trim();
      if (inputVal) {
        dropdown.innerHTML = `<div class="combo-dropdown-empty">${i18n('pressEnterToCreate').replace('{name}', inputVal)}</div>`;
        dropdown.classList.add('show');
      } else {
        dropdown.classList.remove('show');
      }
    } else {
      dropdown.innerHTML = filtered.map(([name, count]) => `
        <div class="combo-dropdown-item" data-value="${name}">
          <span class="item-icon" style="background: ${getGroupColor(name)}"></span>
          <span>${name}</span>
          <span class="item-count">${count}</span>
        </div>
      `).join('');
      dropdown.classList.add('show');
      
      dropdown.querySelectorAll('.combo-dropdown-item').forEach(item => {
        item.onclick = () => {
          setGroupChip(item.dataset.value);
          dropdown.classList.remove('show');
        };
      });
    }
  }
  
  input.onfocus = () => showDropdown(false);
  input.oninput = () => showDropdown(true);
  
  input.onkeydown = (e) => {
    if (e.key === 'Enter' && input.value.trim()) {
      e.preventDefault();
      setGroupChip(input.value.trim());
      dropdown.classList.remove('show');
    }
    if (e.key === 'Backspace' && !input.value) {
      const chip = wrapper.querySelector('.group-chip');
      if (chip) {
        chip.remove();
        input.style.display = '';
      }
    }
  };
  
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#editGroupWrapper')) {
      dropdown.classList.remove('show');
    }
  });
  
  window.setGroupChip = setGroupChip;
  window.getSelectedGroup = getSelectedGroup;
}

function setupTagDropdown() {
  const input = document.getElementById('editTagInput');
  const dropdown = document.getElementById('tagDropdown');
  const wrapper = document.getElementById('editTagsWrapper');
  
  function getExistingTags() {
    const tags = [];
    wrapper.querySelectorAll('.tag-chip').forEach(chip => {
      const text = chip.textContent.replace('×', '').replace('#', '').trim();
      if (text) tags.push(text);
    });
    return tags;
  }
  
  function showDropdown() {
    const allTags = getAllTagsWithCount();
    const existingTags = getExistingTags();
    const currentValue = input.value.toLowerCase();
    
    const filtered = allTags.filter(([name]) => 
      !existingTags.includes(name) && name.toLowerCase().includes(currentValue)
    );
    
    if (filtered.length === 0) {
      const inputVal = input.value.trim();
      if (inputVal) {
        dropdown.innerHTML = `<div class="combo-dropdown-empty">${i18n('pressEnterToCreateTag').replace('{name}', inputVal)}</div>`;
        dropdown.classList.add('show');
      } else {
        dropdown.classList.remove('show');
      }
    } else {
      dropdown.innerHTML = filtered.map(([name, count]) => `
        <div class="combo-dropdown-item" data-value="${name}">
          <span>#${name}</span>
          <span class="item-count">${count}</span>
        </div>
      `).join('');
      dropdown.classList.add('show');
      
      dropdown.querySelectorAll('.combo-dropdown-item').forEach(item => {
        item.onclick = () => {
          addTagChip(item.dataset.value);
          input.value = '';
          dropdown.classList.remove('show');
          input.focus();
        };
      });
    }
  }
  
  function addTagChip(tagName) {
    const chip = document.createElement('span');
    chip.className = 'tag-chip';
    chip.innerHTML = `#${tagName} <span class="tag-remove">×</span>`;
    chip.querySelector('.tag-remove').onclick = () => chip.remove();
    wrapper.insertBefore(chip, input);
  }
  
  input.onfocus = showDropdown;
  input.oninput = showDropdown;
  
  input.onkeydown = (e) => {
    if (e.key === 'Enter' && input.value.trim()) {
      e.preventDefault();
      addTagChip(input.value.trim());
      input.value = '';
      dropdown.classList.remove('show');
    }
  };
  
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.tag-input-wrapper')) {
      dropdown.classList.remove('show');
    }
  });
}

function openEditModal(bookmark) {
  editingBookmarkId = bookmark.id;
  
  document.getElementById('editTitle').value = bookmark.title || '';
  document.getElementById('editUrl').value = bookmark.url || '';
  document.getElementById('editNote').value = bookmark.note || '';
  
  const groupInput = document.getElementById('editGroupInput');
  groupInput.value = '';
  groupInput.style.display = '';
  document.getElementById('editGroupWrapper').querySelectorAll('.group-chip').forEach(el => el.remove());
  if (bookmark.group) {
    window.setGroupChip(bookmark.group);
  }
  
  const wrapper = document.getElementById('editTagsWrapper');
  wrapper.querySelectorAll('.tag-chip').forEach(el => el.remove());
  
  const input = document.getElementById('editTagInput');
  if (bookmark.tags && bookmark.tags.length > 0) {
    bookmark.tags.forEach(tag => {
      const chip = document.createElement('span');
      chip.className = 'tag-chip';
      chip.innerHTML = `#${tag} <span class="tag-remove">×</span>`;
      chip.querySelector('.tag-remove').onclick = () => chip.remove();
      wrapper.insertBefore(chip, input);
    });
  }
  
  document.getElementById('editModal').classList.add('show');
}

function closeEditModal() {
  document.getElementById('editModal').classList.remove('show');
  editingBookmarkId = null;
}

function saveEditModal() {
  const bookmark = bookmarks.find(b => b.id === editingBookmarkId);
  if (!bookmark) return;
  
  bookmark.title = document.getElementById('editTitle').value.trim();
  
  const selectedGroup = window.getSelectedGroup();
  const groupInputValue = document.getElementById('editGroupInput').value.trim();
  bookmark.group = selectedGroup || groupInputValue || i18n('ungrouped');
  
  bookmark.note = document.getElementById('editNote').value.trim();
  bookmark.lastActiveAt = Date.now();
  
  const tags = [];
  document.getElementById('editTagsWrapper').querySelectorAll('.tag-chip').forEach(chip => {
    const text = chip.textContent.replace('×', '').replace('#', '').trim();
    if (text) tags.push(text);
  });
  
  const inputValue = document.getElementById('editTagInput').value.trim();
  if (inputValue) {
    tags.push(inputValue);
  }
  
  bookmark.tags = tags;
  
  saveBookmarks(() => {
    showTip(i18n('saved'));
    closeEditModal();
    render();
  });
}

function setupTagInput(wrapperId, inputId) {
  const wrapper = document.getElementById(wrapperId);
  const input = document.getElementById(inputId);
  
  input.onkeydown = (e) => {
    if (e.key === 'Enter' && input.value.trim()) {
      e.preventDefault();
      const tag = input.value.trim();
      const chip = document.createElement('span');
      chip.className = 'tag-chip';
      chip.innerHTML = `#${tag} <span class="tag-remove">×</span>`;
      chip.querySelector('.tag-remove').onclick = () => chip.remove();
      wrapper.insertBefore(chip, input);
      input.value = '';
    }
    
    if (e.key === 'Backspace' && !input.value) {
      const chips = wrapper.querySelectorAll('.tag-chip');
      if (chips.length > 0) {
        chips[chips.length - 1].remove();
      }
    }
  };
}

function openMoveModal() {
  const select = document.getElementById('moveGroupSelect');
  const groups = [...new Set(bookmarks.map(b => b.group || i18n('ungrouped')))];
  
  select.innerHTML = groups.map(g => `<option value="${g}">${g}</option>`).join('');
  document.getElementById('newGroupInput').value = '';
  document.getElementById('moveModal').classList.add('show');
}

function closeMoveModal() {
  document.getElementById('moveModal').classList.remove('show');
}

function confirmMove() {
  const newGroup = document.getElementById('newGroupInput').value.trim() 
    || document.getElementById('moveGroupSelect').value;
  
  if (!newGroup) return;
  
  bookmarks.forEach(b => {
    if (selectedIds.has(b.id)) {
      b.group = newGroup;
    }
  });
  
  saveBookmarks(() => {
    showTip(i18n('moved'));
    selectedIds.clear();
    closeMoveModal();
    render();
  });
}

function openTagModal() {
  const wrapper = document.getElementById('batchTagsWrapper');
  wrapper.querySelectorAll('.tag-chip').forEach(el => el.remove());
  document.getElementById('batchTagInput').value = '';
  document.getElementById('tagModal').classList.add('show');
}

function closeTagModal() {
  document.getElementById('tagModal').classList.remove('show');
}

function confirmBatchTag() {
  const tags = [];
  document.getElementById('batchTagsWrapper').querySelectorAll('.tag-chip').forEach(chip => {
    const text = chip.textContent.replace('×', '').replace('#', '').trim();
    if (text) tags.push(text);
  });
  
  const inputValue = document.getElementById('batchTagInput').value.trim();
  if (inputValue) {
    tags.push(inputValue);
  }
  
  if (tags.length === 0) {
    showTip(i18n('pleaseEnterTag'), 'error');
    return;
  }
  
  bookmarks.forEach(b => {
    if (selectedIds.has(b.id)) {
      b.tags = [...new Set([...(b.tags || []), ...tags])];
    }
  });
  
  saveBookmarks(() => {
    showTip(i18n('tagsAdded'));
    selectedIds.clear();
    closeTagModal();
    render();
  });
}

function batchDelete() {
  bookmarks = bookmarks.filter(b => !selectedIds.has(b.id));
  saveBookmarks(() => {
    showTip(i18n('deleted'));
    selectedIds.clear();
    render();
  });
}

function exportBookmarks() {
  const blob = new Blob([JSON.stringify(bookmarks, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'quickmark_bookmarks.json';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

function importBookmarks() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const imported = JSON.parse(evt.target.result);
        if (!Array.isArray(imported)) throw new Error('格式错误');
        
        const urlSet = new Set(bookmarks.map(b => b.url));
        let addedCount = 0;
        
        imported.forEach(b => {
          if (!urlSet.has(b.url)) {
            bookmarks.push(b);
            urlSet.add(b.url);
            addedCount++;
          }
        });
        
        saveBookmarks(() => {
          showTip(i18n('importSuccess').replace('{count}', addedCount));
          render();
        });
      } catch {
        showTip(i18n('importFailed'), 'error');
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

function setupSearch() {
  const input = document.getElementById('searchInput');
  let timer = null;
  
  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const keyword = input.value.trim().toLowerCase();
      
      if (!keyword) {
        render();
        return;
      }
      
      const results = bookmarks.filter(b =>
        (b.title && b.title.toLowerCase().includes(keyword)) ||
        (b.url && b.url.toLowerCase().includes(keyword)) ||
        (b.tags && b.tags.some(t => t.toLowerCase().includes(keyword))) ||
        (b.note && b.note.toLowerCase().includes(keyword))
      );
      
      renderSearchResults(results, keyword);
    }, 150);
  });
  
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      input.focus();
      input.select();
    }
    
    if (e.key === 'Escape') {
      if (document.activeElement === input && input.value) {
        input.value = '';
        render();
      } else {
        input.focus();
      }
    }
    
    if (e.key === '/' && document.activeElement !== input) {
      e.preventDefault();
      input.focus();
    }
  });
}

function renderSearchResults(results, keyword) {
  const container = document.getElementById('masonry');
  const emptyState = document.getElementById('emptyState');
  
  emptyState.style.display = 'none';
  container.innerHTML = '';
  
  if (results.length === 0) {
    container.innerHTML = `
      <div class="search-results-list">
        <div class="empty-state">
          <div class="empty-icon">🔍</div>
          <div class="empty-title">未找到相关书签</div>
          <div class="empty-desc">尝试其他关键词</div>
        </div>
      </div>
    `;
    return;
  }
  
  const list = document.createElement('div');
  list.className = 'search-results-list';
  
  const group = document.createElement('div');
  group.className = 'group';
  group.innerHTML = `
    <div class="group-header">
      <div class="group-title-wrapper">
        <div class="group-color" style="background: var(--primary)"></div>
        <span class="group-title">${i18n('searchResults')}</span>
        <span class="group-count">${results.length}</span>
      </div>
    </div>
    <div class="bookmark-list"></div>
  `;
  
  const bookmarkList = group.querySelector('.bookmark-list');
  results.forEach(b => bookmarkList.appendChild(createBookmarkCard(b)));
  
  list.appendChild(group);
  container.appendChild(list);
}

function setupViewToggle() {
  document.querySelectorAll('.view-btn').forEach(btn => {
    if (btn.dataset.view === currentView) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
    
    btn.onclick = () => {
      document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentView = btn.dataset.view;
      chrome.storage.local.set({ viewMode: currentView });
      render();
    };
  });
}

function setupSort() {
  const select = document.getElementById('sortSelect');
  select.value = currentSort;
  
  select.onchange = (e) => {
    currentSort = e.target.value;
    chrome.storage.local.set({ sortMode: currentSort });
    render();
  };
}

function setupBatchMode() {
  document.getElementById('batchBtn').onclick = () => {
    batchMode = !batchMode;
    document.getElementById('batchBtn').classList.toggle('primary', batchMode);
    
    if (!batchMode) {
      selectedIds.clear();
    }
    render();
  };
  
  document.getElementById('batchMove').onclick = openMoveModal;
  document.getElementById('batchTag').onclick = openTagModal;
  document.getElementById('batchDelete').onclick = batchDelete;
  document.getElementById('batchCancel').onclick = () => {
    batchMode = false;
    selectedIds.clear();
    document.getElementById('batchBtn').classList.remove('primary');
    render();
  };
}

function setupModals() {
  document.getElementById('closeEditModal').onclick = closeEditModal;
  document.getElementById('cancelEdit').onclick = closeEditModal;
  document.getElementById('saveEdit').onclick = saveEditModal;
  
  document.getElementById('closeMoveModal').onclick = closeMoveModal;
  document.getElementById('cancelMove').onclick = closeMoveModal;
  document.getElementById('confirmMove').onclick = confirmMove;
  
  document.getElementById('closeTagModal').onclick = closeTagModal;
  document.getElementById('cancelTag').onclick = closeTagModal;
  document.getElementById('confirmTag').onclick = confirmBatchTag;
  
  setupGroupDropdown();
  setupTagDropdown();
  setupTagInput('batchTagsWrapper', 'batchTagInput');
  
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.onclick = (e) => {
      if (e.target === overlay) {
        overlay.classList.remove('show');
      }
    };
  });
}

async function init() {
  await loadMessages();
  
  loadBookmarks(() => {
    applyI18n();
    setupSettingsBtn();
    render();
    setupSearch();
    setupViewToggle();
    setupSort();
    setupBatchMode();
    setupModals();
    
    document.body.addEventListener('click', (e) => {
      const input = document.getElementById('searchInput');
      if (!input.contains(e.target) && 
          !e.target.closest('.bookmark-card') && 
          !e.target.closest('.header-btn') && 
          !e.target.closest('.view-btn') && 
          !e.target.closest('.sort-select') &&
          !e.target.closest('.tag-chip') &&
          !e.target.closest('.modal') &&
          !e.target.closest('button') &&
          !e.target.closest('input') &&
          !e.target.closest('select')) {
        input.focus();
      }
    }, true);
  });
}

function setupSettingsBtn() {
  document.getElementById('settingsBtn').onclick = () => {
    chrome.runtime.openOptionsPage();
  };
}

window.addEventListener('resize', () => {
  clearTimeout(window.resizeTimer);
  window.resizeTimer = setTimeout(render, 200);
});

document.addEventListener('DOMContentLoaded', init);
