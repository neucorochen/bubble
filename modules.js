// ==========================================
// BUBBLE — MODULES.JS (Музыка, Мастерская, Сообщества, Мессенджер, Профиль)
// ==========================================

// --- АУДИОПЛЕЕР И МЕДИАТЕКА ---
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

// Загрузка музыки пользователя и Drag-and-Drop
async function loadUserMusic(userId, activePlaylistId = null) {
  const container = document.getElementById('profileTracksList');
  const playlistTabs = document.getElementById('playlistSelectContainer');
  if (!container) return;
  container.innerHTML = 'Загрузка аудиозаписей...';

  const isMyProfile = activeUser && activeUser.id === userId;
  const { data: playlists } = await window.sbClient
    .from('playlists')
    .select('*')
    .eq('user_id', userId)
    .order('id', { ascending: true });

  if (playlistTabs) {
    let tabsHTML = `<button class="playlist-tab-btn ${!activePlaylistId ? 'active' : ''}" onclick="loadUserMusic('${userId}', null)">Вся музыка</button>`;
    (playlists || []).forEach(pl => {
      tabsHTML += `
        <div class="playlist-tab-btn ${activePlaylistId === pl.id ? 'active' : ''}">
          <span onclick="loadUserMusic('${userId}', ${pl.id})" style="cursor:pointer;">${escapeHtml(pl.title)}</span>
          ${isMyProfile ? `<button class="btn-del-playlist" onclick="deleteUserPlaylist(${pl.id}, '${userId}')" title="Удалить">✖</button>` : ''}
        </div>`;
    });
    playlistTabs.innerHTML = tabsHTML;
  }

  let tracksData = [];
  if (activePlaylistId) {
    const { data } = await window.sbClient
      .from('playlist_tracks')
      .select('id, position, track_id, tracks(*)')
      .eq('playlist_id', activePlaylistId)
      .order('position', { ascending: true });
    tracksData = (data || []).filter(d => d.tracks);
  } else {
    const { data } = await window.sbClient
      .from('user_tracks')
      .select('track_id, tracks(*)')
      .eq('user_id', userId);
    tracksData = (data || []).filter(d => d.tracks).map(d => ({ tracks: d.tracks }));
  }

  if (!tracksData.length) {
    container.innerHTML = '<div style="font-size:11px; color:#666; padding: 4px;">В списке пока нет аудиозаписей.</div>';
    return;
  }

  const tracksQueue = tracksData.map(d => d.tracks);
  const canDrag = isMyProfile && activePlaylistId;

  container.innerHTML = tracksData.map((item, idx) => {
    const t = item.tracks;
    const isFirst = idx === 0;
    const isLast = idx === tracksData.length - 1;
    return `
      <div class="track-list-item ${canDrag ? 'draggable' : ''}" ${canDrag ? `draggable="true" data-row-id="${item.id}"` : ''}>
        ${canDrag ? `<span class="drag-handle" title="Зажмите для перетаскивания">☰</span>` : ''}
        <div style="flex:1; cursor:pointer;" onclick="playQueue('${JSON.stringify(tracksQueue).replace(/"/g, '&quot;')}', ${idx}, '${activePlaylistId ? 'Плейлист' : 'Библиотека'}')">
          <b>${escapeHtml(t.artist)}</b> — ${escapeHtml(t.title)}
        </div>
        <div style="display:flex; gap:3px; align-items:center;">
          ${canDrag ? `
            <button onclick="moveTrackInPlaylist(${activePlaylistId}, ${item.id}, 'up')" ${isFirst ? 'disabled style="opacity:0.4;"' : ''} style="font-size:10px;">▲</button>
            <button onclick="moveTrackInPlaylist(${activePlaylistId}, ${item.id}, 'down')" ${isLast ? 'disabled style="opacity:0.4;"' : ''} style="font-size:10px;">▼</button>
          ` : ''}
          ${isMyProfile && !activePlaylistId && (playlists || []).length ? `
            <select onchange="addTrackToPlaylist(${t.id}, this.value); this.value='';" style="font-size:10px;">
              <option value="">В плейлист...</option>
              ${playlists.map(p => `<option value="${p.id}">${escapeHtml(p.title)}</option>`).join('')}
            </select>
          ` : ''}
          ${isMyProfile ? `<button onclick="removeTrackFromProfile(${t.id}, ${activePlaylistId})" title="Удалить" style="font-size:10px; color:#a00;">✖</button>` : ''}
        </div>
      </div>`;
  }).join('');

  if (canDrag) initPlaylistDragAndDrop(activePlaylistId);
}

let draggedItem = null;
function initPlaylistDragAndDrop(playlistId) {
  const container = document.getElementById('profileTracksList');
  if (!container) return;
  const items = container.querySelectorAll('.track-list-item.draggable');

  items.forEach(item => {
    item.addEventListener('dragstart', (e) => {
      draggedItem = item;
      setTimeout(() => item.classList.add('dragging'), 0);
      e.dataTransfer.effectAllowed = 'move';
    });

    item.addEventListener('dragend', async () => {
      if (!draggedItem) return;
      draggedItem.classList.remove('dragging');
      items.forEach(i => i.classList.remove('drag-over'));
      draggedItem = null;
      await savePlaylistOrder(playlistId);
    });

    item.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (item !== draggedItem) item.classList.add('drag-over');
    });

    item.addEventListener('dragleave', () => item.classList.remove('drag-over'));

    item.addEventListener('drop', (e) => {
      e.preventDefault();
      item.classList.remove('drag-over');
      if (item === draggedItem) return;
      const bounding = item.getBoundingClientRect();
      const offset = e.clientY - bounding.top;
      if (offset > bounding.height / 2) item.after(draggedItem);
      else item.before(draggedItem);
    });
  });
}

async function savePlaylistOrder(playlistId) {
  if (!activeUser) return;
  const container = document.getElementById('profileTracksList');
  const elements = container.querySelectorAll('.track-list-item.draggable');
  const updates = [];
  elements.forEach((el, index) => {
    const rowId = parseInt(el.getAttribute('data-row-id'));
    if (rowId) {
      updates.push(window.sbClient.from('playlist_tracks').update({ position: index + 1 }).eq('id', rowId));
    }
  });
  await Promise.all(updates);
}

window.moveTrackInPlaylist = async function(playlistId, rowId, direction) {
  if (!activeUser) return;
  const { data: rows } = await window.sbClient
    .from('playlist_tracks')
    .select('id, position')
    .eq('playlist_id', playlistId)
    .order('position', { ascending: true });

  if (!rows) return;
  const currIdx = rows.findIndex(r => r.id === rowId);
  if (currIdx === -1) return;
  const targetIdx = direction === 'up' ? currIdx - 1 : currIdx + 1;
  if (targetIdx < 0 || targetIdx >= rows.length) return;

  const currRow = rows[currIdx];
  const targetRow = rows[targetIdx];

  await window.sbClient.from('playlist_tracks').update({ position: targetRow.position }).eq('id', currRow.id);
  await window.sbClient.from('playlist_tracks').update({ position: currRow.position }).eq('id', targetRow.id);
  loadUserMusic(activeUser.id, playlistId);
};

