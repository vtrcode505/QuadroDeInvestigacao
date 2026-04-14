/* ================================================================
   main.js — Bootstrap e atalhos globais
   ================================================================ */
window.QI = window.QI || {};

/* ── Estado Global ── */
QI.state = {
  clues:                [],
  connections:          [],
  annotations:          {},
  drawings:             [],         // freehand SVG strokes
  boardTransform:       { x: 0, y: 0, scale: 1 },
  mode:                 'player',   // 'player' | 'master'
  activeTool:           'move',
  activeConnectionColor:'#bb1111',
  connectingFromId:     null,
  _previewFrom:         null,
  drawColor:            '#1c1208',  // default ink colour
  drawWidth:            3,
  drawMode:             'pen',      // 'pen' | 'eraser'
  eraserSize:           26,
};

/* ── Bootstrap ── */
document.addEventListener('DOMContentLoaded', () => {
  try {
    const hasData = QI.Storage.load();
    QI.Board.init();
    QI.Connections.init();
    QI.Cards.init();
    QI.Draw.init();
    QI.UI.init();
    QI.Cards.renderAll();
    QI.Connections.renderAll();
    QI.Draw.renderAll();
    QI.Board.applyTransform();
    QI.UI.updateZoomDisplay();
    QI.UI.updateMinimap();
    QI.UI.setTool('move');
    if (hasData && QI.state.clues.length > 0) {
      setTimeout(() => QI.Board.centerOnClues(), 150);
    }
    console.log('[QI] Pronto. Pistas:', QI.state.clues.length, '| Conexões:', QI.state.connections.length, '| Rabiscos:', QI.state.drawings.length);
  } catch (err) {
    console.error('[QI] Erro na inicialização:', err);
  }
});

/* ── Atalhos de Teclado ── */
document.addEventListener('keydown', (e) => {
  if (['INPUT','TEXTAREA'].includes(e.target.tagName)) return;
  if (e.target.isContentEditable) return;
  if (document.querySelector('.modal.open')) return;

  const k = e.key.toLowerCase();

  if (k === 'm' && !e.ctrlKey) { QI.UI.setMode(QI.state.mode === 'master' ? 'player' : 'master'); return; }

  const toolMap = { v:'move', p:'pin', c:'connect', a:'annotate', d:'draw' };
  if (toolMap[k] && !e.ctrlKey) { QI.UI.setTool(toolMap[k]); return; }

  if ((e.key === 'Delete' || e.key === 'Backspace') && !e.ctrlKey) { QI.UI.setTool('delete'); return; }

  if (k === 'n' && !e.ctrlKey && QI.state.mode === 'master') { QI.UI.openEditModal(null); return; }

  if (e.ctrlKey && k === 'e') { e.preventDefault(); QI.Storage.exportJSON(); QI.UI.showToast('Exportado!', 'success'); return; }
  if (e.ctrlKey && k === 'i') { e.preventDefault(); document.getElementById('import-file-input').click(); return; }
  if (e.ctrlKey && k === 'z') { e.preventDefault(); QI.UI.showToast('Undo não implementado — exporte para salvar o estado.', 'info'); return; }
  if (e.ctrlKey && (k === '=' || k === '+')) { e.preventDefault(); QI.Board.zoomTo(QI.state.boardTransform.scale + 0.15); }
  if (e.ctrlKey && k === '-')  { e.preventDefault(); QI.Board.zoomTo(QI.state.boardTransform.scale - 0.15); }
  if (e.ctrlKey && k === '0')  { e.preventDefault(); QI.Board.resetView(); }
});
