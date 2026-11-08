// АУДИОПЛЕЕР И МЕДИАТЕКА
const audioPlayer = document.getElementById('globalAudioPlayer');
const btnPlayPause = document.getElementById('btnPlayPause');
const currentTrackDisplay = document.getElementById('currentTrackDisplay');
const currentPlaylistDisplay = document.getElementById('currentPlaylistDisplay');

if (audioPlayer) {
  audioPlayer.addEventListener('timeupdate', () => {
    if (playlistQueue.length && currentTrackIndex !== null) {
      localStorage.setItem('bubble_audio_state', JSON.stringify({
        queue: playlistQueue, index: currentTrackIndex, time: audioPlayer.currentTime,
        isPlaying: !audioPlayer.paused, playlistTitle: currentPlaylistDisplay?.innerText || ''
      }));
    }
  });

  audioPlayer.addEventListener('pause', () => {
    const saved = localStorage.getItem('bubble_audio_state');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        data.isPlaying = false;
        localStorage.setItem('bubble_audio_state', JSON.stringify(data));
      } catch(e){}
    }
  });

  audioPlayer.onended = () => {
    if (loopMode === 'track') {
      audioPlayer.currentTime = 0; audioPlayer.play();
    } else if (loopMode === 'all' || currentTrackIndex + 1 < playlistQueue.length) {
      currentTrackIndex = (currentTrackIndex + 1) % playlistQueue.length;
      playCurrentTrack();
    }
  };
}

function restoreAudioPlayback() {
  const saved = localStorage.getItem('bubble_audio_state');
  if (!saved) return;
  try {
    const data = JSON.parse(saved);
    if (data.queue && data.queue[data.index]) {
      playlistQueue = data.queue;
      currentTrackIndex = data.index;
      if (currentPlaylistDisplay) currentPlaylistDisplay.innerText = data.playlistTitle || 'Плейлист';
      const track = playlistQueue[currentTrackIndex];
      audioPlayer.src = track.audio_url;
      audioPlayer.currentTime = data.time || 0;
      if (currentTrackDisplay) currentTrackDisplay.innerText = `Звучит: ${track.artist} — ${track.title}`;
    }
  } catch(e){}
}
restoreAudioPlayback();

window.playQueue = function(tracks, startIndex = 0, name = 'Список') {
  const parsedTracks = typeof tracks === 'string' ? JSON.parse(tracks) : tracks;
  playlistQueue = parsedTracks;
  currentTrackIndex = startIndex;
  if (currentPlaylistDisplay) currentPlaylistDisplay.innerText = `${name} (${parsedTracks.length} треков)`;
  playCurrentTrack();
};

function playCurrentTrack() {
  if (currentTrackIndex < 0 || currentTrackIndex >= playlistQueue.length) return;
  const track = playlistQueue[currentTrackIndex];
  audioPlayer.src = track.audio_url;
  audioPlayer.play();
  if (btnPlayPause) btnPlayPause.innerText = '⏸ Пауза';
  if (currentTrackDisplay) currentTrackDisplay.innerText = `Звучит: ${track.artist} — ${track.title}`;
}

document.addEventListener('DOMContentLoaded', () => {
  if (btnPlayPause) {
    btnPlayPause.onclick = () => {
      if (!audioPlayer.src) return;
      if (audioPlayer.paused) { audioPlayer.play(); btnPlayPause.innerText = '⏸ Пауза'; }
      else { audioPlayer.pause(); btnPlayPause.innerText = '▶ Играть'; }
    };
  }

  const btnNext = document.getElementById('btnNextTrack');
  if (btnNext) btnNext.onclick = () => {
    if (!playlistQueue.length) return;
    currentTrackIndex = (currentTrackIndex + 1) % playlistQueue.length;
    playCurrentTrack();
  };

  const btnPrev = document.getElementById('btnPrevTrack');
  if (btnPrev) btnPrev.onclick = () => {
    if (!playlistQueue.length) return;
    currentTrackIndex = (currentTrackIndex - 1 + playlistQueue.length) % playlistQueue.length;
    playCurrentTrack();
  };

  const btnLoopTrack = document.getElementById('btnLoopTrack');
  const btnLoopAll = document.getElementById('btnLoopAll');
  if (btnLoopTrack) btnLoopTrack.onclick = () => {
    loopMode = loopMode === 'track' ? 'none' : 'track';
    btnLoopTrack.classList.toggle('loop-active', loopMode === 'track');
    btnLoopAll?.classList.remove('loop-active');
  };
  if (btnLoopAll) btnLoopAll.onclick = () => {
    loopMode = loopMode === 'all' ? 'none' : 'all';
    btnLoopAll.classList.toggle('loop-active', loopMode === 'all');
    btnLoopTrack?.classList.remove('loop-active');
  };

  initThemeAndFrameWorkshop();
  initMessengerModule();
  initCommunitiesModule();
});

