// ==========================================
// BUBBLE — APP.JS (Авторизация, Ядро, Навигация, Лента, Друзья, Маскот)
// ==========================================

window.SUPABASE_URL = "https://gcebeebtccfzmpflztee.supabase.co";
window.SUPABASE_ANON_KEY = "sb_publishable_dtbIcBYG7yK2hbB-8a8tGw_9ceJUZ0X";
window.sbClient = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);

let activeUser = null;
let currentTab = localStorage.getItem('bubble_active_tab') || 'feed';
let viewingUserId = localStorage.getItem('bubble_viewing_user_id') || null;
let currentCommunityId = localStorage.getItem('bubble_current_comm_id') ? parseInt(localStorage.getItem('bubble_current_comm_id')) : null;
let currentCommunityRole = null;
let activeConversationId = null;

let userLikedPosts = new Set(JSON.parse(localStorage.getItem('bubble_user_liked_posts') || '[]'));
let userLikedComments = new Set(JSON.parse(localStorage.getItem('bubble_user_liked_comments') || '[]'));
let userLikedCreations = new Set(JSON.parse(localStorage.getItem('bubble_user_liked_creations') || '[]'));
let userVotedMascotNames = new Set(JSON.parse(localStorage.getItem('bubble_user_voted_mascot') || '[]'));

let userFriendIds = new Set();
let pendingOutgoingIds = new Set();
let pendingIncomingIds = new Set();
let profilesMap = {};
let communitiesMap = {};
let allCommunitiesCache = [];
let allTracksCache = [];

let selectedPostTrack = null;
let selectedCommPostTrack = null;
let currentPickerTarget = 'feed';
let pickerMode = 'my';
let activeRepostData = null;
let selectedGroupFriends = new Set();
let playlistQueue = [];
let currentTrackIndex = 0;
let loopMode = 'none';

const DEFAULT_AVATAR = "https://upload.wikimedia.org/wikipedia/commons/7/7c/Profile_avatar_placeholder_large.png";

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.innerText = text;
  return div.innerHTML;
}

function getUsername(user) {
  if (!user) return 'Аноним';
  return user.user_metadata?.username || (user.email ? user.email.split('@')[0] : 'Пользователь');
}

// Надежная функция выхода из системы
window.logoutUser = async function() {
  try {
    localStorage.clear();
    sessionStorage.clear();
    await window.sbClient.auth.signOut();
  } catch (err) {
    console.warn("SignOut error:", err);
  } finally {
    window.location.href = 'login.html';
  }
};

async function ensureProfile(user) {
  if (!user) return;
  try {
    const nick = getUsername(user);
    const { data } = await window.sbClient.from('profiles').select('id').eq('id', user.id).maybeSingle();
    if (!data) {
      await window.sbClient.from('profiles').insert([{ id: user.id, username: nick, avatar_url: DEFAULT_AVATAR }]);
    }
  } catch(e) { console.warn('ensureProfile:', e); }
}

async function loadAllProfiles() {
  try {
    const { data } = await window.sbClient.from('profiles').select('*');
    profilesMap = {};
    (data || []).forEach(p => {
      profilesMap[p.id] = { username: p.username || 'Аноним', avatar_url: p.avatar_url || DEFAULT_AVATAR, custom_frame: p.custom_frame };
    });
  } catch(e) { console.warn('loadAllProfiles:', e); }
}

async function loadAllCommunitiesCache() {
  try {
    const { data } = await window.sbClient.from('communities').select('*');
    communitiesMap = {};
    allCommunitiesCache = data || [];
    (data || []).forEach(c => { communitiesMap[c.id] = c; });
  } catch(e) { console.warn('loadAllCommunitiesCache:', e); }
}

async function loadFriends() {
  if (!activeUser) return;
  try {
    const { data } = await window.sbClient.from('friends').select('*').or(`user_id.eq.${activeUser.id},friend_id.eq.${activeUser.id}`);
    userFriendIds.clear();
    pendingOutgoingIds.clear();
    pendingIncomingIds.clear();
    (data || []).forEach(row => {
      if (row.status === 'accepted') {
        const friendId = row.user_id === activeUser.id ? row.friend_id : row.user_id;
        userFriendIds.add(friendId);
      } else if (row.status === 'pending') {
        if (row.user_id === activeUser.id) pendingOutgoingIds.add(row.friend_id);
        else pendingIncomingIds.add(row.user_id);
      }
    });
    const fb = document.getElementById('friendsBadge');
    if (fb) {
      fb.style.display = pendingIncomingIds.size > 0 ? 'inline-block' : 'none';
      fb.innerText = pendingIncomingIds.size;
    }
  } catch(e) { console.warn('loadFriends:', e); }
}