window.deleteUserPlaylist = async function(playlistId, userId) {
  if (!confirm("Удалить этот плейлист?")) return;
  await window.sbClient.from('playlists').delete().eq('id', playlistId);
  loadUserMusic(userId, null);
};

window.addTrackToPlaylist = async function(trackId, playlistId) {
  if (!playlistId || !activeUser) return;
  const { data: currentTracks } = await window.sbClient
    .from('playlist_tracks')
    .select('position')
    .eq('playlist_id', playlistId)
    .order('position', { ascending: false })
    .limit(1);

  const nextPos = (currentTracks && currentTracks[0]?.position) ? currentTracks[0].position + 1 : 1;
  const { error } = await window.sbClient.from('playlist_tracks').insert([{ playlist_id: playlistId, track_id: trackId, position: nextPos }]);
  if (error && error.code === '23505') alert("Трек уже в плейлисте!");
  else alert("Трек добавлен в плейлист!");
};

window.removeTrackFromProfile = async function(trackId, activePlaylistId) {
  if (!confirm("Удалить трек?")) return;
  if (activePlaylistId) {
    await window.sbClient.from('playlist_tracks').delete().match({ playlist_id: activePlaylistId, track_id: trackId });
  } else {
    await window.sbClient.from('user_tracks').delete().match({ user_id: activeUser.id, track_id: trackId });
  }
  loadUserMusic(activeUser.id, activePlaylistId);
};

// --- ВСЯ МУЗЫКА (ГЛОБАЛЬНАЯ) ---
async function loadAllGlobalMusic() {
  const container = document.getElementById('allTracksList');
  if (!container) return;
  container.innerHTML = 'Загрузка медиатеки...';
  const { data: tracks } = await window.sbClient.from('tracks').select('*').order('id', { ascending: false });
  allTracksCache = tracks || [];
  if (!allTracksCache.length) {
    container.innerHTML = '<p>Треков пока нет.</p>';
    return;
  }
  renderGlobalTracksList(allTracksCache);
}

function renderGlobalTracksList(tracks) {
  const container = document.getElementById('allTracksList');
  if (!container) return;
  container.innerHTML = tracks.map((t, idx) => `
    <div class="track-list-item">
      <div style="flex:1; cursor:pointer;" onclick="playQueue('${JSON.stringify(tracks).replace(/"/g, '&quot;')}', ${idx}, 'Медиатека Bubble')">
        <b>${escapeHtml(t.artist)}</b> — ${escapeHtml(t.title)}
      </div>
      <button onclick="addTrackToMyLibrary(${t.id})" style="font-size:10px;">+ Себе</button>
    </div>
  `).join('');
}

window.addTrackToMyLibrary = async function(trackId) {
  if (!activeUser) return alert("Войдите в аккаунт!");
  const { error } = await window.sbClient.from('user_tracks').insert([{ user_id: activeUser.id, track_id: trackId }]);
  if (error && error.code === '23505') alert("Этот трек уже есть в вашем профиле!");
  else alert("Трек добавлен в ваш профиль!");
};

// --- МАСТЕРСКАЯ ОФОРМЛЕНИЯ ---
let themeUploadedImgUrl = null;
let frameUploadedImgUrl = null;

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

  const themeInputs = [
    'themeFontSelect', 'themeFontSizeInput', 'themePanelOpacityInput', 'themeBtnOpacityInput',
    'themeHeaderColor', 'themePlayerColor', 'themeMainBgColor', 'themeSidebarColor',
    'themeCardColor', 'themeBtnBgColor', 'themeBtnTextColor', 'themeTextColor'
  ];
  themeInputs.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', updateLiveThemePreview);
  });

  const frameInputs = ['frameShapeSelect', 'frameColorInput', 'frameFxGlow', 'frameFxRainbow', 'frameFxSpin', 'frameFxAvatarSpin'];
  frameInputs.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', updateLiveFramePreview);
  });

  // Загрузка кастомного фона темы
  const themeBgFileInput = document.getElementById('themeBgFileInput');
  const btnClearThemeBg = document.getElementById('btnClearThemeBgFile');
  const themeBgStatus = document.getElementById('themeBgUploadStatus');
  if (themeBgFileInput) {
    themeBgFileInput.addEventListener('change', async () => {
      const file = themeBgFileInput.files[0];
      if (!file || !activeUser) return;
      if (themeBgStatus) themeBgStatus.innerText = 'Загрузка фонового изображения...';
      const fileExt = file.name.split('.').pop();
      const fileName = `theme_bg_${activeUser.id}_${Date.now()}.${fileExt}`;
      const { error } = await window.sbClient.storage.from('post_images').upload(fileName, file);
      if (error) {
        if (themeBgStatus) themeBgStatus.innerText = '';
        return alert("Ошибка загрузки фона: " + error.message);
      }
      themeUploadedImgUrl = window.sbClient.storage.from('post_images').getPublicUrl(fileName).data.publicUrl;
      if (themeBgStatus) themeBgStatus.innerText = 'Фон загружен и выбран!';
      if (btnClearThemeBg) btnClearThemeBg.style.display = 'inline-block';
      updateLiveThemePreview();
    });
  }

  if (btnClearThemeBg) {
    btnClearThemeBg.onclick = () => {
      if (themeBgFileInput) themeBgFileInput.value = '';
      themeUploadedImgUrl = null;
      if (themeBgStatus) themeBgStatus.innerText = '';
      btnClearThemeBg.style.display = 'none';
      updateLiveThemePreview();
    };
  }

  // Загрузка кастомной текстуры рамки
  const frameCustomFile = document.getElementById('frameCustomFile');
  const btnClearFrameCustom = document.getElementById('btnClearFrameCustomFile');
  const frameCustomStatus = document.getElementById('frameCustomUploadStatus');
  if (frameCustomFile) {
    frameCustomFile.addEventListener('change', async () => {
      const file = frameCustomFile.files[0];
      if (!file || !activeUser) return;
      if (frameCustomStatus) frameCustomStatus.innerText = 'Загрузка текстуры...';
      const fileExt = file.name.split('.').pop();
      const fileName = `frame_${activeUser.id}_${Date.now()}.${fileExt}`;
      const { error } = await window.sbClient.storage.from('post_images').upload(fileName, file);
      if (error) {
        if (frameCustomStatus) frameCustomStatus.innerText = '';
        return alert("Ошибка: " + error.message);
      }
      frameUploadedImgUrl = window.sbClient.storage.from('post_images').getPublicUrl(fileName).data.publicUrl;
      if (frameCustomStatus) frameCustomStatus.innerText = 'Изображение загружено!';
      if (btnClearFrameCustom) btnClearFrameCustom.style.display = 'inline-block';
      updateLiveFramePreview();
    });
  }

  if (btnClearFrameCustom) {
    btnClearFrameCustom.onclick = () => {
      if (frameCustomFile) frameCustomFile.value = '';
      frameUploadedImgUrl = null;
      if (frameCustomStatus) frameCustomStatus.innerText = '';
      btnClearFrameCustom.style.display = 'none';
      updateLiveFramePreview();
    };
  }

  // Публикация темы
  const btnPublishTheme = document.getElementById('btnPublishTheme');
  if (btnPublishTheme) {
    btnPublishTheme.onclick = async () => {
      if (!activeUser) return alert("Войдите в аккаунт!");
      const title = document.getElementById('themeTitleInput')?.value.trim() || 'Aero Theme';
      const config = {
        font: document.getElementById('themeFontSelect')?.value || 'Tahoma, sans-serif',
        fontSize: parseInt(document.getElementById('themeFontSizeInput')?.value) || 11,
        panelOpacity: parseFloat(document.getElementById('themePanelOpacityInput')?.value || 100) / 100,
        btnOpacity: parseFloat(document.getElementById('themeBtnOpacityInput')?.value || 100) / 100,
        headerColor: document.getElementById('themeHeaderColor')?.value,
        playerColor: document.getElementById('themePlayerColor')?.value,
        mainBgColor: document.getElementById('themeMainBgColor')?.value,
        sidebarColor: document.getElementById('themeSidebarColor')?.value,
        cardColor: document.getElementById('themeCardColor')?.value,
        btnBgColor: document.getElementById('themeBtnBgColor')?.value,
        btnTextColor: document.getElementById('themeBtnTextColor')?.value,
        textColor: document.getElementById('themeTextColor')?.value,
        bgUrl: themeUploadedImgUrl || null
      };

      const editId = document.getElementById('editingThemeId')?.value;
      if (editId) {
        await window.sbClient.from('community_creations').update({ title, config }).eq('id', editId);
        document.getElementById('editingThemeId').value = '';
        btnPublishTheme.innerText = 'Опубликовать тему';
        document.getElementById('btnCancelEditTheme').style.display = 'none';
        alert("Тема обновлена!");
      } else {
        await window.sbClient.from('community_creations').insert([{
          creator_id: activeUser.id, title, type: 'theme', config, likes_count: 0
        }]);
        alert("Тема опубликована!");
      }
      loadCreationsList();
    };
  }

  // Публикация рамочки
  const btnPublishFrame = document.getElementById('btnPublishFrame');
  if (btnPublishFrame) {
    btnPublishFrame.onclick = async () => {
      if (!activeUser) return alert("Войдите в аккаунт!");
      const title = document.getElementById('frameTitleInput')?.value.trim() || 'Рамочка';
      const config = {
        shape: document.getElementById('frameShapeSelect')?.value || 'circle',
        color: document.getElementById('frameColorInput')?.value || '#0055ea',
        fxGlow: document.getElementById('frameFxGlow')?.checked,
        fxRainbow: document.getElementById('frameFxRainbow')?.checked,
        fxSpin: document.getElementById('frameFxSpin')?.checked,
        fxAvatarSpin: document.getElementById('frameFxAvatarSpin')?.checked,
        imgUrl: frameUploadedImgUrl || null
      };

      const editId = document.getElementById('editingFrameId')?.value;
      if (editId) {
        await window.sbClient.from('community_creations').update({ title, config }).eq('id', editId);
        document.getElementById('editingFrameId').value = '';
        btnPublishFrame.innerText = 'Опубликовать рамочку';
        document.getElementById('btnCancelEditFrame').style.display = 'none';
        alert("Рамочка обновлена!");
      } else {
        await window.sbClient.from('community_creations').insert([{
          creator_id: activeUser.id, title, type: 'frame', config, likes_count: 0
        }]);
        alert("Рамочка опубликована!");
      }
      loadCreationsList();
    };
  }

  // Сброс всех стилей
  const btnReset = document.getElementById('btnResetAllStyles');
  if (btnReset) {
    btnReset.onclick = async () => {
      localStorage.removeItem('bubble_applied_theme');
      localStorage.removeItem('bubble_applied_frame');
      const dynamicStyle = document.getElementById('dynamicCustomThemeStyle');
      if (dynamicStyle) dynamicStyle.innerHTML = '';
      document.body.style.backgroundImage = 'url(bg.jpg)';
      document.body.style.fontFamily = 'Tahoma, sans-serif';
      if (activeUser) {
        await window.sbClient.from('profiles').update({ custom_theme: null, custom_frame: null }).eq('id', activeUser.id);
        if (profilesMap[activeUser.id]) profilesMap[activeUser.id].custom_frame = null;
      }
      const overlay = document.getElementById('userProfileFrameOverlay');
      if (overlay) overlay.style.display = 'none';
      alert("Оформление возвращено к исходной теме!");
    };
  }

  updateLiveThemePreview();
  updateLiveFramePreview();
}