// МАСТЕРСКАЯ ОФОРМЛЕНИЯ
function initThemeAndFrameWorkshop() {
  const btnSwitchTheme = document.getElementById('btnSwitchToThemeCreator');
  const btnSwitchFrame = document.getElementById('btnSwitchToFrameCreator');
  const boxTheme = document.getElementById('boxThemeCreator');
  const boxFrame = document.getElementById('boxFrameCreator');

  if (btnSwitchTheme && btnSwitchFrame && boxTheme && boxFrame) {
    btnSwitchTheme.onclick = () => {
      btnSwitchTheme.style.fontWeight = 'bold'; btnSwitchFrame.style.fontWeight = 'normal';
      boxTheme.style.display = 'block'; boxFrame.style.display = 'none';
    };
    btnSwitchFrame.onclick = () => {
      btnSwitchFrame.style.fontWeight = 'bold'; btnSwitchTheme.style.fontWeight = 'normal';
      boxTheme.style.display = 'none'; boxFrame.style.display = 'block';
    };
  }

  const inputs = ['themeFontSelect', 'themeFontSizeInput', 'themePanelOpacityInput', 'themeBtnOpacityInput', 'themeHeaderColor', 'themePlayerColor', 'themeMainBgColor', 'themeSidebarColor', 'themeCardColor', 'themeBtnBgColor', 'themeBtnTextColor', 'themeTextColor'];
  inputs.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', updateLiveThemePreview);
  });

  const frameInputs = ['frameShapeSelect', 'frameColorInput', 'frameFxGlow', 'frameFxRainbow', 'frameFxSpin', 'frameFxAvatarSpin'];
  frameInputs.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', updateLiveFramePreview);
  });

  const btnReset = document.getElementById('btnResetAllStyles');
  if (btnReset) {
    btnReset.onclick = async () => {
      localStorage.removeItem('bubble_applied_theme');
      localStorage.removeItem('bubble_applied_frame');
      document.getElementById('dynamicCustomThemeStyle').innerHTML = '';
      document.body.style.backgroundImage = 'url(bg.jpg)';
      document.body.style.fontFamily = 'Tahoma, sans-serif';
      if (activeUser) {
        await window.sbClient.from('profiles').update({ custom_theme: null, custom_frame: null }).eq('id', activeUser.id);
        if (profilesMap[activeUser.id]) profilesMap[activeUser.id].custom_frame = null;
      }
      alert("Оформление возвращено к исходной теме!");
    };
  }
}

function updateLiveThemePreview() {
  const fs = document.getElementById('themeFontSizeInput')?.value || 11;
  const fsv = document.getElementById('themeFontSizeVal');
  if (fsv) fsv.innerText = fs;

  const font = document.getElementById('themeFontSelect')?.value;
  const mainBg = document.getElementById('themeMainBgColor')?.value;
  const prevBox = document.getElementById('liveThemePreview');
  if (prevBox) {
    if (font) prevBox.style.fontFamily = font;
    if (mainBg) prevBox.style.backgroundColor = mainBg;
  }
}

function updateLiveFramePreview() {
  const shape = document.getElementById('frameShapeSelect')?.value || 'circle';
  const color = document.getElementById('frameColorInput')?.value || '#0055ea';
  const isGlow = document.getElementById('frameFxGlow')?.checked;
  const isRainbow = document.getElementById('frameFxRainbow')?.checked;
  const isSpin = document.getElementById('frameFxSpin')?.checked;
  const isAvatarSpin = document.getElementById('frameFxAvatarSpin')?.checked;

  const prev = document.getElementById('prevFrameOverlay');
  if (!prev) return;
  prev.className = `avatar-frame-overlay shape-${shape}`;
  if (isGlow) prev.classList.add('fx-glow');
  if (isRainbow) prev.classList.add('fx-rainbow');
  if (isSpin) prev.classList.add('fx-spin');
  prev.style.setProperty('--frame-color', color);

  const sample = document.getElementById('prevAvatarImgSample');
  if (sample) sample.classList.toggle('avatar-spin', !!isAvatarSpin);
  const inner = prev.querySelector('.frame-inner-shape');
  if (inner) { inner.style.backgroundColor = color; inner.style.border = `4px solid ${color}`; }
}