async function updateSessionState(session, isInitial = false) {
  activeUser = session && session.user ? session.user : null;
  if (activeUser) {
    try { await ensureProfile(activeUser); } catch(e){}
    try { await loadAllProfiles(); } catch(e){}
    try { await loadAllCommunitiesCache(); } catch(e){}
    try { await loadFriends(); } catch(e){}
    try { await loadUserLikes(); } catch(e){}
    try { await loadUserThemeAndFrame(); } catch(e){}
    try { await loadUserMascotVotes(); } catch(e){}
    try { await updateUnreadBadge(); } catch(e){}
    try { initRealtimeEvents(); } catch(e){}

    const myProf = profilesMap[activeUser.id];
    const su = document.getElementById('sideUsername');
    if (su) su.innerText = myProf && myProf.username ? myProf.username : getUsername(activeUser);
    const sa = document.getElementById('sideAvatar');
    if (sa) sa.src = myProf && myProf.avatar_url ? myProf.avatar_url : DEFAULT_AVATAR;

    if (isInitial) {
      if (currentTab === 'profile') switchTab('profile', viewingUserId || activeUser.id);
      else if (currentTab === 'communities' && currentCommunityId) { switchTab('communities'); openCommunity(currentCommunityId); }
      else if (currentTab === 'mascot') switchTab('mascot');
      else switchTab(currentTab || 'feed');
    }
  } else {
    window.location.replace('login.html');
  }
}

// Защита и проверка авторизации
window.sbClient.auth.getSession().then(({ data: { session } }) => {
  if (!session) window.location.replace('login.html');
  else updateSessionState(session, true);
});

window.sbClient.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_OUT' || !session) window.location.replace('login.html');
  else if (event === 'SIGNED_IN') updateSessionState(session, true);
});

function toggleMobileMenu(forceClose = false) {
  const panel = document.getElementById('sidebarPanel');
  const backdrop = document.getElementById('sidebarBackdrop');
  if (!panel || !backdrop) return;
  if (forceClose) {
    panel.classList.remove('open');
    backdrop.classList.remove('open');
  } else {
    panel.classList.toggle('open');
    backdrop.classList.toggle('open');
  }
}

function showXPBalloon(notif) {
  const balloon = document.getElementById('xpBalloon');
  const balloonText = document.getElementById('xpBalloonText');
  if (!balloon || !balloonText) return;
  balloonText.innerHTML = `<b>${escapeHtml(notif.from_username || 'bubble')}</b>: ${escapeHtml(notif.message)}`;
  balloon.style.display = 'block';
  balloon.onclick = () => {
    if (notif.post_id) openTargetPost(notif.post_id, notif.id);
    else switchTab('notifications');
    balloon.style.display = 'none';
  };
  setTimeout(() => { balloon.style.display = 'none'; }, 8000);
}

function initRealtimeEvents() {
  if (!activeUser) return;
  window.sbClient.channel('bubble_core_events')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, payload => {
      if (payload?.new && payload.new.user_id === activeUser.id) {
        updateUnreadBadge();
        loadFriends();
        showXPBalloon(payload.new);
        if (currentTab === 'notifications') loadNotifications();
      }
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
      if (payload?.new) {
        if (activeConversationId && payload.new.conversation_id === activeConversationId) appendMessageToDOM(payload.new);
        loadConversationsList();
      }
    })
    .subscribe();
}

async function updateUnreadBadge() {
  if (!activeUser) return;
  try {
    const { data } = await window.sbClient.from('notifications').select('id').eq('user_id', activeUser.id).eq('is_read', false);
    const count = (data || []).length;
    const nb = document.getElementById('notifBadge');
    if (nb) {
      nb.style.display = count > 0 ? 'inline-block' : 'none';
      nb.innerText = count;
    }
  } catch(e){}
}

async function createNotification(targetUserId, type, message, postId) {
  if (!targetUserId || !activeUser || targetUserId === activeUser.id) return;
  try {
    const myProf = profilesMap[activeUser.id];
    await window.sbClient.from('notifications').insert([{
      user_id: targetUserId, from_user_id: activeUser.id,
      from_username: myProf?.username || getUsername(activeUser),
      type, message, post_id: postId, is_read: false
    }]);
  } catch(e){}
}