function updateLiveThemePreview() {
  const fs = document.getElementById('themeFontSizeInput')?.value || 11;
  const panelOp = (parseFloat(document.getElementById('themePanelOpacityInput')?.value || 100) / 100);
  const btnOp = (parseFloat(document.getElementById('themeBtnOpacityInput')?.value || 100) / 100);

  const fsv = document.getElementById('themeFontSizeVal');
  if (fsv) fsv.innerText = fs;
  const pov = document.getElementById('themePanelOpacityVal');
  if (pov) pov.innerText = document.getElementById('themePanelOpacityInput')?.value || 100;
  const bov = document.getElementById('themeBtnOpacityVal');
  if (bov) bov.innerText = document.getElementById('themeBtnOpacityInput')?.value || 100;

  const font = document.getElementById('themeFontSelect')?.value || 'Tahoma, sans-serif';
  const mainBg = document.getElementById('themeMainBgColor')?.value || '#ffffff';
  const headerCol = document.getElementById('themeHeaderColor')?.value || '#b4e1ff';
  const playerCol = document.getElementById('themePlayerColor')?.value || '#d7f0ff';
  const sidebarCol = document.getElementById('themeSidebarColor')?.value || '#b0e1fa';
  const cardCol = document.getElementById('themeCardColor')?.value || '#fbfbfb';
  const btnBg = document.getElementById('themeBtnBgColor')?.value || '#d5e8ff';
  const btnText = document.getElementById('themeBtnTextColor')?.value || '#003366';
  const textCol = document.getElementById('themeTextColor')?.value || '#003366';

  const prevBox = document.getElementById('liveThemePreview');
  if (prevBox) {
    prevBox.style.fontFamily = font;
    prevBox.style.fontSize = `${fs}px`;
    prevBox.style.backgroundColor = mainBg;
    prevBox.style.opacity = panelOp;
  }

  const pHeader = document.getElementById('prevHeaderPane');
  if (pHeader) pHeader.style.backgroundColor = headerCol;

  const pPlayer = document.getElementById('prevPlayerPane');
  if (pPlayer) pPlayer.style.backgroundColor = playerCol;

  const pSidebar = document.getElementById('prevSidebarPane');
  if (pSidebar) {
    pSidebar.style.backgroundColor = sidebarCol;
    pSidebar.style.opacity = panelOp;
  }

  const pPost = document.getElementById('prevPostSample');
  if (pPost) {
    pPost.style.backgroundColor = cardCol;
    pPost.style.opacity = panelOp;
  }

  const pBtn = document.getElementById('prevBtnSample');
  if (pBtn) {
    pBtn.style.backgroundColor = btnBg;
    pBtn.style.color = btnText;
    pBtn.style.opacity = btnOp;
  }

  const pAuthor = document.getElementById('prevAuthorSample');
  if (pAuthor) pAuthor.style.color = textCol;

  const pText = document.getElementById('prevTextSample');
  if (pText) pText.style.color = textCol;
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
  if (inner) {
    if (frameUploadedImgUrl) {
      inner.style.backgroundImage = `url('${frameUploadedImgUrl}')`;
      inner.style.backgroundColor = 'transparent';
      inner.style.border = 'none';
    } else {
      inner.style.backgroundImage = 'none';
      inner.style.backgroundColor = color;
      inner.style.border = `4px solid ${color}`;
    }
  }
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
  if (!activeUser) return alert("Войдите в аккаунт!");
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
  if (cfg.bgUrl) {
    document.body.style.backgroundImage = `url(${cfg.bgUrl})`;
    document.body.style.backgroundSize = 'cover';
  }
  let css = '';
  if (cfg.font) css += `body, button, input, select, textarea { font-family: ${cfg.font} !important; }\n`;
  if (cfg.fontSize) css += `body, .post-box, .comment-item, .sidebar-btn, input, select, button, textarea { font-size: ${cfg.fontSize}px !important; }\n`;
  if (cfg.headerColor) css += `.aero-title-bar { background: ${cfg.headerColor} !important; }\n`;
  if (cfg.playerColor) css += `.player-dock { background: ${cfg.playerColor} !important; }\n`;
  const pop = cfg.panelOpacity !== undefined ? cfg.panelOpacity : 1;
  if (cfg.mainBgColor) css += `.main-view, .window-body-layout, fieldset { background-color: ${cfg.mainBgColor} !important; opacity: ${pop}; }\n`;
  if (cfg.sidebarColor) css += `.sidebar { background: ${cfg.sidebarColor} !important; opacity: ${pop}; }\n`;
  if (cfg.cardColor) css += `.post-box, .profile-card, .community-card, .creation-card, .messenger-container, .messenger-chats, .messenger-body { background-color: ${cfg.cardColor} !important; }\n`;
  const bop = cfg.btnOpacity !== undefined ? cfg.btnOpacity : 1;
  if (cfg.btnBgColor || cfg.btnTextColor) {
    css += `button, .sidebar-btn { background: ${cfg.btnBgColor || '#d5e8ff'} !important; color: ${cfg.btnTextColor || '#003366'} !important; opacity: ${bop}; }\n`;
  }
  if (cfg.textColor) css += `body, .post-box, .profile-card, .post-author, legend, .aero-title-text { color: ${cfg.textColor} !important; }\n`;
  const styleEl = document.getElementById('dynamicCustomThemeStyle');
  if (styleEl) styleEl.innerHTML = css;
}