async function loadCreationsList() {
  const list = document.getElementById('creationsListContainer');
  if (!list) return;
  list.innerHTML = 'Загрузка каталога работ...';
  const { data: creations, error } = await window.sbClient.from('community_creations').select('*').order('id', { ascending: false });
  if (error || !creations || !creations.length) {
    list.innerHTML = '<p>Пока нет опубликованных тем или рамок.</p>';
    return;
  }
  list.innerHTML = creations.map(c => {
    const isTheme = c.type === 'theme';
    return `
      <div class="creation-card" id="creation-${c.id}">
        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
          <div style="font-weight:bold; font-size:12px; color:#003366;">${escapeHtml(c.title)}</div>
        </div>
        <div style="font-size:10px; color:#666; margin:4px 0;">${isTheme ? 'Тема оформления' : 'Рамочка аватара'}</div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px; border-top:1px dotted #ccc; padding-top:4px;">
          <button onclick="applyCreation(${c.id}, '${c.type}', '${JSON.stringify(c.config).replace(/"/g, '&quot;')}')" style="font-size:11px; font-weight:bold;">Применить</button>
          <span>❤️ ${c.likes_count || 0}</span>
        </div>
      </div>`;
  }).join('');
}

window.applyCreation = async function(id, type, cfgString) {
  if (!activeUser) return;
  const cfg = typeof cfgString === 'string' ? JSON.parse(cfgString) : cfgString;
  if (type === 'theme') {
    localStorage.setItem('bubble_applied_theme', JSON.stringify(cfg));
    applyThemeStyles(cfg);
    await window.sbClient.from('profiles').update({ custom_theme: cfg }).eq('id', activeUser.id);
    alert("Тема оформления сохранена!");
  } else {
    localStorage.setItem('bubble_applied_frame', JSON.stringify(cfg));
    applyFrameStyles(cfg);
    await window.sbClient.from('profiles').update({ custom_frame: cfg }).eq('id', activeUser.id);
    if (profilesMap[activeUser.id]) profilesMap[activeUser.id].custom_frame = cfg;
    alert("Рамочка надета!");
  }
};

function applyThemeStyles(cfg) {
  if (!cfg) return;
  let css = '';
  if (cfg.font) css += `body, button, input, select, textarea { font-family: ${cfg.font} !important; }\n`;
  if (cfg.headerColor) css += `.aero-title-bar { background: ${cfg.headerColor} !important; }\n`;
  if (cfg.playerColor) css += `.player-dock { background: ${cfg.playerColor} !important; }\n`;
  if (cfg.mainBgColor) css += `.main-view, .window-body-layout { background-color: ${cfg.mainBgColor} !important; }\n`;
  if (cfg.sidebarColor) css += `.sidebar { background: ${cfg.sidebarColor} !important; }\n`;
  if (cfg.cardColor) css += `.post-box, .profile-card, .community-card { background-color: ${cfg.cardColor} !important; }\n`;
  const styleEl = document.getElementById('dynamicCustomThemeStyle');
  if (styleEl) styleEl.innerHTML = css;
}

function applyFrameStyles(cfg) {
  if (!cfg) return;
  const overlay = document.getElementById('userProfileFrameOverlay');
  if (overlay) {
    overlay.style.display = 'flex';
    overlay.className = `avatar-frame-overlay shape-${cfg.shape || 'circle'}`;
    if (cfg.fxGlow) overlay.classList.add('fx-glow');
    if (cfg.fxRainbow) overlay.classList.add('fx-rainbow');
    if (cfg.fxSpin) overlay.classList.add('fx-spin');
    overlay.style.setProperty('--frame-color', cfg.color);
  }
}

async function loadUserThemeAndFrame() {
  if (!activeUser) return;
  try {
    const { data } = await window.sbClient.from('profiles').select('custom_theme, custom_frame').eq('id', activeUser.id).single();
    if (data?.custom_theme) applyThemeStyles(data.custom_theme);
    if (data?.custom_frame) applyFrameStyles(data.custom_frame);
  } catch(e){}
}

// МЕССЕНДЖЕР
function initMessengerModule() {
  const btnSend = document.getElementById('btnSendChatMessage');
  const input = document.getElementById('chatMsgInput');
  if (btnSend && input) {
    const send = async () => {
      const text = input.value.trim();
      if (!text || !activeConversationId || !activeUser) return;
      input.value = '';
      await window.sbClient.from('messages').insert([{
        conversation_id: activeConversationId,
        sender_id: activeUser.id,
        content: text
      }]);
    };
    btnSend.onclick = send;
    input.onkeydown = (e) => { if (e.key === 'Enter') send(); };
  }
}

