/* ================================================================
   draw.js — Ferramenta de rabisco (caneta + borracha) via SVG
   ================================================================ */
window.QI = window.QI || {};

QI.Draw = (() => {
  let isDrawing = false;
  let currentPath = null;
  let currentPoints = [];
  let drawGroup;

  function init() {
    drawGroup = document.getElementById('drawings-group');
    const viewport = document.getElementById('board-viewport');

    viewport.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);

    // ── Draw mode buttons (pen / eraser) ──
    document.querySelectorAll('.draw-mode-btn').forEach(btn =>
      btn.addEventListener('click', () => {
        document.querySelectorAll('.draw-mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        QI.state.drawMode = btn.dataset.drawMode;
        document.body.classList.toggle('draw-eraser', QI.state.drawMode === 'eraser');
      }));

    // ── Color buttons ──
    document.querySelectorAll('.draw-color-btn').forEach(btn =>
      btn.addEventListener('click', () => {
        document.querySelectorAll('.draw-color-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        QI.state.drawColor = btn.dataset.drawColor;
      }));

    // ── Width buttons ──
    document.querySelectorAll('.draw-width-btn').forEach(btn =>
      btn.addEventListener('click', () => {
        document.querySelectorAll('.draw-width-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        QI.state.drawWidth = parseInt(btn.dataset.drawWidth);
      }));
  }

  /* ── Mouse down ── */
  function onDown(e) {
    if (QI.state.activeTool !== 'draw') return;
    if (e.button !== 0) return;
    // Ignore clicks on cards and UI elements
    if (e.target.closest('.clue-card,.conn-delete-btn,.modal,#minimap,#sidebar,#app-header')) return;

    e.preventDefault();
    isDrawing = true;
    const coords = QI.Board.screenToBoard(e.clientX, e.clientY);
    currentPoints = [[+coords.x.toFixed(1), +coords.y.toFixed(1)]];

    if (QI.state.drawMode === 'eraser') {
      eraseAt(coords.x, coords.y);
    } else {
      // Start a new SVG path
      const id = 'draw_' + Date.now() + '_' + Math.random().toString(36).slice(2,5);
      const p  = makePath(QI.state.drawColor || '#1c1208', QI.state.drawWidth || 3, id);
      p.setAttribute('d', `M ${coords.x.toFixed(1)} ${coords.y.toFixed(1)}`);
      currentPath = p;
      drawGroup.appendChild(p);
    }
  }

  /* ── Mouse move ── */
  function onMove(e) {
    if (!isDrawing || QI.state.activeTool !== 'draw') return;
    const coords = QI.Board.screenToBoard(e.clientX, e.clientY);

    if (QI.state.drawMode === 'eraser') {
      eraseAt(coords.x, coords.y);
    } else if (currentPath) {
      const last = currentPoints[currentPoints.length - 1];
      const dx = coords.x - last[0], dy = coords.y - last[1];
      if (dx*dx + dy*dy < 4) return; // debounce tiny movements
      currentPoints.push([+coords.x.toFixed(1), +coords.y.toFixed(1)]);
      // Build path as M + L sequence
      const d = 'M ' + currentPoints[0].join(' ') +
                (currentPoints.length > 1 ? ' L ' + currentPoints.slice(1).map(p => p.join(' ')).join(' L ') : '');
      currentPath.setAttribute('d', d);
    }
  }

  /* ── Mouse up ── */
  function onUp() {
    if (!isDrawing) return;
    isDrawing = false;

    if (currentPath) {
      if (currentPoints.length > 1) {
        // Save to state
        QI.state.drawings.push({
          id:     currentPath.dataset.drawId,
          color:  QI.state.drawColor || '#1c1208',
          width:  QI.state.drawWidth || 3,
          points: currentPoints
        });
        QI.Storage.save();
      } else {
        currentPath.remove(); // single dot — discard
      }
    }
    currentPath = null;
    currentPoints = [];
  }

  /* ── Erase strokes within radius ── */
  function eraseAt(bx, by) {
    const scale  = QI.state.boardTransform.scale;
    const radius = (QI.state.eraserSize || 26) / scale;
    const r2 = radius * radius;
    const toRemove = [];

    drawGroup.querySelectorAll('.drawing-path').forEach(p => {
      const id = p.dataset.drawId;
      const drawing = QI.state.drawings.find(d => d.id === id);
      if (!drawing) { p.remove(); return; }
      const hit = drawing.points.some(([px, py]) => (px-bx)**2 + (py-by)**2 < r2);
      if (hit) toRemove.push(id);
    });

    if (!toRemove.length) return;
    toRemove.forEach(id => {
      drawGroup.querySelector(`[data-draw-id="${id}"]`)?.remove();
      QI.state.drawings = QI.state.drawings.filter(d => d.id !== id);
    });
    QI.Storage.save();
  }

  /* ── Helper: create SVG path element ── */
  function makePath(color, width, id) {
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.dataset.drawId = id;
    p.setAttribute('stroke',           color);
    p.setAttribute('stroke-width',     width);
    p.setAttribute('stroke-linecap',   'round');
    p.setAttribute('stroke-linejoin',  'round');
    p.setAttribute('fill',             'none');
    p.setAttribute('opacity',          '0.88');
    p.classList.add('drawing-path');
    return p;
  }

  /* ── Render all drawings from state (on load / import) ── */
  function renderAll() {
    if (!drawGroup) return;
    drawGroup.innerHTML = '';
    for (const drawing of (QI.state.drawings || [])) {
      if (!drawing.points?.length || drawing.points.length < 2) continue;
      const p = makePath(drawing.color, drawing.width, drawing.id);
      const d = 'M ' + drawing.points[0].join(' ') +
                ' L ' + drawing.points.slice(1).map(pt => pt.join(' ')).join(' L ');
      p.setAttribute('d', d);
      drawGroup.appendChild(p);
    }
  }

  /* ── Clear all drawings ── */
  function clearAll() {
    if (!drawGroup) return;
    QI.state.drawings = [];
    drawGroup.innerHTML = '';
    QI.Storage.save();
  }

  return { init, renderAll, clearAll };
})();