function applyFrameStyles(cfg) {
  if (!cfg) return;
  const overlay = document.getElementById('userProfileFrameOverlay');
  const sideOverlay = document.getElementById('sidebarFrameOverlay');
  [overlay, sideOverlay].forEach(ov => {
    if (!ov) return;
    ov.style.display = 'flex';
    ov.className = `avatar-frame-overlay shape-${cfg.shape || 'circle'}`;
    if (cfg.fxGlow) ov.classList.add('fx-glow');
    if (cfg.fxRainbow) ov.classList.add('fx-rainbow');
    if (cfg.fxSpin) ov.classList.add('fx-spin');
    ov.style.setProperty('--frame-color', cfg.color);
    const inner = ov.querySelector('.frame-inner-shape');
    if (inner) {
      if (cfg.imgUrl) {
        inner.style.backgroundImage = `url('${cfg.imgUrl}')`;
        inner.style.backgroundColor = 'transparent';
        inner.style.border = 'none';
      } else {
        inner.style.backgroundImage = 'none';
        inner.style.backgroundColor = cfg.color;
        inner.style.border = `4px solid ${cfg.color}`;
      }
    }
  });
}

async function loadUserThemeAndFrame() {
  if (!activeUser) return;
  try {
    const { data } = await window.sbClient.from('profiles').select('custom_theme, custom_frame').eq('id', activeUser.id).single();
    if (data?.custom_theme) applyThemeStyles(data.custom_theme);
    if (data?.custom_frame) applyFrameStyles(data.custom_frame);
  } catch(e){}
}

// --- СООБЩЕСТВА (С ПОЛНОЙ ЗАГРУЗКОЙ ПОСТОВ, АВАТАРКИ, МУЗЫКИ, НАСТРОЙКАМИ И ВЫХОДОМ) ---
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

  // Публикация поста от лица сообщества
  const btnCreateCommPost = document.getElementById('btnCreateCommPost');
  if (btnCreateCommPost) {
    btnCreateCommPost.onclick = async () => {
      if (!activeUser || !currentCommunityId) return;
      const text = document.getElementById('commPostContent')?.value.trim() || '';
      const file = document.getElementById('commPostImage')?.files[0];
      if (!text && !file && !selectedCommPostTrack) return alert("Введите текст, прикрепите фото или песню!");

      btnCreateCommPost.disabled = true;
      let imageUrl = null;
      if (file) {
        const fileExt = file.name.split('.').pop();
        const fileName = `comm_post_${currentCommunityId}_${Date.now()}.${fileExt}`;
        const { error } = await window.sbClient.storage.from('post_images').upload(fileName, file);
        if (!error) imageUrl = window.sbClient.storage.from('post_images').getPublicUrl(fileName).data.publicUrl;
      }

      const comm = communitiesMap[currentCommunityId] || {};
      await window.sbClient.from('posts').insert([{
        author: comm.title || 'Сообщество',
        content: text,
        user_id: activeUser.id,
        community_id: currentCommunityId,
        image_url: imageUrl,
        track_id: selectedCommPostTrack ? selectedCommPostTrack.id : null,
        likes_count: 0
      }]);

      btnCreateCommPost.disabled = false;
      document.getElementById('commPostContent').value = '';
      const commImgInput = document.getElementById('commPostImage');
      if (commImgInput) commImgInput.value = '';
      selectedCommPostTrack = null;
      const preview = document.getElementById('commAttachedTrackPreview');
      if (preview) preview.style.display = 'none';

      loadCommunityPosts(currentCommunityId);
    };
  }

  // Кнопка вступления в сообщество
  const btnJoin = document.getElementById('btnCommJoinDirect');
  if (btnJoin) {
    btnJoin.onclick = async () => {
      if (!activeUser || !currentCommunityId) return alert("Войдите в аккаунт!");
      await window.sbClient.from('community_members').insert([{
        community_id: currentCommunityId, user_id: activeUser.id, role: 'member'
      }]);
      openCommunity(currentCommunityId);
    };
  }

  // Кнопка выхода из сообщества
  const btnLeave = document.getElementById('btnCommLeaveDirect');
  if (btnLeave) {
    btnLeave.onclick = async () => {
      if (!activeUser || !currentCommunityId) return;
      if (currentCommunityRole === 'creator') return alert("Создатель не может покинуть своё сообщество!");
      if (!confirm("Вы действительно хотите покинуть сообщество?")) return;
      await window.sbClient.from('community_members').delete().match({
        community_id: currentCommunityId, user_id: activeUser.id
      });
      openCommunity(currentCommunityId);
    };
  }

  // Кнопка "Чат группы"
  const btnOpenChat = document.getElementById('btnOpenCommChat');
  if (btnOpenChat) {
    btnOpenChat.onclick = async () => {
      if (!activeUser || !currentCommunityId) return;
      const { data: existing } = await window.sbClient
        .from('conversations')
        .select('id')
        .eq('type', 'community')
        .eq('community_id', currentCommunityId)
        .maybeSingle();

      let convId = existing?.id;
      if (!convId) {
        const { data: newConv } = await window.sbClient
          .from('conversations')
          .insert([{ type: 'community', community_id: currentCommunityId }])
          .select()
          .single();
        convId = newConv.id;
      }
      await window.sbClient
        .from('conversation_participants')
        .upsert([{ conversation_id: convId, user_id: activeUser.id }], { onConflict: 'conversation_id,user_id' });
      switchTab('messenger');
      openConversation(convId);
    };
  }

  // Кнопка "Настройки сообщества"
  const btnOpenSettings = document.getElementById('btnOpenCommSettings');
  if (btnOpenSettings) {
    btnOpenSettings.onclick = () => {
      const comm = communitiesMap[currentCommunityId];
      if (!comm) return;
      const modal = document.getElementById('commSettingsModal');
      const titleInput = document.getElementById('editCommTitleInput');
      const descInput = document.getElementById('editCommDescInput');
      if (titleInput) titleInput.value = comm.title || '';
      if (descInput) descInput.value = comm.description || '';
      if (modal) modal.style.display = 'flex';
      loadCommunityMembersToManage();
    };
  }

  // Кнопка "Сохранить изменения" в настройках сообщества
  const btnSaveCommSettings = document.getElementById('btnSaveCommSettings');
  if (btnSaveCommSettings) {
    btnSaveCommSettings.onclick = async () => {
      if (!currentCommunityId || !activeUser) return;
      btnSaveCommSettings.disabled = true;
      const title = document.getElementById('editCommTitleInput')?.value.trim();
      const desc = document.getElementById('editCommDescInput')?.value.trim();
      const file = document.getElementById('editCommAvatarFile')?.files[0];
      let avatarUrl = communitiesMap[currentCommunityId]?.avatar_url || null;

      if (file) {
        const fileExt = file.name.split('.').pop();
        const fileName = `comm_avatar_${currentCommunityId}_${Date.now()}.${fileExt}`;
        const { error: upErr } = await window.sbClient.storage.from('post_images').upload(fileName, file);
        if (!upErr) avatarUrl = window.sbClient.storage.from('post_images').getPublicUrl(fileName).data.publicUrl;
      }

      await window.sbClient.from('communities').update({
        title, description: desc, avatar_url: avatarUrl
      }).eq('id', currentCommunityId);

      btnSaveCommSettings.disabled = false;
      document.getElementById('commSettingsModal').style.display = 'none';
      alert("Настройки сообщества сохранены!");
      await loadAllCommunitiesCache();
      openCommunity(currentCommunityId);
    };
  }

  // Кнопка "Добавить трек в сообщество"
  const btnAddMusic = document.getElementById('btnOpenCommAddMusic');
  if (btnAddMusic) {
    btnAddMusic.onclick = () => openMusicPicker('comm_add');
  }

  const btnOpenCommPicker = document.getElementById('btnOpenCommPostMusicPicker');
  if (btnOpenCommPicker) {
    btnOpenCommPicker.onclick = () => openMusicPicker('comm_post');
  }

  const btnRemCommTrack = document.getElementById('btnRemoveCommAttachedTrack');
  if (btnRemCommTrack) {
    btnRemCommTrack.onclick = () => {
      selectedCommPostTrack = null;
      document.getElementById('commAttachedTrackPreview').style.display = 'none';
    };
  }
}