function switchTab(tab, targetUserId = null) {
  currentTab = tab || 'feed';
  localStorage.setItem('bubble_active_tab', currentTab);
  toggleMobileMenu(true);

  const navMap = {
    'feed': 'btnTabFeed', 'friends_feed': 'btnTabFriendsFeed', 'communities_feed': 'btnTabCommunitiesFeed',
    'workshop': 'btnTabWorkshop', 'messenger': 'btnTabMessenger', 'friends_manager': 'btnTabFriendsManager',
    'music': 'btnTabMusic', 'communities': 'btnTabCommunities', 'notifications': 'btnTabNotifications', 'profile': 'btnTabProfile'
  };

  Object.values(navMap).forEach(id => {
    const b = document.getElementById(id);
    if (b) b.classList.remove('active');
  });
  if (navMap[currentTab]) {
    const curBtn = document.getElementById(navMap[currentTab]);
    if (curBtn) curBtn.classList.add('active');
  }

  const sections = ['sectionFeed', 'sectionMascot', 'sectionWorkshop', 'sectionMessenger', 'sectionFriendsManager', 'sectionMusic', 'sectionCommunities', 'sectionNotifications', 'sectionProfile'];
  sections.forEach(s => {
    const el = document.getElementById(s);
    if (el) el.style.display = 'none';
  });

  const urlInput = document.getElementById('urlInput');
  const feedLegend = document.getElementById('feedLegend');

  if (tab === 'feed' || tab === 'friends_feed' || tab === 'communities_feed') {
    const sf = document.getElementById('sectionFeed');
    if (sf) sf.style.display = 'block';
    if (tab === 'feed') {
      if (urlInput) urlInput.value = 'https://bubble.net/feed/all';
      if (feedLegend) feedLegend.innerText = 'Общая лента записей Bubble';
      loadFeed('all');
    } else if (tab === 'friends_feed') {
      if (urlInput) urlInput.value = 'https://bubble.net/feed/friends';
      if (feedLegend) feedLegend.innerText = 'Лента записей друзей';
      loadFeed('friends');
    } else {
      if (urlInput) urlInput.value = 'https://bubble.net/feed/communities';
      if (feedLegend) feedLegend.innerText = 'Лента публикаций всех сообществ';
      loadFeed('communities');
    }
  } else if (tab === 'mascot') {
    const sm = document.getElementById('sectionMascot');
    if (sm) sm.style.display = 'block';
    if (urlInput) urlInput.value = 'https://bubble.net/mascot';
    loadMascotVariants();
  } else if (tab === 'workshop') {
    const sw = document.getElementById('sectionWorkshop');
    if (sw) sw.style.display = 'block';
    if (urlInput) urlInput.value = 'https://bubble.net/workshop';
    loadCreationsList();
  } else if (tab === 'messenger') {
    const sme = document.getElementById('sectionMessenger');
    if (sme) sme.style.display = 'block';
    if (urlInput) urlInput.value = 'https://bubble.net/messenger';
    loadConversationsList();
  } else if (tab === 'friends_manager') {
    const sfm = document.getElementById('sectionFriendsManager');
    if (sfm) sfm.style.display = 'block';
    if (urlInput) urlInput.value = 'https://bubble.net/friends';
    loadFriendsManager();
  } else if (tab === 'music') {
    const smu = document.getElementById('sectionMusic');
    if (smu) smu.style.display = 'block';
    if (urlInput) urlInput.value = 'https://bubble.net/music';
    loadAllGlobalMusic();
  } else if (tab === 'communities') {
    const sc = document.getElementById('sectionCommunities');
    if (sc) sc.style.display = 'block';
    if (urlInput) urlInput.value = 'https://bubble.net/communities';
    showCommunitiesList();
  } else if (tab === 'notifications') {
    const sn = document.getElementById('sectionNotifications');
    if (sn) sn.style.display = 'block';
    if (urlInput) urlInput.value = 'https://bubble.net/notifications';
    loadNotifications();
  } else if (tab === 'profile') {
    const sp = document.getElementById('sectionProfile');
    if (sp) sp.style.display = 'block';
    viewingUserId = targetUserId || (activeUser ? activeUser.id : null);
    if (viewingUserId) {
      localStorage.setItem('bubble_viewing_user_id', viewingUserId);
      openUserProfile(viewingUserId);
    }
  }
}

function bindNavigation() {
  const map = {
    'btnTabFeed': 'feed', 'btnTabFriendsFeed': 'friends_feed', 'btnTabCommunitiesFeed': 'communities_feed',
    'btnTabWorkshop': 'workshop', 'btnTabMessenger': 'messenger', 'btnTabFriendsManager': 'friends_manager',
    'btnTabMusic': 'music', 'btnTabCommunities': 'communities', 'btnTabNotifications': 'notifications'
  };
  Object.entries(map).forEach(([btnId, tab]) => {
    const el = document.getElementById(btnId);
    if (el) el.onclick = () => switchTab(tab);
  });
  const btnProf = document.getElementById('btnTabProfile');
  if (btnProf) btnProf.onclick = () => { if (activeUser) switchTab('profile', activeUser.id); };

  const btnOpenMascot = document.getElementById('btnOpenMascotPage');
  if (btnOpenMascot) btnOpenMascot.onclick = () => switchTab('mascot');
  const btnBackMascot = document.getElementById('btnBackFromMascot');
  if (btnBackMascot) btnBackMascot.onclick = () => switchTab('feed');
  const btnReload = document.getElementById('btnGoReload');
  if (btnReload) btnReload.onclick = () => switchTab(currentTab, viewingUserId);

  // Кнопка выхода
  const btnLogout = document.getElementById('btnLogout');
  if (btnLogout) btnLogout.onclick = window.logoutUser;
}

window.goToProfile = function(uid) { switchTab('profile', uid); };

// ГОЛОСОВАНИЕ ЗА ИМЯ МАСКОТА
async function loadUserMascotVotes() {
  if (!activeUser) return;
  try {
    const { data } = await window.sbClient.from('mascot_votes').select('variant_id').eq('user_id', activeUser.id);
    userVotedMascotNames = new Set((data || []).map(v => v.variant_id));
    localStorage.setItem('bubble_user_voted_mascot', JSON.stringify(Array.from(userVotedMascotNames)));
  } catch(e){}
}

async function loadMascotVariants() {
  const list = document.getElementById('mascotVariantsList');
  if (!list) return;
  list.innerHTML = 'Загрузка вариантов...';
  await loadUserMascotVotes();
  const { data: variants, error } = await window.sbClient.from('mascot_names').select('*').order('votes_count', { ascending: false });
  if (error || !variants || !variants.length) {
    list.innerHTML = '<div style="color:#666; padding: 8px;">Пока нет предложенных имён. Будьте первыми!</div>';
    return;
  }
  list.innerHTML = variants.map(v => {
    const isVoted = userVotedMascotNames.has(v.id);
    return `
      <div class="mascot-variant-item ${isVoted ? 'my-voted' : ''}">
        <div>
          <span style="font-size:14px; font-weight:bold; color:#003366;">${escapeHtml(v.name_variant)}</span>
          <span style="font-size:10px; color:#666; margin-left:6px;">(от ${escapeHtml(v.creator_name)})</span>
        </div>
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="font-weight: bold; color: #0055ea;">голосов: ${v.votes_count || 0}</span>
          <button onclick="toggleMascotVote(${v.id})" style="font-size:11px; font-weight:bold;">
            ${isVoted ? '✓ Вы проголосовали' : 'Проголосовать'}
          </button>
        </div>
      </div>`;
  }).join('');
}

