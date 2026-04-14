/* ================================================================
   connections.js — Linhas SVG + botões HTML de desconexão
   ================================================================ */
window.QI = window.QI || {};

QI.Connections = (() => {
  const CW = 200;
  let group, previewGroup, previewShadow, previewLine, boardContainer;

  function init() {
    group         = document.getElementById('connections-group');
    previewGroup  = document.getElementById('connection-preview-group');
    previewShadow = document.getElementById('preview-shadow');
    previewLine   = document.getElementById('preview-line');
    boardContainer = document.getElementById('board-container');
  }

  /* ── Helpers ── */
  function svgEl(tag) { return document.createElementNS('http://www.w3.org/2000/svg', tag); }

  function pinOf(clue) { return { x: clue.x + CW / 2, y: clue.y }; }

  function sagPath(x1, y1, x2, y2) {
    const dx = x2-x1, dy = y2-y1;
    const dist = Math.sqrt(dx*dx + dy*dy);
    const sag  = Math.min(dist * 0.14, 58);
    const mx = (x1+x2)/2, my = (y1+y2)/2 + sag;
    return { d: `M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`, mx, my };
  }

  function knot(x, y, color) {
    const c = svgEl('circle');
    c.setAttribute('cx', x); c.setAttribute('cy', y); c.setAttribute('r', '3.5');
    c.setAttribute('fill', color); c.setAttribute('stroke', 'rgba(0,0,0,0.45)');
    c.setAttribute('stroke-width', '1'); c.setAttribute('class', 'conn-knot');
    return c;
  }

  /* ── Render all ── */
  function renderAll() {
    group.innerHTML = '';
    boardContainer.querySelectorAll('.conn-delete-btn').forEach(b => b.remove());
    QI.state.connections.forEach(renderOne);
  }

  /* ── Render one connection ── */
  function renderOne(conn) {
    const from = QI.state.clues.find(c => c.id === conn.fromId);
    const to   = QI.state.clues.find(c => c.id === conn.toId);
    if (!from || !to) return;

    const fp = pinOf(from), tp = pinOf(to);
    const { d, mx, my } = sagPath(fp.x, fp.y, tp.x, tp.y);
    const color = conn.color || '#bb1111';

    // ── SVG group ──
    const g = svgEl('g');
    g.setAttribute('class', 'connection-group');
    g.dataset.connId = conn.id;

    const sh = svgEl('path');
    sh.setAttribute('d', d); sh.setAttribute('stroke', 'rgba(0,0,0,0.5)');
    sh.setAttribute('stroke-width', '7'); sh.setAttribute('stroke-linecap', 'round'); sh.setAttribute('fill', 'none');

    const mn = svgEl('path');
    mn.setAttribute('d', d); mn.setAttribute('stroke', color);
    mn.setAttribute('stroke-width', '2.5'); mn.setAttribute('stroke-linecap', 'round'); mn.setAttribute('fill', 'none');

    const hl = svgEl('path');
    hl.setAttribute('d', d); hl.setAttribute('stroke', 'rgba(255,255,255,0.2)');
    hl.setAttribute('stroke-width', '1'); hl.setAttribute('stroke-linecap', 'round'); hl.setAttribute('fill', 'none');

    g.append(sh, mn, hl, knot(fp.x, fp.y, color), knot(tp.x, tp.y, color));
    group.appendChild(g);

    // ── HTML delete button (positioned at bezier sag midpoint in board-space) ──
    const btn = document.createElement('button');
    btn.className = 'conn-delete-btn';
    btn.dataset.connBtnId = conn.id;
    btn.setAttribute('aria-label', 'Remover conexão');
    btn.title = 'Remover conexão';
    btn.textContent = '×';
    btn.style.left = mx + 'px';
    btn.style.top  = my + 'px';
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      QI.UI.showConfirm('Remover esta conexão?', () => {
        remove(conn.id);
        QI.Storage.save();
        QI.UI.showToast('Conexão removida.', 'info');
        QI.UI.updateMinimap();
      });
    });
    boardContainer.appendChild(btn);
  }

  /* ── Update all lines + delete button positions (on card move) ── */
  function updateAll() {
    group.querySelectorAll('.connection-group').forEach(g => {
      const conn = QI.state.connections.find(c => c.id === g.dataset.connId);
      if (!conn) { g.remove(); return; }
      const from = QI.state.clues.find(c => c.id === conn.fromId);
      const to   = QI.state.clues.find(c => c.id === conn.toId);
      if (!from || !to) { g.remove(); return; }

      const fp = pinOf(from), tp = pinOf(to);
      const { d, mx, my } = sagPath(fp.x, fp.y, tp.x, tp.y);

      g.querySelectorAll('path').forEach(p => p.setAttribute('d', d));
      const knots = g.querySelectorAll('.conn-knot');
      if (knots[0]) { knots[0].setAttribute('cx', fp.x); knots[0].setAttribute('cy', fp.y); }
      if (knots[1]) { knots[1].setAttribute('cx', tp.x); knots[1].setAttribute('cy', tp.y); }

      const btn = boardContainer.querySelector(`[data-conn-btn-id="${conn.id}"]`);
      if (btn) { btn.style.left = mx + 'px'; btn.style.top = my + 'px'; }
    });
  }

  /* ── Add connection ── */
  function add(fromId, toId, color) {
    const dup = QI.state.connections.find(c =>
      (c.fromId === fromId && c.toId === toId) || (c.fromId === toId && c.toId === fromId));
    if (dup) return null;
    const conn = {
      id: 'conn_' + Date.now() + '_' + Math.random().toString(36).slice(2,6),
      fromId, toId, color: color || '#bb1111', createdAt: Date.now()
    };
    QI.state.connections.push(conn);
    renderOne(conn);
    return conn.id;
  }

  /* ── Remove connection ── */
  function remove(connId) {
    QI.state.connections = QI.state.connections.filter(c => c.id !== connId);
    const g = group.querySelector(`[data-conn-id="${connId}"]`);
    if (g) g.remove();
    const btn = boardContainer.querySelector(`[data-conn-btn-id="${connId}"]`);
    if (btn) btn.remove();
  }

  /* ── Remove all connections for a clue ── */
  function removeByClue(clueId) {
    QI.state.connections
      .filter(c => c.fromId === clueId || c.toId === clueId)
      .forEach(c => remove(c.id));
  }

  /* ── Preview line ── */
  function startPreview(fromClue) {
    QI.state._previewFrom = pinOf(fromClue);
    previewGroup.style.display = '';
    updatePreview(QI.state._previewFrom.x, QI.state._previewFrom.y);
  }

  function updatePreview(bx, by) {
    if (!QI.state._previewFrom) return;
    const { x: fx, y: fy } = QI.state._previewFrom;
    const { d } = sagPath(fx, fy, bx, by);
    previewShadow.setAttribute('d', d);
    previewLine.setAttribute('d', d);
    previewLine.setAttribute('stroke', QI.state.activeConnectionColor || '#bb1111');
  }

  function cancelConnect() {
    previewGroup.style.display = 'none';
    QI.state.connectingFromId = null;
    QI.state._previewFrom = null;
    document.querySelectorAll('.clue-card.connect-source').forEach(e => e.classList.remove('connect-source'));
    const hud = document.getElementById('connect-hud');
    if (hud) hud.style.display = 'none';
  }

  /* ── Find nearest connection to board-space point (for delete via click) ── */
  function findNearest(px, py, maxDist) {
    let nearest = null, nearestD = maxDist;
    for (const conn of QI.state.connections) {
      const from = QI.state.clues.find(c => c.id === conn.fromId);
      const to   = QI.state.clues.find(c => c.id === conn.toId);
      if (!from || !to) continue;
      const fp = pinOf(from), tp = pinOf(to);
      const { mx, my } = sagPath(fp.x, fp.y, tp.x, tp.y);
      for (let t = 0; t <= 1; t += 1/14) {
        const bx = (1-t)**2*fp.x + 2*(1-t)*t*mx + t**2*tp.x;
        const by = (1-t)**2*fp.y + 2*(1-t)*t*my + t**2*tp.y;
        const d  = Math.sqrt((px-bx)**2 + (py-by)**2);
        if (d < nearestD) { nearestD = d; nearest = conn; }
      }
    }
    return nearest;
  }

  return { init, renderAll, add, remove, removeByClue, updateAll, startPreview, updatePreview, cancelConnect, findNearest, pinOf };
})();