async function loadCommunityMembersToManage() {
  const container = document.getElementById('commMembersManageList');
  if (!container || !currentCommunityId) return;
  container.innerHTML = 'Загрузка участников...';

  const { data: members } = await window.sbClient
    .from('community_members')
    .select('id, user_id, role')
    .eq('community_id', currentCommunityId);

  if (!members || !members.length) {
    container.innerHTML = '<div style="color:#777;">Участников нет.</div>';
    return;
  }

  const isCreator = currentCommunityRole === 'creator';
  container.innerHTML = members.map(m => {
    const prof = profilesMap[m.user_id] || { username: 'Пользователь' };
    const isTargetCreator = m.role === 'creator';
    return `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:4px; border-bottom:1px dotted #ccc;">
        <span><b>${escapeHtml(prof.username)}</b> ${isTargetCreator ? '👑 (Создатель)' : ''}</span>
        ${(isCreator && !isTargetCreator) ? `
          <select onchange="updateMemberRole(${m.id}, this.value)" style="font-size:10px;">
            <option value="admin" ${m.role === 'admin' ? 'selected' : ''}>Администратор</option>
            <option value="moderator" ${m.role === 'moderator' ? 'selected' : ''}>Модератор</option>
            <option value="member" ${m.role === 'member' ? 'selected' : ''}>Участник</option>
          </select>
        ` : `<span>${m.role}</span>`}
      </div>`;
  }).join('');
}

window.updateMemberRole = async function(memberRowId, newRole) {
  const { error } = await window.sbClient.from('community_members').update({ role: newRole }).eq('id', memberRowId);
  if (error) alert("Ошибка смены роли: " + error.message);
  else {
    alert("Роль успешно обновлена!");
    loadCommunityMembersToManage();
  }
};

function showCommunitiesList() {
  const vList = document.getElementById('communityViewList');
  const vSingle = document.getElementById('communityViewSingle');
  if (vList) vList.style.display = 'block';
  if (vSingle) vSingle.style.display = 'none';

  const container = document.getElementById('communitiesListContainer');
  if (!container) return;
  if (!allCommunitiesCache.length) {
    container.innerHTML = '<p>Сообществ пока нет. Создайте первое!</p>';
    return;
  }
  container.innerHTML = allCommunitiesCache.map(c => `
    <div class="community-card">
      <div class="community-info" onclick="openCommunity(${c.id})">
        <img src="${c.avatar_url || DEFAULT_AVATAR}" class="avatar-mini" alt="avatar">
        <div>
          <b>${escapeHtml(c.title)}</b>
          <div style="font-size:10px; color:#666;">${escapeHtml(c.description || 'Без описания')}</div>
        </div>
      </div>
      <button onclick="openCommunity(${c.id})">Открыть</button>
    </div>`).join('');
}