function initMascotModule() {
  const btnAdd = document.getElementById('btnAddMascotName');
  const input = document.getElementById('mascotNameInput');
  if (!btnAdd || !input) return;

  btnAdd.onclick = async () => {
    if (!activeUser) return alert("Войдите, чтобы предложить имя!");
    const name = input.value.trim();
    if (!name) return alert("Введите имя маскота!");
    btnAdd.disabled = true;
    const myProf = profilesMap[activeUser.id];
    const { error } = await window.sbClient.from('mascot_names').insert([{
      creator_id: activeUser.id,
      creator_name: myProf?.username || getUsername(activeUser),
      name_variant: name,
      votes_count: 1
    }]).select().single();

    if (error) {
      alert(error.code === '23505' ? "Такой вариант уже был предложен!" : "Ошибка: " + error.message);
    } else {
      const { data: created } = await window.sbClient.from('mascot_names').select('id').eq('name_variant', name).single();
      if (created) {
        await window.sbClient.from('mascot_votes').insert([{ variant_id: created.id, user_id: activeUser.id }]);
      }
      input.value = '';
      await loadMascotVariants();
    }
    btnAdd.disabled = false;
  };
}

window.toggleMascotVote = async function(variantId) {
  if (!activeUser) return alert("Войдите, чтобы голосовать!");
  const isVoted = userVotedMascotNames.has(variantId);
  const { data: row } = await window.sbClient.from('mascot_names').select('votes_count').eq('id', variantId).single();
  let currentVotes = row ? row.votes_count : 0;
  if (isVoted) {
    userVotedMascotNames.delete(variantId);
    currentVotes = Math.max(0, currentVotes - 1);
    await window.sbClient.from('mascot_votes').delete().match({ variant_id: variantId, user_id: activeUser.id });
    await window.sbClient.from('mascot_names').update({ votes_count: currentVotes }).eq('id', variantId);
  } else {
    userVotedMascotNames.add(variantId);
    currentVotes += 1;
    await window.sbClient.from('mascot_votes').insert([{ variant_id: variantId, user_id: activeUser.id }]);
    await window.sbClient.from('mascot_names').update({ votes_count: currentVotes }).eq('id', variantId);
  }
  localStorage.setItem('bubble_user_voted_mascot', JSON.stringify(Array.from(userVotedMascotNames)));
  loadMascotVariants();
};

// ЛЕНТА И ПОСТЫ
async function loadUserLikes() {
  if (!activeUser) return;
  try {
    const { data: pLikes } = await window.sbClient.from('post_likes').select('post_id').eq('user_id', activeUser.id);
    if (pLikes) userLikedPosts = new Set(pLikes.map(l => l.post_id));
    const { data: cLikes } = await window.sbClient.from('comment_likes').select('comment_id').eq('user_id', activeUser.id);
    if (cLikes) userLikedComments = new Set(cLikes.map(l => l.comment_id));
  } catch(e){}
}

function renderAvatarWithFrame(userId, isBig = false) {
  const prof = profilesMap[userId] || { avatar_url: DEFAULT_AVATAR, username: 'Аноним' };
  const cfg = prof.custom_frame;
  let frameMarkup = '';
  if (cfg) {
    const fxClasses = [];
    if (cfg.fxGlow) fxClasses.push('fx-glow');
    if (cfg.fxRainbow) fxClasses.push('fx-rainbow');
    if (cfg.fxSpin) fxClasses.push('fx-spin');
    const bgStyle = cfg.imgUrl ? `background-image: url('${cfg.imgUrl}');` : `background-color: ${cfg.color}; border: 3px solid ${cfg.color};`;
    frameMarkup = `
      <div class="avatar-frame-overlay shape-${cfg.shape || 'circle'} ${fxClasses.join(' ')}" style="--frame-color: ${cfg.color};">
        <div class="frame-inner-shape" style="${bgStyle}"></div>
      </div>`;
  }
  return `
    <div class="avatar-wrapper" style="${isBig ? 'width:68px; height:68px;' : 'width:28px; height:28px;'}">
      <img src="${prof.avatar_url}" class="${isBig ? 'profile-avatar-big' : 'avatar-mini'} ${cfg?.fxAvatarSpin ? 'avatar-spin' : ''}" alt="avatar">
      ${frameMarkup}
    </div>`;
}

