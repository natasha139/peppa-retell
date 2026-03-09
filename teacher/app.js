/**
 * Peppa Retell — Teacher Dashboard
 * 4 fixed scenes, manual target sentences, global audio with time ranges
 */

// ============================================================
// State
// ============================================================
const SCENE_STRUCTURE = [
  { label: 'Setting',   connector: 'First',      desc: 'Where and who' },
  { label: 'Beginning', connector: 'Then',        desc: 'What starts happening' },
  { label: 'Middle',    connector: 'After that',  desc: 'The main event or problem' },
  { label: 'Ending',    connector: 'Finally',     desc: 'How it ends' },
];

const state = {
  scenes: SCENE_STRUCTURE.map((s, i) => createScene(i, s)),
  activeTab: 'editor',
  audioFile: null,
  audioName: null,
  audioUrl: null,
  audioDuration: 0,
};

function createScene(index, structure) {
  return {
    id: `scene-${Date.now()}-${index}`,
    index,
    title: structure.label,
    connector: structure.connector,
    desc: structure.desc,
    keywords: [],
    targetSentences: [''],
    sentenceWords: [[]],
    sentenceMasks: [[]],
    imageFiles: [],      // array of { file, preview }
    audioStart: '',  // mm:ss
    audioEnd: '',    // mm:ss
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
    if (id === 'export') {
      refreshJsonPreview();
      renderMindMaps();
    }
  });
});

// ============================================================
// Global Audio Upload
// ============================================================
document.getElementById('global-audio-input').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  state.audioFile = file;
  state.audioName = file.name;

  if (state.audioUrl) URL.revokeObjectURL(state.audioUrl);
  state.audioUrl = URL.createObjectURL(file);

  const player = document.getElementById('global-audio-player');
  player.src = state.audioUrl;
  player.onloadedmetadata = () => {
    state.audioDuration = player.duration;
    player.style.display = 'block';
    renderAudioStatus();
    renderSceneCards(); // re-render to enable preview buttons
  };

  renderAudioStatus();
});

function renderAudioStatus() {
  const el = document.getElementById('audio-status');
  if (state.audioFile) {
    const dur = state.audioDuration ? ` (${formatTime(state.audioDuration)})` : '';
    el.innerHTML = `<span class="audio-loaded">✅ ${escHtml(state.audioName)}${dur}</span>`;
  } else {
    el.innerHTML = '';
  }
}