window.openCommunity = async function(commId) {
  currentCommunityId = commId;
  localStorage.setItem('bubble_current_comm_id', commId);

  const vList = document.getElementById('communityViewList');
  const vSingle = document.getElementById('communityViewSingle');
  if (vList) vList.style.display = 'none';
  if (vSingle) vSingle.style.display = 'block';

  const { data: comm } = await window.sbClient.from('communities').select('*').eq('id', commId).single();
  if (!comm) return alert("Сообщество не найдено!");

  const titleEl = document.getElementById('commTitle');
  if (titleEl) titleEl.innerText = comm.title;
  const descEl = document.getElementById('commDesc');
  if (descEl) descEl.innerText = comm.description || 'Без описания';
  const avatarEl = document.getElementById('commAvatar');
  if (avatarEl) avatarEl.src = comm.avatar_url || DEFAULT_AVATAR;

  currentCommunityRole = null;
  const btnJoin = document.getElementById('btnCommJoinDirect');
  const btnLeave = document.getElementById('btnCommLeaveDirect');
  const btnSettings = document.getElementById('btnOpenCommSettings');
  const roleEl = document.getElementById('commUserRole');
  const postBox = document.getElementById('commCreatePostBox');

  if (activeUser) {
    const { data: member } = await window.sbClient.from('community_members')
      .select('role')
      .eq('community_id', commId)
      .eq('user_id', activeUser.id)
      .maybeSingle();
    if (member) currentCommunityRole = member.role;
  }

  const roleNames = { creator: 'Создатель 👑', admin: 'Администратор ⭐', moderator: 'Модератор 🛡️', member: 'Участник 👤' };

  if (currentCommunityRole) {
    if (btnJoin) btnJoin.style.display = 'none';
    if (btnLeave) btnLeave.style.display = (currentCommunityRole === 'creator') ? 'none' : 'inline-block';
    if (roleEl) roleEl.innerText = `Ваша роль: ${roleNames[currentCommunityRole] || 'Участник'}`;
    const canPost = ['creator', 'admin'].includes(currentCommunityRole);
    if (postBox) postBox.style.display = canPost ? 'block' : 'none';
    if (btnSettings) btnSettings.style.display = (currentCommunityRole === 'creator') ? 'inline-block' : 'none';
  } else {
    if (btnJoin) btnJoin.style.display = 'inline-block';
    if (btnLeave) btnLeave.style.display = 'none';
    if (roleEl) roleEl.innerText = 'Вы не состоите в сообществе';
    if (postBox) postBox.style.display = 'none';
    if (btnSettings) btnSettings.style.display = 'none';
  }

  loadCommunityTracks(commId);
  loadCommunityPosts(commId);
};

async function loadCommunityTracks(commId) {
  const container = document.getElementById('commTracksList');
  if (!container) return;
  container.innerHTML = 'Загрузка музыки группы...';
  const { data } = await window.sbClient
    .from('community_tracks')
    .select('id, position, track_id, tracks(*)')
    .eq('community_id', commId)
    .order('position', { ascending: true });

  const tracksData = (data || []).filter(d => d.tracks);
  if (!tracksData.length) {
    container.innerHTML = '<div style="font-size:11px; color:#666; padding: 4px;">В сообществе пока нет музыки.</div>';
    return;
  }

  const tracksQueue = tracksData.map(d => d.tracks);
  container.innerHTML = tracksData.map((item, idx) => `
    <div class="track-list-item">
      <div style="flex:1; cursor:pointer;" onclick="playQueue('${JSON.stringify(tracksQueue).replace(/"/g, '&quot;')}', ${idx}, 'Музыка сообщества')">
        <b>${escapeHtml(item.tracks.artist)}</b> — ${escapeHtml(item.tracks.title)}
      </div>
      <button onclick="addTrackToMyLibrary(${item.tracks.id})" style="font-size:10px;">+ Себе</button>
    </div>
  `).join('');
}

async function loadCommunityPosts(commId) {
  const container = document.getElementById('commPostsList');
  if (!container) return;
  container.innerHTML = 'Загрузка записей...';

  const { data: posts, error } = await window.sbClient
    .from('posts')
    .select('*')
    .eq('community_id', commId)
    .order('id', { ascending: false });

  if (error || !posts || !posts.length) {
    container.innerHTML = '<div style="font-size:11px; color:#666; padding: 4px;">На стене сообщества нет записей.</div>';
    return;
  }

  const postIds = posts.map(p => p.id);
  const { data: comments } = await window.sbClient.from('comments').select('*').in('post_id', postIds).order('id', { ascending: true });
  const commentsByPost = {};
  (comments || []).forEach(c => {
    if (!commentsByPost[c.post_id]) commentsByPost[c.post_id] = [];
    commentsByPost[c.post_id].push(c);
  });

  const canModerate = ['creator', 'admin', 'moderator'].includes(currentCommunityRole);
  container.innerHTML = posts.map(p => renderPostItem(p, commentsByPost, `comm-${commId}`, canModerate)).join('');
}

// --- ПРОФИЛЬ ПОЛЬЗОВАТЕЛЯ ---
async function openUserProfile(userId) {
  await loadAllProfiles();
  await loadFriends();
  await loadUserLikes();

  const prof = profilesMap[userId] || { username: 'Пользователь', avatar_url: DEFAULT_AVATAR };
  const nickEl = document.getElementById('profileNick');
  if (nickEl) nickEl.innerText = prof.username;
  const avatarEl = document.getElementById('profileAvatar');
  if (avatarEl) avatarEl.src = prof.avatar_url || DEFAULT_AVATAR;

  // Рамочка в профиле
  const overlay = document.getElementById('userProfileFrameOverlay');
  if (prof.custom_frame && overlay) {
    overlay.style.display = 'flex';
    overlay.className = `avatar-frame-overlay shape-${prof.custom_frame.shape || 'circle'}`;
    if (prof.custom_frame.fxGlow) overlay.classList.add('fx-glow');
    if (prof.custom_frame.fxRainbow) overlay.classList.add('fx-rainbow');
    if (prof.custom_frame.fxSpin) overlay.classList.add('fx-spin');
    overlay.style.setProperty('--frame-color', prof.custom_frame.color || '#0055ea');
    const inner = overlay.querySelector('.frame-inner-shape');
    if (inner) {
      if (prof.custom_frame.imgUrl) {
        inner.style.backgroundImage = `url('${prof.custom_frame.imgUrl}')`;
        inner.style.backgroundColor = 'transparent';
        inner.style.border = 'none';
      } else {
        inner.style.backgroundImage = 'none';
        inner.style.backgroundColor = prof.custom_frame.color || '#0055ea';
        inner.style.border = `4px solid ${prof.custom_frame.color || '#0055ea'}`;
      }
    }
  } else if (overlay) {
    overlay.style.display = 'none';
  }

  // Кнопки управления дружбой и личными сообщениями
  const isMyProfile = activeUser && activeUser.id === userId;
  const btnFriend = document.getElementById('btnFriendAction');
  const btnMsg = document.getElementById('btnProfileSendMsg');
  const playlistBlock = document.getElementById('playlistCreateBlock');

  if (!isMyProfile && activeUser) {
    if (btnFriend) {
      btnFriend.style.display = 'inline-block';
      if (userFriendIds.has(userId)) btnFriend.innerText = 'В друзьях (Удалить)';
      else if (pendingOutgoingIds.has(userId)) btnFriend.innerText = 'Заявка отправлена';
      else btnFriend.innerText = 'Добавить в друзья';
      btnFriend.onclick = () => handleProfileFriendAction(userId);
    }
    if (btnMsg) {
      btnMsg.style.display = 'inline-block';
      btnMsg.onclick = () => getOrCreateDirectChat(userId);
    }
    if (playlistBlock) playlistBlock.style.display = 'none';
  } else {
    if (btnFriend) btnFriend.style.display = 'none';
    if (btnMsg) btnMsg.style.display = 'none';
    if (playlistBlock) playlistBlock.style.display = 'block';
  }

  loadProfileFriends(userId);
  loadUserMusic(userId);
  loadProfilePosts(userId);
}