function renderPostItem(p, commentsByPost, context = 'feed', canModerate = false) {
  const isPostLiked = userLikedPosts.has(p.id);
  const postComments = commentsByPost[p.id] || [];
  const currentUserId = activeUser ? activeUser.id : null;
  const isMyPost = currentUserId && p.user_id === currentUserId;
  const canDelete = isMyPost || canModerate;
  const uniquePostKey = `${context}-${p.id}`;

  let authorDisplay = '';
  if (p.community_id && communitiesMap[p.community_id]) {
    const comm = communitiesMap[p.community_id];
    authorDisplay = `
      <div class="author-info" onclick="openCommunity(${comm.id})">
        <div class="avatar-wrapper" style="width: 28px; height: 28px;">
          <img src="${comm.avatar_url || DEFAULT_AVATAR}" class="avatar-mini" alt="avatar">
        </div>
        <span class="post-author">${escapeHtml(comm.title)}</span>
        <span style="font-size:10px; color:#777; margin-left:4px;">${new Date(p.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      </div>`;
  } else {
    const prof = profilesMap[p.user_id] || { username: p.author, avatar_url: DEFAULT_AVATAR };
    authorDisplay = `
      <div class="author-info" onclick="goToProfile('${p.user_id}')">
        ${renderAvatarWithFrame(p.user_id, false)}
        <span class="post-author">${escapeHtml(prof.username)}</span>
        <span style="font-size:10px; color:#777; margin-left:4px;">${new Date(p.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      </div>`;
  }

  let repostHTML = '';
  if (p.repost_type) {
    repostHTML = `
      <div class="repost-container">
        <div class="repost-badge">Репост ${p.repost_type === 'comment' ? 'комментария' : 'записи'} (Только для друзей)</div>
        <div style="font-weight:bold; color: #003366; margin-bottom:2px;">${escapeHtml(p.repost_author)}:</div>
        <div>${escapeHtml(p.repost_content)}</div>
      </div>`;
  }

  let trackHTML = '';
  if (p.track_id) {
    const trk = allTracksCache.find(t => t.id === p.track_id);
    if (trk) {
      trackHTML = `
        <div class="post-track-box">
          <span><b>${escapeHtml(trk.artist)}</b> — ${escapeHtml(trk.title)}</span>
          <button onclick="playQueue('${JSON.stringify([trk]).replace(/"/g, '&quot;')}', 0, 'Трек из поста')" style="font-size:10px; font-weight:bold;">▶ Слушать</button>
        </div>`;
    }
  }

  return `
    <div class="post-box" id="post-${uniquePostKey}">
      <div class="post-header">
        ${authorDisplay}
        ${canDelete ? `<button class="btn-delete-post" onclick="deletePost(${p.id}, '${uniquePostKey}')">удалить</button>` : ''}
      </div>
      <div style="margin: 6px 0; word-break: break-word;">${escapeHtml(p.content)}</div>
      ${repostHTML}
      ${p.image_url ? `<img src="${p.image_url}" class="post-image" alt="Изображение поста">` : ''}
      ${trackHTML}
      <div class="post-actions">
        <button id="like-btn-${uniquePostKey}" onclick="togglePostLike(${p.id}, '${p.user_id}', '${uniquePostKey}')">
          ${isPostLiked ? '❤️' : '🤍'} <span id="like-count-${uniquePostKey}">${p.likes_count || 0}</span>
        </button>
        <button onclick="toggleCommentsVisibility('${uniquePostKey}')" style="font-size:11px;">
          💬 Комментарии (<span id="comments-count-${uniquePostKey}">${postComments.length}</span>)
        </button>
        <button onclick="openRepostModal('post', ${p.id}, '${escapeHtml(p.author).replace(/'/g, "\\'")}', '${escapeHtml(p.content).replace(/'/g, "\\"')}')" style="font-size: 11px;">
          Поделиться
        </button>
      </div>
      <div class="comments-section" id="comments-box-${uniquePostKey}">
        <div class="comments-inner">
          <div id="comments-list-${uniquePostKey}">
            ${postComments.map(c => renderCommentHTML(c, p.id, uniquePostKey, canModerate)).join('')}
          </div>
          <div style="display:flex; gap:6px; margin-top:6px;">
            <input type="text" id="comment-input-${uniquePostKey}" placeholder="Написать комментарий..." style="flex:1; font-size:11px;">
            <button onclick="sendComment(${p.id}, '${p.user_id}', '${uniquePostKey}')" style="font-size: 11px;">Ответить</button>
          </div>
        </div>
      </div>
    </div>`;
}

function renderCommentHTML(c, postId, uniquePostKey, canModerate = false) {
  const isCommentLiked = userLikedComments.has(c.id);
  const isMyComment = activeUser && c.user_id === activeUser.id;
  const cProf = profilesMap[c.user_id] || { username: c.author, avatar_url: DEFAULT_AVATAR };
  return `
    <div class="comment-item" id="comment-${c.id}">
      <div class="comment-content" style="display:flex; gap:6px; align-items:center;">
        ${renderAvatarWithFrame(c.user_id, false)}
        <div><b onclick="goToProfile('${c.user_id}')">${escapeHtml(cProf.username)}:</b> ${escapeHtml(c.content)}</div>
      </div>
      <div class="comment-controls">
        <button id="clike-btn-${c.id}" onclick="toggleCommentLike(${c.id}, '${c.user_id}', ${postId})" style="font-size:10px; padding: 2px 4px;">
          ${isCommentLiked ? '❤️' : '🤍'} <span id="clike-count-${c.id}">${c.likes_count || 0}</span>
        </button>
        <button class="btn-comment-reply" onclick="replyToComment('${uniquePostKey}', '${escapeHtml(cProf.username)}')">ответить</button>
        ${(isMyComment || canModerate) ? `<button class="btn-comment-del" title="Удалить" onclick="deleteComment(${c.id}, '${uniquePostKey}')">✖</button>` : ''}
      </div>
    </div>`;
}