async function loadConversationsList() {
  if (!activeUser) return;
  const list = document.getElementById('chatsListContainer');
  if (!list) return;
  list.innerHTML = 'Загрузка...';
  const { data: parts } = await window.sbClient.from('conversation_participants').select('conversation_id').eq('user_id', activeUser.id);
  const convIds = (parts || []).map(p => p.conversation_id);
  if (!convIds.length) { list.innerHTML = '<div style="font-size:11px; padding:10px; color:#777;">Нет диалогов</div>'; return; }

  const { data: convs } = await window.sbClient.from('conversations').select('*').in('id', convIds).order('id', { ascending: false });
  list.innerHTML = (convs || []).map(c => `
    <div class="messenger-chat-item ${activeConversationId === c.id ? 'active' : ''}" onclick="openConversation(${c.id})">
      <b>${escapeHtml(c.title || 'Диалог')}</b>
    </div>`).join('');
}

async function openConversation(convId) {
  activeConversationId = convId;
  const bar = document.getElementById('chatHeaderBar');
  const inputBar = document.getElementById('chatInputBar');
  const msgsList = document.getElementById('chatMessagesList');
  if (bar) bar.style.display = 'flex';
  if (inputBar) inputBar.style.display = 'flex';
  if (msgsList) msgsList.innerHTML = 'Загрузка сообщений...';

  const { data: msgs } = await window.sbClient.from('messages').select('*').eq('conversation_id', convId).order('id', { ascending: true });
  if (msgsList) {
    msgsList.innerHTML = '';
    (msgs || []).forEach(m => appendMessageToDOM(m));
  }
}

function appendMessageToDOM(msg) {
  const list = document.getElementById('chatMessagesList');
  if (!list) return;
  const isMine = activeUser && msg.sender_id === activeUser.id;
  const el = document.createElement('div');
  el.className = `msg-bubble ${isMine ? 'msg-out' : 'msg-in'}`;
  el.innerHTML = `<div>${escapeHtml(msg.content)}</div>`;
  list.appendChild(el);
  list.scrollTop = list.scrollHeight;
}

// СООБЩЕСТВА
function initCommunitiesModule() {
  const btnCreate = document.getElementById('btnCreateCommunity');
  if (btnCreate) {
    btnCreate.onclick = async () => {
      const title = document.getElementById('newCommTitle')?.value.trim();
      const desc = document.getElementById('newCommDesc')?.value.trim();
      if (!title || !activeUser) return alert("Введите название сообщества!");
      const { data: comm } = await window.sbClient.from('communities').insert([{
        title, description: desc, creator_id: activeUser.id
      }]).select().single();

      if (comm) {
        await window.sbClient.from('community_members').insert([{
          community_id: comm.id, user_id: activeUser.id, role: 'creator'
        }]);
        await loadAllCommunitiesCache();
        openCommunity(comm.id);
      }
    };
  }
}

function showCommunitiesList() {
  const vList = document.getElementById('communityViewList');
  const vSingle = document.getElementById('communityViewSingle');
  if (vList) vList.style.display = 'block';
  if (vSingle) vSingle.style.display = 'none';

  const container = document.getElementById('communitiesListContainer');
  if (!container) return;
  container.innerHTML = allCommunitiesCache.map(c => `
    <div class="community-card">
      <div class="community-info" onclick="openCommunity(${c.id})">
        <b>${escapeHtml(c.title)}</b>
      </div>
      <button onclick="openCommunity(${c.id})">Открыть</button>
    </div>`).join('');
}

window.openCommunity = async function(commId) {
  currentCommunityId = commId;
  const vList = document.getElementById('communityViewList');
  const vSingle = document.getElementById('communityViewSingle');
  if (vList) vList.style.display = 'none';
  if (vSingle) vSingle.style.display = 'block';

  const comm = communitiesMap[commId];
  if (comm) {
    const titleEl = document.getElementById('commTitle');
    if (titleEl) titleEl.innerText = comm.title;
  }
};

// ПРОФИЛЬ
async function openUserProfile(userId) {
  const myProf = profilesMap[userId];
  const nickEl = document.getElementById('profileNick');
  if (nickEl) nickEl.innerText = myProf ? myProf.username : 'Пользователь';
}