// ============================================================
// Scene Card Rendering
// ============================================================
function renderSceneCards() {
  const container = document.getElementById('scene-list');

  container.innerHTML = state.scenes.map((scene, idx) => `
    <div class="scene-card" data-scene-idx="${idx}">
      <div class="scene-card-header">
        <h3>${escHtml(scene.title)}</h3>
        <span class="scene-desc">${escHtml(scene.desc)}</span>
      </div>
      <div class="scene-card-body">

        <!-- Screenshots -->
        <div class="screenshots-section">
          <div style="font-size:0.75rem;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:var(--text-muted);margin-bottom:0.5rem;">🖼️ Screenshots</div>
          <div class="screenshots-grid" id="screenshots-${idx}">
            ${scene.imageFiles.map((img, ii) => `
              <div class="screenshot-thumb">
                <img src="${img.preview}" alt="Screenshot ${ii + 1}">
                <button class="screenshot-remove" data-idx="${idx}" data-img="${ii}" aria-label="Remove screenshot ${ii + 1}">✕</button>
              </div>
            `).join('')}
            <label class="screenshot-add" for="img-input-${idx}">
              <span class="screenshot-add-icon">+</span>
              <span class="screenshot-add-label">Click or drag</span>
              <input type="file" id="img-input-${idx}" accept="image/*" multiple data-idx="${idx}" hidden>
            </label>
          </div>
        </div>

        <!-- Audio Time Range -->
        <div class="audio-range-row">
          <div class="range-label">🔊 Audio Clip Range</div>
          <div class="range-inputs">
            <label>
              Start
              <input type="text" class="time-input audio-start" data-idx="${idx}" value="${escAttr(scene.audioStart)}" placeholder="0:00" aria-label="Audio start time for ${escHtml(scene.title)}">
            </label>
            <span class="range-sep">→</span>
            <label>
              End
              <input type="text" class="time-input audio-end" data-idx="${idx}" value="${escAttr(scene.audioEnd)}" placeholder="0:30" aria-label="Audio end time for ${escHtml(scene.title)}">
            </label>
            <button class="btn-secondary btn-preview-audio" data-idx="${idx}" ${state.audioUrl ? '' : 'disabled'}>▶ Preview</button>
          </div>
          ${!state.audioUrl ? '<div class="hint">Upload the story audio above first.</div>' : ''}
        </div>

        <!-- Keywords -->
        <div>
          <div style="font-size:0.75rem;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:var(--text-muted);margin-bottom:0.4rem;">Keywords (2-3)</div>
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

        <!-- Target Sentences -->
        <div class="target-sentences-area">
          ${scene.targetSentences.map((sent, si) => `
            <div class="target-sentence-area" style="margin-bottom:0.75rem;">
              <div class="area-label">Target Sentence ${si + 1} (A1-A2)</div>
              <input type="text" class="target-edit-input" data-idx="${idx}" data-sent="${si}" value="${escAttr(sent)}" placeholder="Type or paste the target sentence here…" aria-label="Target sentence ${si + 1} for ${escHtml(scene.title)}">
              ${sent.trim() ? `
                <div class="hint">Click a word to toggle blank (masked words shown in blue).${scene.targetSentences.length > 1 ? ` <span class="remove-sent-btn" data-idx="${idx}" data-sent="${si}">✕ Remove</span>` : ''}</div>
                <div class="word-tokens" id="tokens-${idx}-${si}">
                  ${(scene.sentenceWords[si] || []).map((w, wi) => `
                    <span class="word-token ${(scene.sentenceMasks[si] || []).includes(wi) ? 'masked' : ''}"
                          data-scene="${idx}" data-sent="${si}" data-word="${wi}"
                          role="button" tabindex="0"
                          aria-pressed="${(scene.sentenceMasks[si] || []).includes(wi)}"
                          aria-label="Toggle blank for word ${escHtml(w)}">${escHtml(w)}</span>
                  `).join('')}
                </div>
              ` : '<div class="hint">Enter a sentence above to enable word masking.</div>'}
            </div>
          `).join('')}
          <button class="btn-secondary btn-add-sentence" data-idx="${idx}">+ Add Target Sentence</button>
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
// Event Binding
// ============================================================
function bindSceneEvents() {
  // Screenshot uploads (multiple) — click
  document.querySelectorAll('.screenshots-grid input[type="file"]').forEach(input => {
    input.addEventListener('change', handleImageUpload);
  });

  // Screenshot drag & drop
  document.querySelectorAll('.screenshots-grid').forEach(grid => {
    const idx = +grid.id.split('-')[1]; // screenshots-0 → 0
    grid.addEventListener('dragover', e => {
      e.preventDefault();
      grid.classList.add('drag-over');
    });
    grid.addEventListener('dragleave', e => {
      e.preventDefault();
      grid.classList.remove('drag-over');
    });
    grid.addEventListener('drop', e => {
      e.preventDefault();
      grid.classList.remove('drag-over');
      const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
      if (files.length) addImagesToScene(idx, files);
    });
  });

  // Remove screenshot
  document.querySelectorAll('.screenshot-remove').forEach(btn => {
    btn.addEventListener('click', e => {
      const idx = +e.target.dataset.idx;
      const ii = +e.target.dataset.img;
      state.scenes[idx].imageFiles.splice(ii, 1);
      renderSceneCards();
    });
  });

  // Audio time range inputs
  document.querySelectorAll('.audio-start').forEach(input => {
    input.addEventListener('change', e => {
      state.scenes[+e.target.dataset.idx].audioStart = e.target.value.trim();
    });
  });
  document.querySelectorAll('.audio-end').forEach(input => {
    input.addEventListener('change', e => {
      state.scenes[+e.target.dataset.idx].audioEnd = e.target.value.trim();
    });
  });

  // Preview audio clip
  document.querySelectorAll('.btn-preview-audio').forEach(btn => {
    btn.addEventListener('click', e => {
      const idx = +e.target.dataset.idx;
      previewAudioClip(idx);
    });
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
      const sceneIdx = +token.dataset.scene;
      const sentIdx = +token.dataset.sent;
      const wordIdx = +token.dataset.word;
      const scene = state.scenes[sceneIdx];
      const masks = scene.sentenceMasks[sentIdx];
      const pos = masks.indexOf(wordIdx);
      if (pos === -1) {
        masks.push(wordIdx);
        token.classList.add('masked');
        token.setAttribute('aria-pressed', 'true');
      } else {
        masks.splice(pos, 1);
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
      const si = +e.target.dataset.sent;
      const val = e.target.value.trim();
      state.scenes[idx].targetSentences[si] = val;
      state.scenes[idx].sentenceWords[si] = val ? tokenize(val) : [];
      state.scenes[idx].sentenceMasks[si] = [];
      renderSceneCards();
    });
  });

  // Add target sentence
  document.querySelectorAll('.btn-add-sentence').forEach(btn => {
    btn.addEventListener('click', e => {
      const idx = +e.target.dataset.idx;
      const scene = state.scenes[idx];
      scene.targetSentences.push('');
      scene.sentenceWords.push([]);
      scene.sentenceMasks.push([]);
      renderSceneCards();
    });
  });

  // Remove target sentence
  document.querySelectorAll('.remove-sent-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      const idx = +e.target.dataset.idx;
      const si = +e.target.dataset.sent;
      const scene = state.scenes[idx];
      scene.targetSentences.splice(si, 1);
      scene.sentenceWords.splice(si, 1);
      scene.sentenceMasks.splice(si, 1);
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
}

// ============================================================
// Audio Preview — play the clip between start/end times
// ============================================================
let previewTimer = null;

function previewAudioClip(sceneIdx) {
  const scene = state.scenes[sceneIdx];
  const player = document.getElementById('global-audio-player');
  if (!state.audioUrl) return;

  const startSec = parseTime(scene.audioStart) || 0;
  const endSec = parseTime(scene.audioEnd) || state.audioDuration || 0;

  if (endSec <= startSec) return;

  // Stop any previous preview
  if (previewTimer) { clearInterval(previewTimer); previewTimer = null; }
  player.pause();

  player.currentTime = startSec;
  player.play();

  previewTimer = setInterval(() => {
    if (player.currentTime >= endSec) {
      player.pause();
      clearInterval(previewTimer);
      previewTimer = null;
    }
  }, 100);
}

// ============================================================
// Image Upload Handler (multiple per scene)
// ============================================================
function handleImageUpload(e) {
  const idx = +e.target.dataset.idx;
  const files = Array.from(e.target.files).filter(f => f.type.startsWith('image/'));
  if (files.length) addImagesToScene(idx, files);
}

function addImagesToScene(idx, files) {
  const scene = state.scenes[idx];
  let loaded = 0;
  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = () => {
      scene.imageFiles.push({ file, preview: reader.result });
      loaded++;
      if (loaded === files.length) renderSceneCards();
    };
    reader.readAsDataURL(file);
  });
}

// ============================================================
// Export — embeds base64 images & audio into JSON
// ============================================================
document.getElementById('btn-export').addEventListener('click', async () => {
  const config = await buildExportConfig();
  const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'config.json';
  a.click();
  URL.revokeObjectURL(url);
});

// ============================================================
// Mind Map Generation (SVG)
// ============================================================
const BRANCH_COLORS = ['#4a9e6f', '#4a6fa5', '#c0792b', '#9b59b6'];
const BRANCH_BG     = ['#e8f5ee', '#e8eff8', '#fdf0e0', '#f3e8fa'];

function generateMindMapSVG(masked) {
  const scenes = state.scenes;
  const title = '🐷 Story Retell';

  // Layout constants
  const centerX = 480, centerY = 52;
  const branchStartY = 110;
  const colWidth = 220;
  const sentLineH = 22;
  const sentPadY = 10;
  const branchGap = 16;
  const kwLineH = 18;

  // Calculate total height needed
  let maxBranchH = 0;
  const branchData = scenes.map((scene, i) => {
    const sents = scene.targetSentences.filter(s => s.trim());
    // Wrap each sentence into lines (~30 chars)
    const wrappedSents = sents.map((sent, si) => {
      if (masked) {
        const words = scene.sentenceWords[si] || [];
        const masks = scene.sentenceMasks[si] || [];
        const display = words.map((w, wi) => masks.includes(wi) ? '______' : w).join(' ');
        return wrapText(display, 28);
      }
      return wrapText(sent, 28);
    });
    const kwCount = scene.keywords.length;
    const sentTotalLines = wrappedSents.reduce((a, lines) => a + lines.length, 0) + (wrappedSents.length - 1) * 0.4;
    const h = sentPadY * 2 + sentTotalLines * sentLineH + (kwCount ? kwLineH + 8 : 0);
    if (h > maxBranchH) maxBranchH = h;
    return { scene, wrappedSents, h };
  });

  const svgW = 960;
  const svgH = branchStartY + maxBranchH + 60;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}">`;
  svg += `<rect width="${svgW}" height="${svgH}" fill="#fafaf8"/>`;

  // Title
  svg += `<text x="${centerX}" y="${centerY}" text-anchor="middle" font-family="Inter, sans-serif" font-size="22" font-weight="700" fill="#2c2c2c">${escSvg(title)}</text>`;

  // Branches
  const totalW = branchData.length * colWidth + (branchData.length - 1) * branchGap;
  const startX = (svgW - totalW) / 2;

  branchData.forEach((bd, i) => {
    const x = startX + i * (colWidth + branchGap);
    const y = branchStartY;
    const color = BRANCH_COLORS[i];
    const bg = BRANCH_BG[i];
    const scene = bd.scene;

    // Connector line from title to branch
    const bx = x + colWidth / 2;
    svg += `<line x1="${centerX}" y1="${centerY + 10}" x2="${bx}" y2="${y}" stroke="${color}" stroke-width="2" stroke-dasharray="4,3" opacity="0.5"/>`;

    // Branch box
    const boxH = bd.h;
    svg += `<rect x="${x}" y="${y}" width="${colWidth}" height="${boxH}" rx="10" fill="${bg}" stroke="${color}" stroke-width="1.5"/>`;

    // Branch title
    const titleY = y + 24;
    svg += `<text x="${bx}" y="${titleY}" text-anchor="middle" font-family="Inter, sans-serif" font-size="14" font-weight="700" fill="${color}">${escSvg(scene.title)}</text>`;

    // Connector word
    if (scene.connector) {
      svg += `<text x="${bx}" y="${titleY + 16}" text-anchor="middle" font-family="Inter, sans-serif" font-size="10" font-style="italic" fill="${color}" opacity="0.7">${escSvg(scene.connector)}</text>`;
    }

    // Keywords
    let curY = titleY + 32;
    if (scene.keywords.length) {
      const kwStr = scene.keywords.join(' · ');
      svg += `<text x="${bx}" y="${curY}" text-anchor="middle" font-family="Inter, sans-serif" font-size="10" font-weight="600" fill="${color}" opacity="0.8">🔑 ${escSvg(kwStr)}</text>`;
      curY += kwLineH + 4;
    }

    // Sentences
    bd.wrappedSents.forEach((lines, si) => {
      lines.forEach(line => {
        svg += `<text x="${x + 14}" y="${curY}" font-family="Inter, sans-serif" font-size="12" fill="#2c2c2c">${escSvg(line)}</text>`;
        curY += sentLineH;
      });
      curY += sentLineH * 0.4; // gap between sentences
    });
  });

  svg += '</svg>';
  return svg;
}

function wrapText(text, maxChars) {
  const words = text.split(/\s+/);
  const lines = [];
  let cur = '';
  for (const w of words) {
    if (cur && (cur.length + 1 + w.length) > maxChars) {
      lines.push(cur);
      cur = w;
    } else {
      cur = cur ? cur + ' ' + w : w;
    }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [''];
}

function escSvg(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderMindMaps() {
  document.getElementById('mindmap-complete').innerHTML = generateMindMapSVG(false);
  document.getElementById('mindmap-masked').innerHTML = generateMindMapSVG(true);
}

function downloadMindMapPNG(masked) {
  const svgStr = generateMindMapSVG(masked);
  const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.onload = () => {
    const scale = 2; // retina
    const canvas = document.createElement('canvas');
    canvas.width = img.width * scale;
    canvas.height = img.height * scale;
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0);
    URL.revokeObjectURL(url);
    canvas.toBlob(pngBlob => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(pngBlob);
      a.download = masked ? 'mindmap-masked.png' : 'mindmap-complete.png';
      a.click();
      URL.revokeObjectURL(a.href);
    }, 'image/png');
  };
  img.src = url;
}

document.getElementById('btn-dl-mindmap-complete').addEventListener('click', () => downloadMindMapPNG(false));
document.getElementById('btn-dl-mindmap-masked').addEventListener('click', () => downloadMindMapPNG(true));

async function buildExportConfig() {
  // Read global audio as base64 if present
  let audioData = null;
  if (state.audioFile) {
    audioData = await fileToBase64(state.audioFile);
  }

  const scenes = await Promise.all(state.scenes.map(async s => {
    // Read all images as base64
    const imageDataArr = await Promise.all(
      s.imageFiles.map(img => fileToBase64(img.file))
    );

    return {
      title: s.title,
      keywords: s.keywords,
      connector: s.connector,
      audioStart: s.audioStart || null,
      audioEnd: s.audioEnd || null,
      audioStartSec: parseTime(s.audioStart) || 0,
      audioEndSec: parseTime(s.audioEnd) || null,
      targetSentences: s.targetSentences.filter(t => t.trim()).map((sent, si) => ({
        text: sent,
        words: s.sentenceWords[si],
        maskedWords: (s.sentenceMasks[si] || []).map(i => ({
          index: i,
          word: (s.sentenceWords[si] || [])[i],
          is_masked: true,
        })),
      })),
      targetSentence: s.targetSentences[0] || '',
      words: s.sentenceWords[0] || [],
      maskedWords: (s.sentenceMasks[0] || []).map(i => ({
        index: i,
        word: (s.sentenceWords[0] || [])[i],
        is_masked: true,
      })),
      image: s.imageFiles.length ? s.imageFiles[0].file.name : null,
      images: s.imageFiles.map(img => img.file.name),
      imageData: imageDataArr,  // base64 data URIs
    };
  }));

  return {
    version: '2.2',
    exportedAt: new Date().toISOString(),
    audio: state.audioFile ? state.audioName : null,
    audioData,  // base64 data URI of full audio
    scenes,
  };
}

/** Convert a File to a base64 data URI */
function fileToBase64(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

async function refreshJsonPreview() {
  const el = document.getElementById('json-preview');
  const config = await buildExportConfig();
  // Show preview without bulky base64 data
  const preview = JSON.parse(JSON.stringify(config));
  if (preview.audioData) preview.audioData = '(base64 audio data…)';
  preview.scenes.forEach(s => {
    if (s.imageData) s.imageData = s.imageData.map(() => '(base64 image data…)');
  });
  el.textContent = JSON.stringify(preview, null, 2);
}

// ============================================================
// Utilities
// ============================================================
function tokenize(sentence) {
  return sentence.split(/(\s+)/).filter(t => t.trim()).map(t => t.trim());
}

/** Parse "m:ss" or "mm:ss" to seconds */
function parseTime(str) {
  if (!str) return null;
  const parts = str.trim().split(':');
  if (parts.length === 2) {
    return (+parts[0]) * 60 + (+parts[1]);
  }
  if (parts.length === 1 && !isNaN(+parts[0])) {
    return +parts[0];
  }
  return null;
}

/** Format seconds to m:ss */
function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function escHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function escAttr(str) {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ============================================================
// Init
// ============================================================
renderSceneCards();
