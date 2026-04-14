/* ================================================================
   board.js — Pan e zoom do quadro (infinite canvas)
   ================================================================ */
window.QI = window.QI || {};

QI.Board = (() => {
  const SCALE_MIN = 0.2, SCALE_MAX = 3.0, SCALE_STEP = 0.12;
  let viewport, container;
  let isPanning = false, panStart = { x: 0, y: 0 };
  let lastTouches = null;

  function init() {
    viewport  = document.getElementById('board-viewport');
    container = document.getElementById('board-container');

    // ── Mouse pan ──
    viewport.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      if (QI.state.activeTool === 'draw') return; // draw.js handles this
      const onBoard = e.target === viewport || e.target === container || e.target.closest('#connections-svg');
      if (!onBoard) return;
      isPanning = true;
      panStart.x = e.clientX - QI.state.boardTransform.x;
      panStart.y = e.clientY - QI.state.boardTransform.y;
      viewport.style.cursor = 'grabbing';
      e.preventDefault();
    });

    // Middle-mouse pan
    viewport.addEventListener('mousedown', (e) => {
      if (e.button !== 1) return;
      isPanning = true;
      panStart.x = e.clientX - QI.state.boardTransform.x;
      panStart.y = e.clientY - QI.state.boardTransform.y;
      e.preventDefault();
    });

    window.addEventListener('mousemove', (e) => {
      if (!isPanning) return;
      QI.state.boardTransform.x = e.clientX - panStart.x;
      QI.state.boardTransform.y = e.clientY - panStart.y;
      applyTransform();
      QI.UI.updateMinimap();
    });

    window.addEventListener('mouseup', () => {
      if (isPanning) { isPanning = false; viewport.style.cursor = ''; QI.Storage.save(); }
    });

    // ── Scroll zoom ──
    viewport.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = viewport.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      const delta = e.deltaY < 0 ? SCALE_STEP : -SCALE_STEP;
      const oldScale = QI.state.boardTransform.scale;
      const newScale = Math.max(SCALE_MIN, Math.min(SCALE_MAX, oldScale + delta));
      if (newScale === oldScale) return;
      const ratio = newScale / oldScale;
      QI.state.boardTransform.x = mx - (mx - QI.state.boardTransform.x) * ratio;
      QI.state.boardTransform.y = my - (my - QI.state.boardTransform.y) * ratio;
      QI.state.boardTransform.scale = newScale;
      applyTransform();
      QI.UI.updateZoomDisplay();
      QI.UI.updateMinimap();
    }, { passive: false });

    // ── Touch pan/pinch ──
    viewport.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        const t = e.touches[0];
        panStart.x = t.clientX - QI.state.boardTransform.x;
        panStart.y = t.clientY - QI.state.boardTransform.y;
        isPanning = true;
      }
      lastTouches = Array.from(e.touches).map(t => ({ x: t.clientX, y: t.clientY }));
    }, { passive: true });

    viewport.addEventListener('touchmove', (e) => {
      if (e.touches.length === 1 && isPanning) {
        const t = e.touches[0];
        QI.state.boardTransform.x = t.clientX - panStart.x;
        QI.state.boardTransform.y = t.clientY - panStart.y;
        applyTransform(); QI.UI.updateMinimap();
      } else if (e.touches.length === 2 && lastTouches && lastTouches.length === 2) {
        const dx1 = e.touches[0].clientX - e.touches[1].clientX;
        const dy1 = e.touches[0].clientY - e.touches[1].clientY;
        const dx2 = lastTouches[0].x - lastTouches[1].x;
        const dy2 = lastTouches[0].y - lastTouches[1].y;
        const newDist = Math.sqrt(dx1*dx1+dy1*dy1), oldDist = Math.sqrt(dx2*dx2+dy2*dy2);
        if (oldDist > 0) {
          const r = Math.max(SCALE_MIN, Math.min(SCALE_MAX, QI.state.boardTransform.scale * newDist / oldDist)) / QI.state.boardTransform.scale;
          const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2 - viewport.getBoundingClientRect().left;
          const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2 - viewport.getBoundingClientRect().top;
          QI.state.boardTransform.x = cx - (cx - QI.state.boardTransform.x) * r;
          QI.state.boardTransform.y = cy - (cy - QI.state.boardTransform.y) * r;
          QI.state.boardTransform.scale *= r;
          applyTransform(); QI.UI.updateZoomDisplay(); QI.UI.updateMinimap();
        }
      }
      lastTouches = Array.from(e.touches).map(t => ({ x: t.clientX, y: t.clientY }));
    }, { passive: true });

    viewport.addEventListener('touchend', () => {
      isPanning = false; lastTouches = null; QI.Storage.save();
    }, { passive: true });

    // ── Board click (connect cancel / delete connection) ──
    viewport.addEventListener('click', (e) => {
      const onBoard = e.target === viewport || e.target === container || e.target.closest('#connections-svg');
      if (QI.state.activeTool === 'connect' && QI.state.connectingFromId && onBoard) {
        QI.Connections.cancelConnect();
        return;
      }
      if (QI.state.activeTool === 'delete' && onBoard) {
        const coords = screenToBoard(e.clientX, e.clientY);
        const conn = QI.Connections.findNearest(coords.x, coords.y, 18);
        if (conn) {
          QI.UI.showConfirm('Remover esta conexão?', () => {
            QI.Connections.remove(conn.id);
            QI.Storage.save();
            QI.UI.showToast('Conexão removida.', 'info');
            QI.UI.updateMinimap();
          });
        }
      }
    });

    applyTransform();
  }

  function applyTransform() {
    const { x, y, scale } = QI.state.boardTransform;
    container.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
  }

  function screenToBoard(sx, sy) {
    const rect = document.getElementById('board-viewport').getBoundingClientRect();
    const { x, y, scale } = QI.state.boardTransform;
    return { x: (sx - rect.left - x) / scale, y: (sy - rect.top - y) / scale };
  }

  function zoomTo(newScale) {
    const rect = document.getElementById('board-viewport').getBoundingClientRect();
    const cx = rect.width / 2, cy = rect.height / 2;
    const clamped = Math.max(SCALE_MIN, Math.min(SCALE_MAX, newScale));
    const ratio = clamped / QI.state.boardTransform.scale;
    QI.state.boardTransform.x = cx - (cx - QI.state.boardTransform.x) * ratio;
    QI.state.boardTransform.y = cy - (cy - QI.state.boardTransform.y) * ratio;
    QI.state.boardTransform.scale = clamped;
    applyTransform(); QI.UI.updateZoomDisplay(); QI.UI.updateMinimap(); QI.Storage.save();
  }

  function resetView() {
    QI.state.boardTransform = { x: 0, y: 0, scale: 1 };
    applyTransform(); QI.UI.updateZoomDisplay(); QI.UI.updateMinimap(); QI.Storage.save();
  }

  function centerOnClues() {
    if (!QI.state.clues.length) return;
    const rect = document.getElementById('board-viewport').getBoundingClientRect();
    const xs = QI.state.clues.map(c => c.x), ys = QI.state.clues.map(c => c.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs) + 200;
    const minY = Math.min(...ys), maxY = Math.max(...ys) + 200;
    const bw = maxX - minX, bh = maxY - minY;
    const scale = Math.min(Math.min(rect.width / (bw + 140), rect.height / (bh + 140)), 1.2);
    QI.state.boardTransform.scale = scale;
    QI.state.boardTransform.x = (rect.width  - bw * scale) / 2 - minX * scale;
    QI.state.boardTransform.y = (rect.height - bh * scale) / 2 - minY * scale;
    applyTransform(); QI.UI.updateZoomDisplay(); QI.UI.updateMinimap();
  }

  return { init, applyTransform, screenToBoard, zoomTo, resetView, centerOnClues };
})();
