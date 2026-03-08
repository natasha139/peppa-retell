/**
 * Peppa Retell — Teacher Dashboard
 * Core application logic
 */

// ============================================================
// State
// ============================================================
const state = {
  scenes: [],       // Array of Scene objects
  activeTab: 'parser',
};

// Scene schema
function createScene(index, data = {}) {
  return {
    id: `scene-${Date.now()}-${index}`,
    index,
    title: data.title || `Scene ${index + 1}`,
    screenshotDesc: data.screenshotDesc || '',
    keywords: data.keywords || [],
    targetSentence: data.targetSentence || '',
    words: [],          // derived from targetSentence
    maskedIndices: [],   // indices into words[] that are blanked
    connector: data.connector || '',
    imageFile: null,     // File object
    imagePreview: null,  // data URL
    audioFile: null,
    audioName: null,
  };
}

// ============================================================
// Tab Navigation
// ============================================================
document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    const id = btn.dataset.tab;
    document.getElementById(`tab-${id}`).classList.add('active');
    state.activeTab = id;
    if (id === 'export') refreshJsonPreview();
  });
});

// ============================================================
// Script Parser (mock / placeholder for AI call)
// ============================================================
document.getElementById('btn-parse').addEventListener('click', () => {
  const script = document.getElementById('script-input').value.trim();
  const prefs = document.getElementById('parse-prefs').value.trim();
  const statusEl = document.getElementById('parse-status');

  if (!script) {
    showStatus(statusEl, 'Please paste an episode script first.', 'error');
    return;
  }

  showStatus(statusEl, '✨ Parsing script into scenes…', 'info');

  // Simulate AI parsing — split by double newlines or "Scene" markers
  setTimeout(() => {
    const parsed = mockParseScript(script, prefs);
    state.scenes = parsed.map((s, i) => {
      const scene = createScene(i, s);
      scene.words = tokenize(scene.targetSentence);
      return scene;
    });
    renderSceneCards();
    showStatus(statusEl, `✅ Created ${state.scenes.length} scenes. Switch to Scene Editor to refine.`, 'success');
  }, 800);
});