async function loadFeed(feedType = 'all') {
  if (!activeUser) return;
  const feedList = document.getElementById('feedList');
  if (!feedList) return;
  feedList.innerHTML = 'Загрузка записей...';

  try {
    const { data: allTrks } = await window.sbClient.from('tracks').select('*');
    allTracksCache = allTrks || [];
  } catch(e){}

  let query = window.sbClient.from('posts').select('*').order('id', { ascending: false }).limit(35);
  if (feedType === 'all') {
    query = query.is('community_id', null).eq('is_friends_only', false);
  } else if (feedType === 'friends') {
    const feedTargetIds = Array.from(new Set([...userFriendIds, ...pendingOutgoingIds, activeUser.id]));
    query = query.is('community_id', null).in('user_id', feedTargetIds);
  } else if (feedType === 'communities') {
    query = query.not('community_id', 'is', null);
  }

  const { data: posts, error } = await query;
  if (error) { feedList.innerHTML = `<span style="color:red">Ошибка: ${error.message}</span>`; return; }
  if (!posts || !posts.length) { feedList.innerHTML = '<p>Записей пока нет.</p>'; return; }

  const postIds = posts.map(p => p.id);
  const { data: comments } = await window.sbClient.from('comments').select('*').in('post_id', postIds).order('id', { ascending: true });
  const commentsByPost = {};
  (comments || []).forEach(c => {
    if (!commentsByPost[c.post_id]) commentsByPost[c.post_id] = [];
    commentsByPost[c.post_id].push(c);
  });

  feedList.innerHTML = posts.map(p => renderPostItem(p, commentsByPost, feedType)).join('');
}

window.togglePostLike = async function(postId, postAuthorId, uniquePostKey) {
  if (!activeUser) return alert("Войдите в аккаунт, чтобы ставить лайки!");
  const countEl = document.getElementById(`like-count-${uniquePostKey}`);
  const btnEl = document.getElementById(`like-btn-${uniquePostKey}`);
  let count = parseInt(countEl?.innerText || '0');
  const currentlyLiked = userLikedPosts.has(postId);

  if (currentlyLiked) {
    userLikedPosts.delete(postId);
    count = Math.max(0, count - 1);
    if (btnEl) btnEl.innerHTML = `🤍 <span id="like-count-${uniquePostKey}">${count}</span>`;
    await window.sbClient.from('post_likes').delete().match({ post_id: postId, user_id: activeUser.id });
    await window.sbClient.from('posts').update({ likes_count: count }).eq('id', postId);
  } else {
    userLikedPosts.add(postId);
    count += 1;
    if (btnEl) btnEl.innerHTML = `❤️ <span id="like-count-${uniquePostKey}">${count}</span>`;
    await window.sbClient.from('post_likes').insert([{ post_id: postId, user_id: activeUser.id }]);
    await window.sbClient.from('posts').update({ likes_count: count }).eq('id', postId);
    await createNotification(postAuthorId, 'like_post', 'поставил(а) лайк вашему посту!', postId);
  }
};

window.toggleCommentLike = async function(commentId, commentAuthorId, postId) {
  if (!activeUser) return;
  const countEl = document.getElementById(`clike-count-${commentId}`);
  const btnEl = document.getElementById(`clike-btn-${commentId}`);
  let count = parseInt(countEl?.innerText || '0');
  const currentlyLiked = userLikedComments.has(commentId);

  if (currentlyLiked) {
    userLikedComments.delete(commentId);
    count = Math.max(0, count - 1);
    if (btnEl) btnEl.innerHTML = `🤍 <span id="clike-count-${commentId}">${count}</span>`;
    await window.sbClient.from('comment_likes').delete().match({ comment_id: commentId, user_id: activeUser.id });
    await window.sbClient.from('comments').update({ likes_count: count }).eq('id', commentId);
  } else {
    userLikedComments.add(commentId);
    count += 1;
    if (btnEl) btnEl.innerHTML = `❤️ <span id="clike-count-${commentId}">${count}</span>`;
    await window.sbClient.from('comment_likes').insert([{ comment_id: commentId, user_id: activeUser.id }]);
    await window.sbClient.from('comments').update({ likes_count: count }).eq('id', commentId);
    await createNotification(commentAuthorId, 'like_comment', 'поставил(а) лайк вашему комментарию!', postId);
  }
};

window.sendComment = async function(postId, postAuthorId, uniquePostKey) {
  if (!activeUser) return;
  const input = document.getElementById(`comment-input-${uniquePostKey}`);
  const text = input ? input.value.trim() : '';
  if (!text) return;
  const myProf = profilesMap[activeUser.id];
  const { data: newComment } = await window.sbClient.from('comments').insert([{
    post_id: postId, user_id: activeUser.id,
    author: myProf?.username || getUsername(activeUser), content: text, likes_count: 0
  }]).select().single();

  input.value = '';
  const listEl = document.getElementById(`comments-list-${uniquePostKey}`);
  if (listEl && newComment) listEl.insertAdjacentHTML('beforeend', renderCommentHTML(newComment, postId, uniquePostKey, false));
  const countEl = document.getElementById(`comments-count-${uniquePostKey}`);
  if (countEl) countEl.innerText = (parseInt(countEl.innerText) || 0) + 1;
  await createNotification(postAuthorId, 'reply_comment', `прокомментировал(а) ваш пост: "${text.substring(0, 30)}..."`, postId);
};

