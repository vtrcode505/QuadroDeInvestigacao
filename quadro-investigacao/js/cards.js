/* ================================================================
   cards.js — Cards de pistas
   FIX: rastreia distância de arrasto para não disparar click após drag
   ================================================================ */
window.QI = window.QI || {};

QI.Cards = (() => {
  let container;

  function init() {
    container = document.getElementById('board-container');

    interact('.clue-card').draggable({
      inertia: false, autoScroll: false,
      listeners: {
        start(event) {
          const clue = clueById(event.target.dataset.clueId);
          if (!clue || clue.pinned) { event.interaction.stop(); return; }
          const tool = QI.state.activeTool;
          if (tool === 'annotate' || tool === 'delete' || tool === 'connect' || tool === 'draw') {
            event.interaction.stop(); return;
          }
          event.target._dragDist = 0;
          event.target.style.zIndex = 30;
          event.target.style.transition = 'none';
        },
        move(event) {
          const clue = clueById(event.target.dataset.clueId);
          if (!clue || clue.pinned) return;
          // Accumulate drag distance to distinguish drag from click
          event.target._dragDist = (event.target._dragDist || 0) + Math.abs(event.dx) + Math.abs(event.dy);
          const scale = QI.state.boardTransform.scale;
          clue.x += event.dx / scale;
          clue.y += event.dy / scale;
          event.target.style.left = clue.x + 'px';
          event.target.style.top  = clue.y + 'px';
          QI.Connections.updateAll();
          QI.UI.updateMinimap();
        },
        end(event) {
          // Mark as dragged if moved significantly — click handler will ignore it
          if ((event.target._dragDist || 0) > 5) {
            event.target._didDrag = true;
            setTimeout(() => { event.target._didDrag = false; }, 120);
          }
          event.target._dragDist = 0;
          event.target.style.zIndex = '';
          event.target.style.transition = '';
          QI.Storage.save();
        }
      }
    });
  }

  function clueById(id) { return QI.state.clues.find(c => c.id === id); }

  /* ── Render all ── */
  function renderAll() {
    container.querySelectorAll('.clue-card').forEach(el => el.remove());
    QI.state.clues.forEach(clue => container.appendChild(buildEl(clue)));
    updateEmptyHint();
  }

  /* ── Build card element ── */
  function buildEl(clue) {
    const hasImg   = !!(clue.imageData && clue.imageData.trim());
    const hasAnnot = !!(QI.state.annotations[clue.id]);
    const rot = clue.rotation || 0;

    const el = document.createElement('div');
    el.className = 'clue-card' + (hasImg ? ' has-image' : '') + (clue.pinned ? ' pinned' : '');
    el.id = `card-${clue.id}`;
    el.dataset.clueId = clue.id;
    el.setAttribute('role', 'button');
    el.setAttribute('tabindex', '0');
    el.setAttribute('aria-label', `Pista: ${clue.title}`);
    el.style.cssText = `left:${clue.x}px;top:${clue.y}px;--r:${rot}deg;`;

    // Push pin
    const pin = document.createElement('div'); pin.className = 'card-pin';
    el.appendChild(pin);

    // Tape (deterministic ~80%)
    const idHash = clue.id.split('').reduce((a,c) => a + c.charCodeAt(0), 0);
    if (idHash % 5 !== 0) {
      const tape = document.createElement('div');
      tape.className = 'card-tape'; tape.setAttribute('aria-hidden','true');
      el.appendChild(tape);
    }

    const inner = document.createElement('div'); inner.className = 'card-inner';

    if (hasImg) {
      const wrap = document.createElement('div'); wrap.className = 'card-img-wrap';
      const img  = document.createElement('img');
      img.src = clue.imageData; img.alt = clue.title; img.loading = 'lazy';
      wrap.appendChild(img); inner.appendChild(wrap);
    }

    const titleEl = document.createElement('div');
    titleEl.className = 'card-title';
    titleEl.textContent = clue.title || '(sem título)';
    inner.appendChild(titleEl);

    if (clue.description) {
      const descEl = document.createElement('div'); descEl.className = 'card-desc';
      descEl.textContent = clue.description.length > 120 ? clue.description.slice(0,120)+'…' : clue.description;
      inner.appendChild(descEl);
    }

    const ab = document.createElement('div');
    ab.className = 'card-annot-badge' + (hasAnnot ? ' visible' : '');
    ab.textContent = '✏️'; ab.setAttribute('aria-hidden','true');
    inner.appendChild(ab);

    const pb = document.createElement('div');
    pb.className = 'card-pinned-badge' + (clue.pinned ? ' visible' : '');
    pb.textContent = '📌'; pb.setAttribute('aria-hidden','true');
    inner.appendChild(pb);

    const st = document.createElement('div');
    st.className = 'card-stamp'; st.setAttribute('aria-hidden','true');
    st.textContent = 'EVIDÊNCIA';
    inner.appendChild(st);

    el.appendChild(inner);

    // ── Click: ignore if this was a drag ──
    el.addEventListener('click', (e) => {
      if (el._didDrag) { el._didDrag = false; return; }
      e.stopPropagation();
      handleClick(e, clue.id);
    });
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick(e, clue.id); }
    });
    el.addEventListener('mouseenter', () => {
      if (QI.state.activeTool === 'connect' && QI.state.connectingFromId && clue.id !== QI.state.connectingFromId)
        el.classList.add('connect-target');
    });
    el.addEventListener('mouseleave', () => el.classList.remove('connect-target'));

    return el;
  }

  /* ── Card click handler ── */
  function handleClick(e, clueId) {
    const tool = QI.state.activeTool;
    const clue = clueById(clueId);

    if (tool === 'pin') { togglePin(clueId); return; }

    if (tool === 'delete') {
      QI.UI.showConfirm(`Remover a pista "${clue?.title || 'esta pista'}"?`, () => remove(clueId));
      return;
    }

    if (tool === 'connect') {
      if (!QI.state.connectingFromId) {
        QI.state.connectingFromId = clueId;
        const el = document.getElementById(`card-${clueId}`);
        if (el) el.classList.add('connect-source');
        QI.Connections.startPreview(clue);
        document.getElementById('connect-hud').style.display = '';
      } else if (QI.state.connectingFromId === clueId) {
        QI.Connections.cancelConnect();
      } else {
        const connId = QI.Connections.add(QI.state.connectingFromId, clueId, QI.state.activeConnectionColor);
        if (connId) { QI.UI.showToast('Conexão criada! Use ✂️ Remover para desconectar.', 'success'); QI.Storage.save(); QI.UI.updateMinimap(); }
        else         { QI.UI.showToast('Estas pistas já estão conectadas.', 'info'); }
        const src = document.getElementById(`card-${QI.state.connectingFromId}`);
        if (src) src.classList.remove('connect-source');
        QI.Connections.cancelConnect();
      }
      return;
    }

    // draw mode: ignore card clicks
    if (tool === 'draw') return;

    // Default (move / annotate): open detail modal
    QI.UI.openDetailModal(clueId);
  }

  /* ── CRUD ── */
  function add(clue) {
    QI.state.clues.push(clue);
    const el = buildEl(clue);
    el.classList.add('just-added');
    container.appendChild(el);
    setTimeout(() => el.classList.remove('just-added'), 600);
    QI.Storage.save(); QI.UI.updateMinimap(); updateEmptyHint();
  }

  function update(partial) {
    const idx = QI.state.clues.findIndex(c => c.id === partial.id);
    if (idx === -1) return;
    Object.assign(QI.state.clues[idx], partial);
    const oldEl = document.getElementById(`card-${partial.id}`);
    if (oldEl) oldEl.replaceWith(buildEl(QI.state.clues[idx]));
    QI.Storage.save(); QI.UI.updateMinimap();
  }

  function remove(clueId) {
    QI.state.clues = QI.state.clues.filter(c => c.id !== clueId);
    delete QI.state.annotations[clueId];
    QI.Connections.removeByClue(clueId);
    const el = document.getElementById(`card-${clueId}`);
    if (el) {
      el.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
      el.style.opacity = '0'; el.style.transform = `rotate(var(--r)) scale(0.78)`;
      setTimeout(() => el.remove(), 380);
    }
    QI.Storage.save(); QI.UI.showToast('Pista removida.', 'info');
    QI.UI.updateMinimap(); updateEmptyHint();
  }

  function togglePin(clueId) {
    const clue = clueById(clueId); if (!clue) return;
    clue.pinned = !clue.pinned;
    const el = document.getElementById(`card-${clueId}`);
    if (el) {
      el.classList.toggle('pinned', clue.pinned);
      el.querySelector('.card-pinned-badge')?.classList.toggle('visible', clue.pinned);
    }
    QI.Storage.save(); QI.UI.showToast(clue.pinned ? 'Pista fixada!' : 'Pista desfixada.', 'info');
  }

  function updateEmptyHint() {
    document.getElementById('empty-hint')?.classList.toggle('hidden', QI.state.clues.length > 0);
  }

  function generateId()       { return 'clue_' + Date.now() + '_' + Math.random().toString(36).slice(2,7); }
  function randomRotation()   { return parseFloat(((Math.random()-0.5)*8).toFixed(2)); }
  function randomPosition()   {
    const rect = document.getElementById('board-viewport').getBoundingClientRect();
    const { x, y, scale } = QI.state.boardTransform;
    const cx = (rect.width/2-x)/scale, cy = (rect.height/2-y)/scale;
    return { x: cx+(Math.random()-0.5)*320, y: cy+(Math.random()-0.5)*220 };
  }

  return { init, renderAll, add, update, remove, togglePin, generateId, randomRotation, randomPosition, updateEmptyHint };
})();