function mockParseScript(script, prefs) {
  // Heuristic split: try to find natural breaks
  const paragraphs = script.split(/\n\s*\n/).filter(p => p.trim());
  const connectors = ['First', 'Then', 'Next', 'After that', 'But', 'So', 'Finally', 'Meanwhile'];
  const numScenes = Math.min(Math.max(paragraphs.length, 3), 8);
  const chunkSize = Math.ceil(paragraphs.length / numScenes);

  const scenes = [];
  for (let i = 0; i < numScenes; i++) {
    const chunk = paragraphs.slice(i * chunkSize, (i + 1) * chunkSize).join('\n');
    if (!chunk.trim()) continue;

    // Extract a plausible target sentence (first line of dialogue or first sentence)
    const lines = chunk.split('\n').map(l => l.trim()).filter(Boolean);
    const dialogueLine = lines.find(l => /[:：]/.test(l));
    let target = '';
    if (dialogueLine) {
      target = dialogueLine.replace(/^[^:：]+[:：]\s*/, '').replace(/["""]/g, '').trim();
    } else {
      target = lines[0].substring(0, 80);
    }

    // Extract keywords (simple: pick 2-3 nouns/verbs > 3 chars)
    const allWords = target.split(/\s+/).filter(w => w.length > 3 && /^[a-zA-Z]+$/.test(w));
    const kw = [...new Set(allWords)].slice(0, 3);

    scenes.push({
      title: `Scene ${i + 1}`,
      screenshotDesc: `Screenshot for scene ${i + 1}`,
      keywords: kw,
      targetSentence: target,
      connector: connectors[i % connectors.length],
    });
  }

  return scenes.length ? scenes : [{
    title: 'Scene 1',
    screenshotDesc: 'Main scene',
    keywords: ['Peppa', 'play'],
    targetSentence: 'Peppa loves jumping in muddy puddles.',
    connector: 'First',
  }];
}

// ============================================================
// Scene Card Rendering
// ============================================================
function renderSceneCards() {
  const container = document.getElementById('scene-list');

  if (!state.scenes.length) {
    container.innerHTML = '<p class="empty-state">No scenes yet. Parse a script first.</p>';
    return;
  }

  container.innerHTML = state.scenes.map((scene, idx) => `
    <div class="scene-card" data-scene-idx="${idx}">
      <div class="scene-card-header">
        <h3>${escHtml(scene.title)}</h3>
        <button class="btn-secondary btn-delete-scene" data-idx="${idx}">✕ Remove</button>
      </div>
      <div class="scene-card-body">

        <!-- Upload Row -->
        <div class="upload-row">
          <div class="upload-slot ${scene.imageFile ? 'has-file' : ''}" id="img-slot-${idx}">
            <div class="slot-icon">🖼️</div>
            <div class="slot-label">Screenshot</div>
            ${scene.imagePreview
              ? `<img src="${scene.imagePreview}" style="max-width:100%;max-height:120px;border-radius:4px;margin-top:0.5rem;" alt="Scene screenshot">`
              : '<div class="file-name">Click or drag to upload</div>'}
            <input type="file" accept="image/*" data-idx="${idx}" data-type="image" aria-label="Upload screenshot for ${escHtml(scene.title)}">
          </div>
          <div class="upload-slot ${scene.audioFile ? 'has-file' : ''}" id="audio-slot-${idx}">
            <div class="slot-icon">🔊</div>
            <div class="slot-label">Audio Clip</div>
            <div class="file-name">${scene.audioName || 'Click or drag to upload'}</div>
            <input type="file" accept="audio/*" data-idx="${idx}" data-type="audio" aria-label="Upload audio clip for ${escHtml(scene.title)}">
          </div>
        </div>

        <!-- Keywords -->
        <div>
          <div style="font-size:0.75rem;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:var(--text-muted);margin-bottom:0.4rem;">Keywords</div>
          <div class="keywords-row" id="kw-row-${idx}">
            ${scene.keywords.map((kw, ki) => `
              <span class="keyword-tag">
                ${escHtml(kw)}
                <span class="remove-kw" data-scene="${idx}" data-kw="${ki}" role="button" aria-label="Remove keyword ${escHtml(kw)}">✕</span>
              </span>
            `).join('')}
            <input type="text" class="add-keyword-input" data-idx="${idx}" placeholder="+ add keyword" aria-label="Add keyword for ${escHtml(scene.title)}">
          </div>
        </div>

        <!-- Target Sentence -->
        <div class="target-sentence-area">
          <div class="area-label">Target Sentence (A1)</div>
          <input type="text" class="target-edit-input" data-idx="${idx}" value="${escAttr(scene.targetSentence)}" aria-label="Edit target sentence for ${escHtml(scene.title)}">
          <div class="hint">Click a word to toggle blank (masked words shown in blue).</div>
          <div class="word-tokens" id="tokens-${idx}">
            ${scene.words.map((w, wi) => `
              <span class="word-token ${scene.maskedIndices.includes(wi) ? 'masked' : ''}"
                    data-scene="${idx}" data-word="${wi}"
                    role="button" tabindex="0"
                    aria-pressed="${scene.maskedIndices.includes(wi)}"
                    aria-label="Toggle blank for word ${escHtml(w)}">${escHtml(w)}</span>
            `).join('')}
          </div>
        </div>

        <!-- Connector -->
        <div class="connector-row">
          <label for="conn-${idx}">Connector:</label>
          <select id="conn-${idx}" data-idx="${idx}" aria-label="Select connector for ${escHtml(scene.title)}">
            ${['', 'First', 'Then', 'Next', 'After that', 'But', 'So', 'Finally', 'Meanwhile', 'However', 'Because'].map(c =>
              `<option value="${c}" ${c === scene.connector ? 'selected' : ''}>${c || '— none —'}</option>`
            ).join('')}
          </select>
        </div>

      </div>
    </div>
  `).join('');

  bindSceneEvents();
}

// ============================================================
// Event Binding for Scene Cards
// ============================================================
function bindSceneEvents() {
  // File uploads
  document.querySelectorAll('.upload-slot input[type="file"]').forEach(input => {
    input.addEventListener('change', handleFileUpload);
  });

  // Remove keyword
  document.querySelectorAll('.remove-kw').forEach(btn => {
    btn.addEventListener('click', e => {
      const si = +e.target.dataset.scene;
      const ki = +e.target.dataset.kw;
      state.scenes[si].keywords.splice(ki, 1);
      renderSceneCards();
    });
  });

  // Add keyword
  document.querySelectorAll('.add-keyword-input').forEach(input => {
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter' && e.target.value.trim()) {
        const idx = +e.target.dataset.idx;
        state.scenes[idx].keywords.push(e.target.value.trim());
        renderSceneCards();
      }
    });
  });

  // Word token click (toggle mask)
  document.querySelectorAll('.word-token').forEach(token => {
    const handler = () => {
      const si = +token.dataset.scene;
      const wi = +token.dataset.word;
      const scene = state.scenes[si];
      const pos = scene.maskedIndices.indexOf(wi);
      if (pos === -1) {
        scene.maskedIndices.push(wi);
        token.classList.add('masked');
        token.setAttribute('aria-pressed', 'true');
      } else {
        scene.maskedIndices.splice(pos, 1);
        token.classList.remove('masked');
        token.setAttribute('aria-pressed', 'false');
      }
    };
    token.addEventListener('click', handler);
    token.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handler(); } });
  });

  // Edit target sentence
  document.querySelectorAll('.target-edit-input').forEach(input => {
    input.addEventListener('change', e => {
      const idx = +e.target.dataset.idx;
      state.scenes[idx].targetSentence = e.target.value;
      state.scenes[idx].words = tokenize(e.target.value);
      state.scenes[idx].maskedIndices = [];
      renderSceneCards();
    });
  });

  // Connector change
  document.querySelectorAll('.connector-row select').forEach(sel => {
    sel.addEventListener('change', e => {
      const idx = +e.target.dataset.idx;
      state.scenes[idx].connector = e.target.value;
    });
  });

  // Delete scene
  document.querySelectorAll('.btn-delete-scene').forEach(btn => {
    btn.addEventListener('click', e => {
      const idx = +e.target.dataset.idx;
      state.scenes.splice(idx, 1);
      state.scenes.forEach((s, i) => { s.index = i; s.title = `Scene ${i + 1}`; });
      renderSceneCards();
    });
  });
}

// ============================================================
// File Upload Handler
// ============================================================
function handleFileUpload(e) {
  const idx = +e.target.dataset.idx;
  const type = e.target.dataset.type;
  const file = e.target.files[0];
  if (!file) return;

  const scene = state.scenes[idx];

  if (type === 'image') {
    scene.imageFile = file;
    const reader = new FileReader();
    reader.onload = () => {
      scene.imagePreview = reader.result;
      renderSceneCards();
    };
    reader.readAsDataURL(file);
  } else if (type === 'audio') {
    scene.audioFile = file;
    scene.audioName = file.name;
    renderSceneCards();
  }
}

// ============================================================
// Export
// ============================================================
document.getElementById('btn-export').addEventListener('click', () => {
  const config = buildExportConfig();
  const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'config.json';
  a.click();
  URL.revokeObjectURL(url);
});

function buildExportConfig() {
  return {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    scenes: state.scenes.map(s => ({
      title: s.title,
      screenshotDesc: s.screenshotDesc,
      keywords: s.keywords,
      targetSentence: s.targetSentence,
      words: s.words,
      maskedWords: s.maskedIndices.map(i => ({
        index: i,
        word: s.words[i],
        is_masked: true,
      })),
      connector: s.connector,
      image: s.imageFile ? s.imageFile.name : null,
      audio: s.audioFile ? s.audioFile.name : null,
    })),
  };
}

function refreshJsonPreview() {
  const el = document.getElementById('json-preview');
  el.textContent = JSON.stringify(buildExportConfig(), null, 2);
}

// ============================================================
// Utilities
// ============================================================
function tokenize(sentence) {
  return sentence.split(/(\s+)/).filter(t => t.trim()).map(t => t.trim());
}

function escHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function escAttr(str) {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function showStatus(el, msg, type) {
  el.textContent = msg;
  el.className = `status-msg ${type}`;
}