window.deleteComment = async function(commentId, uniquePostKey) {
  if (!confirm("Удалить комментарий?")) return;
  await window.sbClient.from('comments').delete().eq('id', commentId);
  document.getElementById(`comment-${commentId}`)?.remove();
  const countEl = document.getElementById(`comments-count-${uniquePostKey}`);
  if (countEl) countEl.innerText = Math.max(0, (parseInt(countEl.innerText) || 1) - 1);
};

window.deletePost = async function(postId, uniquePostKey) {
  if (!confirm("Удалить этот пост?")) return;
  await window.sbClient.from('posts').delete().eq('id', postId);
  document.getElementById(`post-${uniquePostKey}`)?.remove();
};

window.toggleCommentsVisibility = function(key) {
  document.getElementById(`comments-box-${key}`)?.classList.toggle('open');
};

window.replyToComment = function(key, author) {
  const box = document.getElementById(`comments-box-${key}`);
  if (box && !box.classList.contains('open')) box.classList.add('open');
  const input = document.getElementById(`comment-input-${key}`);
  if (input) { input.value = `@${author}, ` + input.value; input.focus(); }
};

function initFeedModule() {
  const btnCreate = document.getElementById('btnCreatePost');
  const postImageFile = document.getElementById('postImageFile');
  const postContent = document.getElementById('postContent');
  const uploadStatus = document.getElementById('uploadStatus');

  if (btnCreate) {
    btnCreate.onclick = async () => {
      if (!activeUser) return;
      const file = postImageFile?.files[0];
      const text = postContent?.value.trim() || '';
      if (!text && !file && !selectedPostTrack) return alert("Введите текст, прикрепите фото или выберите песню!");
      btnCreate.disabled = true;

      let imageUrl = null;
      if (file) {
        const fileExt = file.name.split('.').pop();
        const fileName = `post_${activeUser.id}_${Date.now()}.${fileExt}`;
        const { error } = await window.sbClient.storage.from('post_images').upload(fileName, file);
        if (!error) imageUrl = window.sbClient.storage.from('post_images').getPublicUrl(fileName).data.publicUrl;
      }

      const myProf = profilesMap[activeUser.id];
      await window.sbClient.from('posts').insert([{
        author: myProf?.username || getUsername(activeUser),
        content: text, user_id: activeUser.id, community_id: null,
        image_url: imageUrl, track_id: selectedPostTrack ? selectedPostTrack.id : null,
        is_friends_only: false, likes_count: 0
      }]);

      btnCreate.disabled = false;
      if (postContent) postContent.value = '';
      if (postImageFile) postImageFile.value = '';
      selectedPostTrack = null;
      const preview = document.getElementById('postAttachedTrackPreview');
      if (preview) preview.style.display = 'none';
      loadFeed(currentTab === 'friends_feed' ? 'friends' : (currentTab === 'communities_feed' ? 'communities' : 'all'));
    };
  }

  // Очистка прикрепленного фото к посту
  const btnClearImg = document.getElementById('btnClearPostImage');
  if (postImageFile && btnClearImg) {
    postImageFile.addEventListener('change', () => {
      btnClearImg.style.display = postImageFile.files.length ? 'inline-block' : 'none';
    });
    btnClearImg.onclick = () => {
      postImageFile.value = '';
      btnClearImg.style.display = 'none';
    };
  }
}

// УВЕДОМЛЕНИЯ И ДРУЗЬЯ
async function loadNotifications() {
  if (!activeUser) return;
  const list = document.getElementById('notificationsList');
  if (!list) return;
  const { data: notifs } = await window.sbClient.from('notifications').select('*').eq('user_id', activeUser.id).order('id', { ascending: false });
  if (!notifs || !notifs.length) { list.innerHTML = '<p>Уведомлений нет.</p>'; return; }

  list.innerHTML = notifs.map(n => `
    <div class="notification-item" style="${n.is_read ? 'opacity:0.6;' : 'background:#fff8db; font-weight:bold;'}">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <span onclick="${n.post_id ? `openTargetPost(${n.post_id}, ${n.id})` : `goToProfile('${n.from_user_id}')`}" style="cursor:pointer; flex:1;">
          <b>${escapeHtml(n.from_username)}</b>: ${escapeHtml(n.message)}
          <div style="font-size:9px; color:#888;">${new Date(n.created_at).toLocaleString()}</div>
        </span>
        ${n.type === 'friend_request' ? `
          <div style="display:flex; gap:4px;">
            <button onclick="respondFriendRequest('${n.from_user_id}', ${n.id}, true)" style="font-size:10px;">Принять</button>
            <button onclick="respondFriendRequest('${n.from_user_id}', ${n.id}, false)" style="font-size:10px; color:#a00;">Отклонить</button>
          </div>` : ''}
      </div>
    </div>`).join('');
}