async function handleProfileFriendAction(userId) {
  if (!activeUser) return;
  if (userFriendIds.has(userId)) {
    if (!confirm("Удалить пользователя из друзей?")) return;
    await window.sbClient.from('friends').delete().or(`and(user_id.eq.${activeUser.id},friend_id.eq.${userId}),and(user_id.eq.${userId},friend_id.eq.${activeUser.id})`);
  } else if (pendingOutgoingIds.has(userId)) {
    await window.sbClient.from('friends').delete().match({ user_id: activeUser.id, friend_id: userId, status: 'pending' });
  } else {
    await window.sbClient.from('friends').insert([{ user_id: activeUser.id, friend_id: userId, status: 'pending' }]);
    await createNotification(userId, 'friend_request', 'хочет добавить вас в друзья!', null);
  }
  await loadFriends();
  openUserProfile(userId);
}

async function loadProfileFriends(userId) {
  const container = document.getElementById('profileFriendsList');
  const legend = document.getElementById('friendsBlockLegend');
  if (!container) return;
  container.innerHTML = 'Загрузка друзей...';

  const { data: rows } = await window.sbClient
    .from('friends')
    .select('*')
    .eq('status', 'accepted')
    .or(`user_id.eq.${userId},friend_id.eq.${userId}`);

  const friendIds = (rows || []).map(r => r.user_id === userId ? r.friend_id : r.user_id);
  if (legend) legend.innerText = `Друзья (${friendIds.length})`;

  if (!friendIds.length) {
    container.innerHTML = '<div style="font-size:11px; color:#666;">Список друзей пуст.</div>';
    return;
  }

  container.innerHTML = friendIds.map(fid => `
    <div class="friend-card" onclick="goToProfile('${fid}')">
      ${renderAvatarWithFrame(fid, false)}
      <div class="friend-name">${escapeHtml(profilesMap[fid]?.username || 'Пользователь')}</div>
    </div>
  `).join('');
}

async function loadProfilePosts(userId) {
  const container = document.getElementById('profilePostsList');
  if (!container) return;
  container.innerHTML = 'Загрузка записей...';

  const { data: posts, error } = await window.sbClient
    .from('posts')
    .select('*')
    .eq('user_id', userId)
    .is('community_id', null)
    .order('id', { ascending: false });

  if (error || !posts || !posts.length) {
    container.innerHTML = '<div style="font-size:11px; color:#666; padding: 4px;">У пользователя пока нет публикаций.</div>';
    return;
  }

  const postIds = posts.map(p => p.id);
  const { data: comments } = await window.sbClient.from('comments').select('*').in('post_id', postIds).order('id', { ascending: true });
  const commentsByPost = {};
  (comments || []).forEach(c => {
    if (!commentsByPost[c.post_id]) commentsByPost[c.post_id] = [];
    commentsByPost[c.post_id].push(c);
  });

  const isMyProfile = activeUser && activeUser.id === userId;
  container.innerHTML = posts.map(p => renderPostItem(p, commentsByPost, `profile-${userId}`, isMyProfile)).join('');
}

// --- МЕССЕНДЖЕР: ИСПРАВЛЕННОЕ ОТОБРАЖЕНИЕ СОБЕСЕДНИКА И БЕСЕД ---
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

  // Кнопка "Создать беседу"
  const btnOpenCreateGroup = document.getElementById('btnOpenCreateGroupModal');
  if (btnOpenCreateGroup) {
    btnOpenCreateGroup.onclick = () => {
      document.getElementById('groupChatTitle').value = '';
      selectedGroupFriends.clear();
      renderGroupCreationFriends();
      document.getElementById('createGroupModal').style.display = 'flex';
    };
  }

  // Кнопка подтверждения создания беседы
  const btnSubmitGroup = document.getElementById('btnSubmitCreateGroup');
  if (btnSubmitGroup) {
    btnSubmitGroup.onclick = async () => {
      if (!activeUser) return;
      const title = document.getElementById('groupChatTitle')?.value.trim() || 'Беседа';
      const selectedIds = Array.from(selectedGroupFriends);
      const { data: newConv } = await window.sbClient.from('conversations').insert([{
        type: 'group', title
      }]).select().single();

      if (newConv) {
        const participants = [{ conversation_id: newConv.id, user_id: activeUser.id }];
        selectedIds.forEach(uid => participants.push({ conversation_id: newConv.id, user_id: uid }));
        await window.sbClient.from('conversation_participants').insert(participants);
        document.getElementById('createGroupModal').style.display = 'none';
        switchTab('messenger');
        openConversation(newConv.id);
      }
    };
  }

  // Кнопка настроек беседы
  const btnOpenGroupSettings = document.getElementById('btnOpenGroupSettings');
  if (btnOpenGroupSettings) {
    btnOpenGroupSettings.onclick = () => {
      if (!activeConversationId) return;
      const statusEl = document.getElementById('groupAvatarUploadStatus');
      if (statusEl) statusEl.innerText = '';
      document.getElementById('groupSettingsModal').style.display = 'flex';
      loadGroupAddFriendsList();
    };
  }

  // Смена аватарки беседы
  const groupAvatarFileInput = document.getElementById('groupAvatarFileInput');
  if (groupAvatarFileInput) {
    groupAvatarFileInput.addEventListener('change', async () => {
      const file = groupAvatarFileInput.files[0];
      if (!file || !activeConversationId) return;
      const statusEl = document.getElementById('groupAvatarUploadStatus');
      if (statusEl) statusEl.innerText = 'Загрузка аватарки беседы...';
      const fileExt = file.name.split('.').pop();
      const fileName = `group_${activeConversationId}_${Date.now()}.${fileExt}`;
      const { error: upErr } = await window.sbClient.storage.from('post_images').upload(fileName, file);
      if (upErr) {
        if (statusEl) statusEl.innerText = '';
        return alert("Ошибка: " + upErr.message);
      }
      const pubUrl = window.sbClient.storage.from('post_images').getPublicUrl(fileName).data.publicUrl;
      await window.sbClient.from('conversations').update({ avatar_url: pubUrl }).eq('id', activeConversationId);
      if (statusEl) statusEl.innerText = 'Аватарка успешно обновлена!';
      loadConversationsList();
    });
  }
}

function renderGroupCreationFriends() {
  const container = document.getElementById('groupFriendsChecklist');
  if (!container) return;
  const fArr = Array.from(userFriendIds);
  if (!fArr.length) {
    container.innerHTML = '<div style="color:#777;">У вас пока нет подтверждённых друзей.</div>';
    return;
  }
  container.innerHTML = fArr.map(fid => {
    const isAdded = selectedGroupFriends.has(fid);
    const name = profilesMap[fid]?.username || 'Друг';
    return `
      <div class="participant-select-item ${isAdded ? 'selected' : ''}" onclick="toggleGroupFriendSelection('${fid}')">
        <span><b>${escapeHtml(name)}</b></span>
        <span class="participant-status-badge ${isAdded ? 'badge-added' : 'badge-not-added'}">
          ${isAdded ? 'Добавлен' : '+ Добавить'}
        </span>
      </div>`;
  }).join('');
}

window.toggleGroupFriendSelection = function(fid) {
  if (selectedGroupFriends.has(fid)) selectedGroupFriends.delete(fid);
  else selectedGroupFriends.add(fid);
  renderGroupCreationFriends();
};

