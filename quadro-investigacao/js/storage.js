/* ================================================================
   storage.js — Persistência via localStorage + export/import JSON
   ================================================================ */
window.QI = window.QI || {};

QI.Storage = (() => {
  const KEY = 'quadro_investigacao_v1';

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(QI.state)); }
    catch (e) { console.error('[QI.Storage] save:', e); }
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY); if (!raw) return false;
      const s = JSON.parse(raw);
      if (Array.isArray(s.clues))       QI.state.clues       = s.clues;
      if (Array.isArray(s.connections)) QI.state.connections = s.connections;
      if (Array.isArray(s.drawings))    QI.state.drawings    = s.drawings;
      if (s.annotations && typeof s.annotations === 'object') QI.state.annotations = s.annotations;
      if (s.boardTransform) QI.state.boardTransform = { ...QI.state.boardTransform, ...s.boardTransform };
      return true;
    } catch (e) { console.error('[QI.Storage] load:', e); return false; }
  }

  function exportJSON() {
    const blob = new Blob([JSON.stringify(QI.state, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `quadro-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function importJSON(file, callback) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imp = JSON.parse(e.target.result);
        if (!Array.isArray(imp.clues)) throw new Error('Formato inválido');
        QI.state.clues       = imp.clues;
        QI.state.connections = Array.isArray(imp.connections) ? imp.connections : [];
        QI.state.drawings    = Array.isArray(imp.drawings)    ? imp.drawings    : [];
        QI.state.annotations = (imp.annotations && typeof imp.annotations === 'object') ? imp.annotations : {};
        if (imp.boardTransform) QI.state.boardTransform = imp.boardTransform;
        save(); callback(true);
      } catch (err) { console.error('[QI.Storage] import:', err); callback(false); }
    };
    reader.readAsText(file);
  }

  function clear() {
    localStorage.removeItem(KEY);
    QI.state.clues = []; QI.state.connections = []; QI.state.drawings = []; QI.state.annotations = {};
    QI.state.boardTransform = { x: 0, y: 0, scale: 1 };
  }

  return { save, load, exportJSON, importJSON, clear };
})();