function initFriendsManagerModule() {
  const btnMark = document.getElementById('btnMarkAllRead');
  if (btnMark) {
    btnMark.onclick = async () => {
      if (!activeUser) return;
      await window.sbClient.from('notifications').update({ is_read: true }).eq('user_id', activeUser.id);
      await updateUnreadBadge();
      loadNotifications();
    };
  }
}

window.respondFriendRequest = async function(senderId, notifId, accept) {
  if (!activeUser) return;
  if (accept) {
    await window.sbClient.from('friends').update({ status: 'accepted' }).match({ user_id: senderId, friend_id: activeUser.id });
    await createNotification(senderId, 'friend_accept', 'принял(а) вашу заявку в друзья!', null);
  } else {
    await window.sbClient.from('friends').delete().match({ user_id: senderId, friend_id: activeUser.id, status: 'pending' });
  }
  await window.sbClient.from('notifications').update({ is_read: true }).eq('id', notifId);
  await loadFriends();
  await updateUnreadBadge();
  loadNotifications();
};

window.openTargetPost = async function(postId, notifId) {
  if (notifId && activeUser) await window.sbClient.from('notifications').update({ is_read: true }).eq('id', notifId);
  switchTab('feed');
  setTimeout(() => {
    const el = document.getElementById(`post-feed-${postId}`);
    if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.add('highlight'); }
  }, 500);
};

async function loadFriendsManager() {
  await loadFriends();
  const cAcc = document.getElementById('countAccepted');
  if (cAcc) cAcc.innerText = userFriendIds.size;
  const cInc = document.getElementById('countIncoming');
  if (cInc) cInc.innerText = pendingIncomingIds.size;
  const cOut = document.getElementById('countOutgoing');
  if (cOut) cOut.innerText = pendingOutgoingIds.size;

  const listInc = document.getElementById('listIncomingReqs');
  if (listInc) {
    listInc.innerHTML = pendingIncomingIds.size === 0 ? '<div style="font-size:11px; color:#666;">Нет входящих заявок</div>' :
      Array.from(pendingIncomingIds).map(uid => `
        <div class="participant-select-item">
          <div style="display:flex; align-items:center; gap:6px;" onclick="goToProfile('${uid}')">
            ${renderAvatarWithFrame(uid, false)}
            <b>${escapeHtml(profilesMap[uid]?.username || 'Пользователь')}</b>
          </div>
          <div>
            <button onclick="handleFriendRequestInManager('${uid}', true)">Принять</button>
            <button onclick="handleFriendRequestInManager('${uid}', false)" style="color:#a00;">Отклонить</button>
          </div>
        </div>`).join('');
  }

  const listAcc = document.getElementById('listAcceptedFriends');
  if (listAcc) {
    listAcc.innerHTML = userFriendIds.size === 0 ? '<div style="font-size:11px; color:#666;">Список друзей пуст</div>' :
      Array.from(userFriendIds).map(uid => `
        <div class="participant-select-item" onclick="goToProfile('${uid}')" style="cursor:pointer;">
          <div style="display:flex; align-items:center; gap:6px;">
            ${renderAvatarWithFrame(uid, false)}
            <b>${escapeHtml(profilesMap[uid]?.username || 'Пользователь')}</b>
          </div>
          <span style="font-size:10px; color:#0055ea;">Открыть профиль »</span>
        </div>`).join('');
  }

  const listOut = document.getElementById('listOutgoingReqs');
  if (listOut) {
    listOut.innerHTML = pendingOutgoingIds.size === 0 ? '<div style="font-size:11px; color:#666;">Нет отправленных заявок</div>' :
      Array.from(pendingOutgoingIds).map(uid => `
        <div class="participant-select-item">
          <div style="display:flex; align-items:center; gap:6px;" onclick="goToProfile('${uid}')">
            ${renderAvatarWithFrame(uid, false)}
            <span><b>${escapeHtml(profilesMap[uid]?.username || 'Пользователь')}</b> (ожидание)</span>
          </div>
          <button onclick="cancelOutgoingRequest('${uid}')" style="font-size:10px;">Отменить заявку</button>
        </div>`).join('');
  }
}

window.handleFriendRequestInManager = async function(sid, accept) {
  if (accept) {
    await window.sbClient.from('friends').update({ status: 'accepted' }).match({ user_id: sid, friend_id: activeUser.id });
    await createNotification(sid, 'friend_accept', 'принял(а) вашу заявку в друзья!', null);
  } else {
    await window.sbClient.from('friends').delete().match({ user_id: sid, friend_id: activeUser.id, status: 'pending' });
  }
  loadFriendsManager();
};

window.cancelOutgoingRequest = async function(fid) {
  await window.sbClient.from('friends').delete().match({ user_id: activeUser.id, friend_id: fid, status: 'pending' });
  loadFriendsManager();
};

// Запуск инициализации при загрузке документа
function initApp() {
  const btnToggleSidebar = document.getElementById('btnToggleSidebar');
  const sidebarBackdrop = document.getElementById('sidebarBackdrop');
  if (btnToggleSidebar) btnToggleSidebar.onclick = () => toggleMobileMenu();
  if (sidebarBackdrop) sidebarBackdrop.onclick = () => toggleMobileMenu(true);

  bindNavigation();
  initMascotModule();
  initFeedModule();
  initFriendsManagerModule();

  setInterval(() => {
    const clk = document.getElementById('clock');
    if (clk) clk.innerText = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }, 1000);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