async function loadGroupAddFriendsList() {
  const container = document.getElementById('groupAddMoreFriendsList');
  if (!container || !activeConversationId) return;
  container.innerHTML = 'Загрузка списка друзей...';

  const { data: parts } = await window.sbClient.from('conversation_participants').select('user_id').eq('conversation_id', activeConversationId);
  const existingIds = new Set((parts || []).map(p => p.user_id));
  const friendsToAdd = Array.from(userFriendIds).filter(fid => !existingIds.has(fid));

  if (!friendsToAdd.length) {
    container.innerHTML = '<div style="color:#777; padding:4px;">Все ваши друзья уже добавлены в эту беседу.</div>';
    return;
  }

  container.innerHTML = friendsToAdd.map(fid => `
    <div class="participant-select-item" onclick="addUserToCurrentGroup('${fid}')">
      <span><b>${escapeHtml(profilesMap[fid]?.username || 'Друг')}</b></span>
      <span class="participant-status-badge badge-not-added">+ Добавить</span>
    </div>
  `).join('');
}

window.addUserToCurrentGroup = async function(fid) {
  if (!activeConversationId) return;
  await window.sbClient.from('conversation_participants').insert([{
    conversation_id: activeConversationId, user_id: fid
  }]);
  loadGroupAddFriendsList();
  loadConversationsList();
};

async function getOrCreateDirectChat(targetUserId) {
  if (!activeUser || !targetUserId || activeUser.id === targetUserId) return;
  const { data: myConvs } = await window.sbClient.from('conversation_participants').select('conversation_id').eq('user_id', activeUser.id);
  const myConvIds = (myConvs || []).map(p => p.conversation_id);

  if (myConvIds.length) {
    const { data: directConvs } = await window.sbClient.from('conversations').select('id').in('id', myConvIds).eq('type', 'direct');
    const directIds = (directConvs || []).map(c => c.id);
    if (directIds.length) {
      const { data: common } = await window.sbClient.from('conversation_participants')
        .select('conversation_id')
        .in('conversation_id', directIds)
        .eq('user_id', targetUserId)
        .maybeSingle();
      if (common) {
        switchTab('messenger');
        openConversation(common.conversation_id);
        return;
      }
    }
  }

  const { data: newConv } = await window.sbClient.from('conversations').insert([{ type: 'direct' }]).select().single();
  if (newConv) {
    await window.sbClient.from('conversation_participants').insert([
      { conversation_id: newConv.id, user_id: activeUser.id },
      { conversation_id: newConv.id, user_id: targetUserId }
    ]);
    switchTab('messenger');
    openConversation(newConv.id);
  }
}

// Загрузка списка диалогов с правильным определением имени собеседника
async function loadConversationsList() {
  if (!activeUser) return;
  const list = document.getElementById('chatsListContainer');
  if (!list) return;
  list.innerHTML = 'Загрузка диалогов...';

  const { data: parts } = await window.sbClient.from('conversation_participants').select('conversation_id').eq('user_id', activeUser.id);
  const convIds = (parts || []).map(p => p.conversation_id);
  if (!convIds.length) {
    list.innerHTML = '<div style="font-size:11px; padding:10px; color:#777;">Нет диалогов. Напишите другу!</div>';
    return;
  }

  const { data: convs } = await window.sbClient.from('conversations').select('*').in('id', convIds).order('id', { ascending: false });
  const { data: allParts } = await window.sbClient.from('conversation_participants').select('conversation_id, user_id').in('conversation_id', convIds);

  list.innerHTML = (convs || []).map(c => {
    let title = c.title || 'Беседа';
    let avatar = c.avatar_url || DEFAULT_AVATAR;

    if (c.type === 'direct') {
      const partner = (allParts || []).find(p => p.conversation_id === c.id && p.user_id !== activeUser.id);
      const partnerId = partner ? partner.user_id : null;
      if (partnerId && profilesMap[partnerId]) {
        title = profilesMap[partnerId].username;
        avatar = profilesMap[partnerId].avatar_url || DEFAULT_AVATAR;
      } else {
        title = 'Личный чат';
      }
    } else if (c.type === 'community' && c.community_id) {
      const comm = communitiesMap[c.community_id];
      if (comm) {
        title = `Чат: ${comm.title}`;
        avatar = comm.avatar_url || DEFAULT_AVATAR;
      }
    }

    return `
      <div class="messenger-chat-item ${activeConversationId === c.id ? 'active' : ''}" onclick="openConversation(${c.id})">
        <img src="${avatar}" class="avatar-mini" alt="chat avatar">
        <div style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
          <b>${escapeHtml(title)}</b>
        </div>
      </div>`;
  }).join('');
}

// Открытие диалога и вывод имени собеседника в шапку чата
async function openConversation(convId) {
  activeConversationId = convId;
  const bar = document.getElementById('chatHeaderBar');
  const inputBar = document.getElementById('chatInputBar');
  const msgsList = document.getElementById('chatMessagesList');
  const titleEl = document.getElementById('activeChatTitle');
  const btnGroupSettings = document.getElementById('btnOpenGroupSettings');

  if (bar) bar.style.display = 'flex';
  if (inputBar) inputBar.style.display = 'flex';
  if (msgsList) msgsList.innerHTML = 'Загрузка сообщений...';

  // Получаем информацию о беседе
  const { data: conv } = await window.sbClient.from('conversations').select('*').eq('id', convId).single();
  const { data: parts } = await window.sbClient.from('conversation_participants').select('user_id').eq('conversation_id', convId);

  let title = conv?.title || 'Чат';
  if (conv?.type === 'direct') {
    const partnerId = parts?.map(p => p.user_id).find(uid => uid !== activeUser.id);
    if (partnerId && profilesMap[partnerId]) {
      title = profilesMap[partnerId].username;
    } else {
      title = 'Личный чат';
    }
  } else if (conv?.type === 'community' && conv.community_id) {
    const comm = communitiesMap[conv.community_id];
    title = comm ? `Чат группы ${comm.title}` : 'Чат сообщества';
  }

  if (titleEl) titleEl.innerText = title;
  if (btnGroupSettings) btnGroupSettings.style.display = (conv?.type === 'group') ? 'inline-block' : 'none';

  // Загружаем сообщения
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
  const senderProf = profilesMap[msg.sender_id];
  const senderNick = senderProf ? senderProf.username : 'Пользователь';

  const el = document.createElement('div');
  el.className = `msg-bubble ${isMine ? 'msg-out' : 'msg-in'}`;
  el.innerHTML = `
    <div style="font-weight:bold; font-size:9px; color:#555; margin-bottom:2px;">${escapeHtml(senderNick)}</div>
    <div>${escapeHtml(msg.content)}</div>
  `;
  list.appendChild(el);
  list.scrollTop = list.scrollHeight;
}

// Запуск инициализации модулей
function initModules() {
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

  const btnCreatePlaylist = document.getElementById('btnCreatePlaylist');
  if (btnCreatePlaylist) {
    btnCreatePlaylist.onclick = async () => {
      const title = document.getElementById('newPlaylistTitle')?.value.trim();
      if (!title || !activeUser) return alert("Введите название плейлиста!");
      await window.sbClient.from('playlists').insert([{ user_id: activeUser.id, title }]);
      document.getElementById('newPlaylistTitle').value = '';
      loadUserMusic(activeUser.id);
    };
  }

  initThemeAndFrameWorkshop();
  initMessengerModule();
  initCommunitiesModule();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initModules);
} else {
  initModules();
}
