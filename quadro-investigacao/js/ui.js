/* ================================================================
   ui.js — Modais, sidebar, toasts, minimap, keyboard, mode toggle
   ================================================================ */
window.QI = window.QI || {};

QI.UI = (() => {
  let _confirmCb = null, _annotTimer = null, _currentClueId = null;

  const HINTS = {
    move:     'Arraste as pistas para reposicioná-las.',
    pin:      'Clique em uma pista para fixar ou desafixar.',
    connect:  'Clique em duas pistas para ligar com um fio colorido.',
    annotate: 'Clique em uma pista para ler ou anotar observações.',
    delete:   'Clique em uma pista ou no × de uma conexão para remover.',
    draw:     'Rabisque no quadro. Escolha cor e espessura abaixo.',
  };

  function init() {
    initModeToggle();
    initSidebar();
    initHeaderBtns();
    initDetailModal();
    initEditModal();
    initConfirmModal();
    initMousePreview();
    updateZoomDisplay();
    updateMinimap();
  }

  /* ──────────────────────────────────────────────────────────────
     MODE TOGGLE
  ────────────────────────────────────────────────────────────── */
  function initModeToggle() {
    document.getElementById('btn-player-mode').addEventListener('click', () => setMode('player'));
    document.getElementById('btn-master-mode').addEventListener('click', () => setMode('master'));
  }

  function setMode(mode) {
    QI.state.mode = mode;
    document.body.classList.toggle('master-mode', mode === 'master');
    ['player','master'].forEach(m => {
      const btn = document.getElementById(`btn-${m}-mode`);
      btn.classList.toggle('active', mode === m);
      btn.setAttribute('aria-pressed', mode === m);
    });
    const mg = document.getElementById('master-tool-group');
    if (mg) mg.style.display = mode === 'master' ? '' : 'none';
    const eb = document.getElementById('md-edit-btn');
    if (eb) eb.style.display = mode === 'master' ? '' : 'none';
    showToast(mode === 'master' ? '🎭 Modo Mestre ativado' : '👁 Modo Jogador ativado', 'info');
  }

  /* ──────────────────────────────────────────────────────────────
     SIDEBAR
  ────────────────────────────────────────────────────────────── */
  function initSidebar() {
    document.querySelectorAll('.tool-btn[data-tool]').forEach(btn =>
      btn.addEventListener('click', () => setTool(btn.dataset.tool)));

    const addBtn = document.getElementById('tool-add-clue');
    if (addBtn) addBtn.addEventListener('click', () => openEditModal(null));

    document.querySelectorAll('.swatch').forEach(sw =>
      sw.addEventListener('click', () => {
        document.querySelectorAll('.swatch').forEach(s => s.classList.remove('active'));
        sw.classList.add('active');
        QI.state.activeConnectionColor = sw.dataset.color;
        // Update preview line color live
        const pl = document.getElementById('preview-line');
        if (pl) pl.setAttribute('stroke', sw.dataset.color);
      }));

    document.getElementById('btn-zoom-in'   ).addEventListener('click', () => QI.Board.zoomTo(QI.state.boardTransform.scale + 0.15));
    document.getElementById('btn-zoom-out'  ).addEventListener('click', () => QI.Board.zoomTo(QI.state.boardTransform.scale - 0.15));
    document.getElementById('btn-zoom-reset').addEventListener('click', () => QI.Board.resetView());
  }

  function setTool(tool) {
    if (QI.state.activeTool === 'connect' && tool !== 'connect') QI.Connections.cancelConnect();
    // Cancel draw eraser cursor when leaving draw
    if (QI.state.activeTool === 'draw' && tool !== 'draw') document.body.classList.remove('draw-eraser');
    QI.state.activeTool = tool;

    document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
      const on = btn.dataset.tool === tool;
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-pressed', on);
    });

    // Show / hide tool sub-panels
    const cg = document.getElementById('color-tool-group');
    if (cg) cg.style.display = tool === 'connect' ? '' : 'none';
    const dg = document.getElementById('draw-subtools');
    if (dg) dg.style.display = tool === 'draw' ? '' : 'none';

    // Body class for cursor styling
    document.body.className = document.body.className.replace(/\btool-\w+\b/g, '').trim();
    document.body.classList.add(`tool-${tool}`);
    if (QI.state.mode === 'master') document.body.classList.add('master-mode');

    const hintEl = document.getElementById('tool-hint');
    if (hintEl) hintEl.textContent = HINTS[tool] || '';
  }

  /* ──────────────────────────────────────────────────────────────
     HEADER BUTTONS
  ────────────────────────────────────────────────────────────── */
  function initHeaderBtns() {
    document.getElementById('btn-export').addEventListener('click', () => {
      QI.Storage.exportJSON(); showToast('Quadro exportado!', 'success');
    });
    const importInput = document.getElementById('import-file-input');
    document.getElementById('btn-import').addEventListener('click', () => importInput.click());
    importInput.addEventListener('change', (e) => {
      const file = e.target.files[0]; if (!file) return;
      QI.Storage.importJSON(file, (ok) => {
        if (ok) {
          QI.Cards.renderAll(); QI.Connections.renderAll(); QI.Draw.renderAll();
          QI.Board.applyTransform(); updateZoomDisplay(); updateMinimap();
          showToast('Quadro importado!', 'success');
        } else showToast('Erro ao importar arquivo.', 'error');
      });
      importInput.value = '';
    });
    document.getElementById('btn-clear').addEventListener('click', () =>
      showConfirm('Limpar todo o quadro (pistas, conexões e rabiscos)? Ação irreversível.', () => {
        QI.Storage.clear();
        QI.Cards.renderAll();
        QI.Connections.renderAll();
        QI.Draw.renderAll();
        QI.Board.resetView();
        updateMinimap();
        showToast('Quadro limpo.', 'info');
      }));
  }

  /* ──────────────────────────────────────────────────────────────
     DETAIL MODAL
  ────────────────────────────────────────────────────────────── */
  function initDetailModal() {
    document.getElementById('md-close'    ).addEventListener('click', closeModals);
    document.getElementById('md-close-btn').addEventListener('click', closeModals);
    document.getElementById('modal-overlay').addEventListener('click', closeModals);
    document.getElementById('md-edit-btn').addEventListener('click', () => {
      if (_currentClueId) { closeModals(); setTimeout(() => openEditModal(_currentClueId), 60); }
    });
    const ta = document.getElementById('md-annotation');
    ta.addEventListener('input', () => {
      clearTimeout(_annotTimer);
      _annotTimer = setTimeout(() => {
        if (!_currentClueId) return;
        QI.state.annotations[_currentClueId] = ta.value;
        QI.Storage.save();
        // Update annotation badge
        const cardEl = document.getElementById(`card-${_currentClueId}`);
        if (cardEl) {
          const b = cardEl.querySelector('.card-annot-badge');
          if (b) b.classList.toggle('visible', !!ta.value.trim());
        }
        const ind = document.getElementById('annot-saved');
        if (ind) { ind.textContent = '✓ Salvo'; setTimeout(() => { ind.textContent = ''; }, 2000); }
      }, 700);
    });
  }

  function openDetailModal(clueId) {
    const clue = QI.state.clues.find(c => c.id === clueId); if (!clue) return;
    _currentClueId = clueId;
    document.getElementById('md-title').textContent = clue.title || '(sem título)';
    document.getElementById('md-id').textContent = `#${clueId.slice(-6).toUpperCase()}`;
    document.getElementById('md-desc').textContent = clue.description || '(sem descrição)';
    const iw = document.getElementById('md-img-wrap'), im = document.getElementById('md-img');
    if (clue.imageData) { im.src = clue.imageData; iw.style.display = ''; }
    else iw.style.display = 'none';
    document.getElementById('md-annotation').value = QI.state.annotations[clueId] || '';
    document.getElementById('annot-saved').textContent = '';
    document.getElementById('md-edit-btn').style.display = QI.state.mode === 'master' ? '' : 'none';
    openModal('modal-detail');
  }

  /* ──────────────────────────────────────────────────────────────
     EDIT MODAL
  ────────────────────────────────────────────────────────────── */
  function initEditModal() {
    document.getElementById('me-close'     ).addEventListener('click', closeModals);
    document.getElementById('me-cancel-btn').addEventListener('click', closeModals);
    document.getElementById('me-save-btn'  ).addEventListener('click', saveClue);

    // Image tabs
    document.querySelectorAll('.img-tab').forEach(tab =>
      tab.addEventListener('click', () => {
        document.querySelectorAll('.img-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const pid = `img-${tab.dataset.imgTab}-panel`;
        document.querySelectorAll('.img-tab-panel').forEach(p => p.style.display = p.id === pid ? 'block' : 'none');
      }));

    // Dropzone
    const dz = document.getElementById('img-dropzone');
    const fi = document.getElementById('img-file-input');
    dz.addEventListener('click', () => fi.click());
    dz.addEventListener('keydown', e => { if (e.key==='Enter'||e.key===' ') fi.click(); });
    dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('dragover'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('dragover'));
    dz.addEventListener('drop', e => { e.preventDefault(); dz.classList.remove('dragover'); const f = e.dataTransfer?.files[0]; if (f) processImg(f); });
    fi.addEventListener('change', () => { if (fi.files[0]) processImg(fi.files[0]); });
    document.getElementById('dz-remove-btn').addEventListener('click', clearImgPreview);

    // URL preview
    document.getElementById('me-img-url').addEventListener('input', e => {
      const url = e.target.value.trim();
      const w = document.getElementById('url-img-preview'), i = document.getElementById('url-preview-img');
      if (url) { i.src = url; w.style.display = ''; } else w.style.display = 'none';
    });
  }

  function processImg(file) {
    if (!file.type.startsWith('image/')) { showToast('Use PNG, JPG ou WEBP.', 'error'); return; }
    if (file.size > 5*1024*1024) { showToast('Imagem maior que 5MB.', 'error'); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      const dz = document.getElementById('img-dropzone');
      dz.dataset.imageData = e.target.result;
      const prev = document.getElementById('dz-preview');
      prev.src = e.target.result; prev.style.display = 'block';
      document.getElementById('dz-remove-btn').style.display = '';
      ['dz-icon','dz-text','dz-hint'].forEach(cls => { const el = dz.querySelector('.'+cls); if(el) el.style.display='none'; });
    };
    reader.readAsDataURL(file);
  }

  function clearImgPreview() {
    const dz = document.getElementById('img-dropzone'); dz.dataset.imageData = '';
    const p = document.getElementById('dz-preview'); p.style.display='none'; p.src='';
    document.getElementById('dz-remove-btn').style.display='none';
    document.getElementById('img-file-input').value='';
    ['dz-icon','dz-text','dz-hint'].forEach(cls => { const el = dz.querySelector('.'+cls); if(el) el.style.display=''; });
  }

  function openEditModal(clueId) {
    clearImgPreview();
    document.getElementById('me-img-url').value='';
    document.getElementById('url-img-preview').style.display='none';
    // Reset image tabs
    document.querySelectorAll('.img-tab').forEach(t => t.classList.remove('active'));
    document.querySelector('.img-tab[data-img-tab="upload"]').classList.add('active');
    document.querySelectorAll('.img-tab-panel').forEach(p => p.style.display = p.id==='img-upload-panel' ? 'block' : 'none');

    const titleInput = document.getElementById('me-title-input');
    const saveBtn    = document.getElementById('me-save-btn');
    const titleH     = document.getElementById('me-title-h');

    if (clueId) {
      const clue = QI.state.clues.find(c => c.id===clueId); if (!clue) return;
      titleH.textContent = 'Editar Pista'; saveBtn.textContent = 'Salvar Alterações';
      titleInput.value = clue.title||'';
      document.getElementById('me-desc').value = clue.description||'';
      document.getElementById('me-clue-id').value = clueId;
      // Restore image
      if (clue.imageData) {
        if (clue.imageType === 'url') {
          document.querySelectorAll('.img-tab').forEach(t => t.classList.remove('active'));
          document.querySelector('.img-tab[data-img-tab="url"]').classList.add('active');
          document.querySelectorAll('.img-tab-panel').forEach(p => p.style.display = p.id==='img-url-panel' ? 'block' : 'none');
          document.getElementById('me-img-url').value = clue.imageData;
          document.getElementById('url-preview-img').src = clue.imageData;
          document.getElementById('url-img-preview').style.display='';
        } else {
          const dz = document.getElementById('img-dropzone');
          dz.dataset.imageData = clue.imageData;
          const p = document.getElementById('dz-preview'); p.src=clue.imageData; p.style.display='block';
          document.getElementById('dz-remove-btn').style.display='';
          ['dz-icon','dz-text','dz-hint'].forEach(cls=>{const el=dz.querySelector('.'+cls);if(el)el.style.display='none';});
        }
      }
    } else {
      titleH.textContent = 'Nova Pista'; saveBtn.textContent = 'Adicionar ao Quadro';
      titleInput.value=''; document.getElementById('me-desc').value=''; document.getElementById('me-clue-id').value='';
    }
    openModal('modal-edit');
    setTimeout(() => titleInput.focus(), 80);
  }

  function saveClue() {
    const title = document.getElementById('me-title-input').value.trim();
    if (!title) { showToast('Título é obrigatório.', 'error'); document.getElementById('me-title-input').focus(); return; }
    const desc    = document.getElementById('me-desc').value.trim();
    const clueId  = document.getElementById('me-clue-id').value;
    const activeTab = document.querySelector('.img-tab.active')?.dataset.imgTab;
    let imageData='', imageType='none';
    if (activeTab==='upload') {
      imageData = document.getElementById('img-dropzone').dataset.imageData || '';
      imageType = imageData ? 'base64' : 'none';
    } else if (activeTab==='url') {
      imageData = document.getElementById('me-img-url').value.trim();
      imageType = imageData ? 'url' : 'none';
    }
    if (clueId) {
      QI.Cards.update({ id: clueId, title, description: desc, imageData, imageType });
      showToast('Pista atualizada!', 'success');
    } else {
      const pos = QI.Cards.randomPosition();
      QI.Cards.add({
        id: QI.Cards.generateId(), title, description: desc, imageData, imageType,
        x: pos.x, y: pos.y, rotation: QI.Cards.randomRotation(), pinned: false, createdAt: Date.now()
      });
      showToast('Pista adicionada!', 'success');
    }
    closeModals(); updateMinimap();
  }

  /* ──────────────────────────────────────────────────────────────
     CONFIRM MODAL
  ────────────────────────────────────────────────────────────── */
  function initConfirmModal() {
    document.getElementById('confirm-cancel').addEventListener('click', closeModals);
    document.getElementById('confirm-ok').addEventListener('click', () => {
      closeModals();
      if (typeof _confirmCb === 'function') _confirmCb();
      _confirmCb = null;
    });
  }

  function showConfirm(msg, cb) {
    document.getElementById('confirm-msg').textContent = msg;
    _confirmCb = cb;
    openModal('modal-confirm');
  }

  /* ──────────────────────────────────────────────────────────────
     MODAL MANAGEMENT
  ────────────────────────────────────────────────────────────── */
  function openModal(id) {
    document.getElementById('modal-overlay').classList.add('active');
    document.getElementById('modal-overlay').setAttribute('aria-hidden', 'false');
    const m = document.getElementById(id);
    if (m) { m.classList.add('open'); m.setAttribute('aria-hidden','false'); }
  }

  function closeModals() {
    document.getElementById('modal-overlay').classList.remove('active');
    document.getElementById('modal-overlay').setAttribute('aria-hidden','true');
    document.querySelectorAll('.modal').forEach(m => { m.classList.remove('open'); m.setAttribute('aria-hidden','true'); });
    _currentClueId = null;
  }

  /* ── ESC key ── */
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (document.querySelector('.modal.open')) closeModals();
      else if (QI.state?.connectingFromId) QI.Connections.cancelConnect();
    }
  });

  /* ──────────────────────────────────────────────────────────────
     MOUSE PREVIEW FOR CONNECT MODE
  ────────────────────────────────────────────────────────────── */
  function initMousePreview() {
    document.getElementById('board-viewport').addEventListener('mousemove', (e) => {
      if (QI.state.activeTool !== 'connect' || !QI.state.connectingFromId) return;
      const coords = QI.Board.screenToBoard(e.clientX, e.clientY);
      QI.Connections.updatePreview(coords.x, coords.y);
    });
  }

  /* ──────────────────────────────────────────────────────────────
     TOASTS
  ────────────────────────────────────────────────────────────── */
  function showToast(msg, type='info') {
    const c = document.getElementById('toast-container');
    const t = document.createElement('div');
    t.className = `toast toast-${type}`; t.textContent = msg;
    c.appendChild(t);
    setTimeout(() => { t.classList.add('hiding'); setTimeout(() => t.remove(), 380); }, 3200);
  }

  /* ──────────────────────────────────────────────────────────────
     ZOOM DISPLAY
  ────────────────────────────────────────────────────────────── */
  function updateZoomDisplay() {
    const el = document.getElementById('zoom-pct');
    if (el) el.textContent = Math.round(QI.state.boardTransform.scale * 100) + '%';
  }

  /* ──────────────────────────────────────────────────────────────
     MINIMAP
  ────────────────────────────────────────────────────────────── */
  function updateMinimap() {
    const inner = document.getElementById('minimap-inner');
    const vpRect = document.getElementById('minimap-viewport-rect');
    if (!inner || !vpRect) return;
    inner.querySelectorAll('.minimap-card-dot').forEach(d => d.remove());

    const mmW = inner.clientWidth || 160, mmH = inner.clientHeight || 100;
    if (!QI.state.clues.length) { vpRect.style.cssText = ''; return; }

    const pad = 100, CW = 200, CH = 150;
    const xs = QI.state.clues.map(c => c.x), ys = QI.state.clues.map(c => c.y);
    const minX = Math.min(...xs)-pad, maxX = Math.max(...xs)+CW+pad;
    const minY = Math.min(...ys)-pad, maxY = Math.max(...ys)+CH+pad;
    const bW = maxX-minX, bH = maxY-minY;
    const sc = Math.min(mmW/bW, mmH/bH) * 0.9;
    const ox = (mmW - bW*sc)/2, oy = (mmH - bH*sc)/2;

    QI.state.clues.forEach(clue => {
      const dot = document.createElement('div'); dot.className = 'minimap-card-dot';
      dot.style.left   = ((clue.x-minX)*sc+ox) + 'px';
      dot.style.top    = ((clue.y-minY)*sc+oy) + 'px';
      dot.style.width  = Math.max(CW*sc, 4) + 'px';
      dot.style.height = Math.max(CH*sc*0.75, 3) + 'px';
      inner.insertBefore(dot, vpRect);
    });

    const vp = document.getElementById('board-viewport').getBoundingClientRect();
    const { x: bx, y: by, scale: bs } = QI.state.boardTransform;
    vpRect.style.left   = ((-bx/bs - minX)*sc + ox) + 'px';
    vpRect.style.top    = ((-by/bs - minY)*sc + oy) + 'px';
    vpRect.style.width  = (vp.width /bs * sc) + 'px';
    vpRect.style.height = (vp.height/bs * sc) + 'px';
  }

  return { init, setMode, setTool, openDetailModal, openEditModal, closeModals, showToast, showConfirm, updateZoomDisplay, updateMinimap };
})();
