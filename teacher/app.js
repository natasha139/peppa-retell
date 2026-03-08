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

// Scene schema — supports multiple target sentences
function createScene(index, data = {}) {
  const sentences = data.targetSentences || (data.targetSentence ? [data.targetSentence] : []);
  return {
    id: `scene-${Date.now()}-${index}`,
    index,
    title: data.title || `Scene ${index + 1}`,
    screenshotDesc: data.screenshotDesc || '',
    keywords: data.keywords || [],
    targetSentences: sentences,
    // Per-sentence word tokens and mask indices
    sentenceWords: sentences.map(s => tokenize(s)),
    sentenceMasks: sentences.map(() => []),
    connector: data.connector || '',
    imageFile: null,
    imagePreview: null,
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
// Script Parser
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

  setTimeout(() => {
    const parsed = parseScript(script, prefs);
    state.scenes = parsed.map((s, i) => createScene(i, s));
    renderSceneCards();
    showStatus(statusEl, `✅ Created ${state.scenes.length} scenes (Setting → Beginning → Middle → Ending). Switch to Scene Editor to refine.`, 'success');
  }, 600);
});

// ============================================================
// Smart Script Parser — 4-act structure
// ============================================================

// Common A1-A2 stop words to exclude from keyword extraction
const STOP_WORDS = new Set([
  'the','a','an','is','are','was','were','be','been','being','have','has','had',
  'do','does','did','will','would','shall','should','may','might','must','can','could',
  'i','you','he','she','it','we','they','me','him','her','us','them','my','your',
  'his','its','our','their','mine','yours','hers','ours','theirs','this','that',
  'these','those','what','which','who','whom','whose','where','when','how','why',
  'and','but','or','nor','not','no','so','if','then','than','too','very','just',
  'about','after','all','also','any','back','because','before','between','both',
  'come','comes','came','day','each','even','first','from','get','gets','got',
  'give','go','goes','going','gone','went','good','great','here','into','know',
  'like','likes','little','look','looks','looking','make','makes','more','much',
  'new','now','off','old','one','only','other','out','over','own','part','people',
  'right','same','say','says','said','see','some','still','such','take','tell',
  'thing','think','time','two','under','upon','use','want','wants','way','well',
  'with','work','year','yes','oh','okay','really','dear','let','lets',
  'peppa','george','pig','daddy','mummy','narrator','miss','rabbit','suzy','sheep',
  'danny','dog','pedro','pony','emily','elephant','rebecca','zoe','zebra','freddy','fox',
  'grandpa','granny','mr','mrs','madame','gazelle',
]);

function parseScript(script, prefs) {
  const lines = script.split('\n').map(l => l.trim()).filter(Boolean);

  // Step 1: Split into 4 roughly equal acts
  const acts = splitIntoActs(lines);

  // Step 2: For each act, extract keywords and generate target sentences
  const storyStructure = [
    { label: 'Setting',   connector: 'First',      desc: 'Where and who' },
    { label: 'Beginning', connector: 'Then',        desc: 'What starts happening' },
    { label: 'Middle',    connector: 'After that',  desc: 'The main event or problem' },
    { label: 'Ending',    connector: 'Finally',     desc: 'How it ends' },
  ];

  return acts.map((actLines, i) => {
    const structure = storyStructure[i];
    const actText = actLines.join('\n');

    // Extract dialogue and narration
    const { dialogues, narration } = extractDialogueAndNarration(actLines);

    // Extract 2-3 keywords
    const keywords = extractKeywords(actLines, 3);

    // Generate 1-2 A1-A2 target sentences
    const targetSentences = generateTargetSentences(actLines, dialogues, narration, structure, keywords);

    // Generate screenshot description
    const screenshotDesc = generateScreenshotDesc(actLines, structure);

    return {
      title: `${structure.label}`,
      screenshotDesc,
      keywords,
      targetSentences,
      connector: structure.connector,
    };
  });
}

/**
 * Split lines into 4 acts using narrative cues or equal division
 */
function splitIntoActs(lines) {
  // Try to detect scene/act markers
  const breakPatterns = [
    /^(scene|act|part)\s*\d/i,
    /^---+$/,
    /^\[.*\]$/,
  ];

  // Look for natural narrative breaks
  const breakIndices = [];
  for (let i = 1; i < lines.length - 1; i++) {
    const line = lines[i];
    // Explicit markers
    if (breakPatterns.some(p => p.test(line))) {
      breakIndices.push(i);
      continue;
    }
    // Narrator lines often signal transitions
    if (/^narrator\s*[:：]/i.test(line) && i > 3) {
      breakIndices.push(i);
    }
  }

  // If we found enough natural breaks, use them to create 4 acts
  if (breakIndices.length >= 3) {
    // Pick 3 break points to create 4 segments
    const picks = pickEvenlySpaced(breakIndices, 3);
    return splitAtIndices(lines, picks);
  }

  // Fallback: split into 4 roughly equal parts
  const chunkSize = Math.ceil(lines.length / 4);
  const acts = [];
  for (let i = 0; i < 4; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, lines.length);
    if (start < lines.length) {
      acts.push(lines.slice(start, end));
    }
  }
  // Ensure exactly 4 acts
  while (acts.length < 4) acts.push(acts[acts.length - 1] || ['']);
  return acts.slice(0, 4);
}

function pickEvenlySpaced(arr, count) {
  if (arr.length <= count) return arr.slice(0, count);
  const step = arr.length / count;
  const result = [];
  for (let i = 0; i < count; i++) {
    result.push(arr[Math.round(i * step)]);
  }
  return result;
}

function splitAtIndices(lines, indices) {
  const sorted = [...indices].sort((a, b) => a - b);
  const acts = [];
  let prev = 0;
  for (const idx of sorted) {
    acts.push(lines.slice(prev, idx));
    prev = idx;
  }
  acts.push(lines.slice(prev));
  return acts;
}

/**
 * Separate dialogue lines from narration
 */
function extractDialogueAndNarration(lines) {
  const dialogues = [];
  const narration = [];
  for (const line of lines) {
    if (/^[A-Za-z\s]+[:：]/.test(line)) {
      const speaker = line.match(/^([A-Za-z\s]+)[:：]/)[1].trim();
      const text = line.replace(/^[A-Za-z\s]+[:：]\s*/, '').replace(/["""'']/g, '').trim();
      if (text) dialogues.push({ speaker, text });
    } else {
      narration.push(line);
    }
  }
  return { dialogues, narration };
}

/**
 * Extract 2-3 meaningful keywords from act lines
 * Focuses on concrete nouns, action verbs, and adjectives at A1-A2 level
 */
function extractKeywords(lines, maxCount) {
  const allText = lines.join(' ');
  // Remove speaker labels
  const cleaned = allText.replace(/[A-Za-z\s]+[:：]/g, ' ').replace(/["""''.,!?;:()\[\]]/g, ' ');
  const words = cleaned.split(/\s+/).filter(Boolean);

  // Count word frequency, excluding stop words
  const freq = {};
  for (const raw of words) {
    const w = raw.toLowerCase();
    if (w.length < 3 || STOP_WORDS.has(w) || /^\d+$/.test(w)) continue;
    // Normalize simple plurals/verb forms
    const base = w.replace(/(ing|ed|s)$/, '');
    if (base.length < 3) continue;
    const key = w; // keep original form for display
    freq[key] = (freq[key] || 0) + 1;
  }

  // Sort by frequency, then by length (prefer more descriptive words)
  const sorted = Object.entries(freq)
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length);

  // Deduplicate stems
  const selected = [];
  const usedStems = new Set();
  for (const [word] of sorted) {
    const stem = word.toLowerCase().replace(/(ing|ed|s|ly)$/, '');
    if (usedStems.has(stem)) continue;
    usedStems.add(stem);
    selected.push(word);
    if (selected.length >= maxCount) break;
  }

  return selected;
}

/**
 * Generate 1-2 simple A1-A2 target sentences that describe what's visible in a screenshot
 */
function generateTargetSentences(lines, dialogues, narration, structure, keywords) {
  const sentences = [];

  // Strategy 1: Simplify narration lines into A1-A2 sentences
  for (const line of narration) {
    const simplified = simplifyToA1(line);
    if (simplified && simplified.split(/\s+/).length >= 4 && simplified.split(/\s+/).length <= 15) {
      sentences.push(capitalizeFirst(simplified));
      if (sentences.length >= 2) break;
    }
  }

  // Strategy 2: If not enough from narration, convert key dialogue into reported speech
  if (sentences.length < 1 && dialogues.length > 0) {
    for (const d of dialogues) {
      const reported = dialogueToDescription(d);
      if (reported) {
        sentences.push(capitalizeFirst(reported));
        if (sentences.length >= 2) break;
      }
    }
  }

  // Strategy 3: Construct from keywords if still not enough
  if (sentences.length < 1 && keywords.length > 0) {
    const constructed = constructFromKeywords(keywords, structure);
    sentences.push(constructed);
  }

  // Ensure at least 1 sentence
  if (sentences.length === 0) {
    sentences.push(`This is the ${structure.label.toLowerCase()} of the story.`);
  }

  return sentences.slice(0, 2);
}

/**
 * Simplify a line to A1-A2 level
 */
function simplifyToA1(line) {
  let s = line.trim();
  // Remove stage directions [...]
  s = s.replace(/\[.*?\]/g, '').trim();
  // Remove quotes
  s = s.replace(/["""'']/g, '').trim();
  // Skip very short or very long
  if (s.length < 10 || s.length > 120) return null;
  // Skip lines that are just speaker labels
  if (/^[A-Za-z\s]+[:：]$/.test(s)) return null;
  // Remove speaker label if present
  s = s.replace(/^[A-Za-z\s]+[:：]\s*/, '');
  // Ensure it ends with punctuation
  if (!/[.!?]$/.test(s)) s += '.';
  return s;
}

/**
 * Convert dialogue to a descriptive sentence
 * e.g. { speaker: "Peppa", text: "I love riding my bicycle!" }
 * → "Peppa loves riding her bicycle."
 */
function dialogueToDescription(d) {
  const speaker = d.speaker;
  let text = d.text.replace(/[!?]+$/, '.').replace(/\.+$/, '.');

  // Simple first-person → third-person conversion
  text = text
    .replace(/\bI am\b/gi, `${speaker} is`)
    .replace(/\bI'm\b/gi, `${speaker} is`)
    .replace(/\bI have\b/gi, `${speaker} has`)
    .replace(/\bI've\b/gi, `${speaker} has`)
    .replace(/\bI can\b/gi, `${speaker} can`)
    .replace(/\bI want\b/gi, `${speaker} wants`)
    .replace(/\bI like\b/gi, `${speaker} likes`)
    .replace(/\bI love\b/gi, `${speaker} loves`)
    .replace(/\bI need\b/gi, `${speaker} needs`)
    .replace(/\bI\b/g, speaker)
    .replace(/\bmy\b/gi, `${speaker}'s`)
    .replace(/\bme\b/gi, speaker);

  // Skip if too short
  if (text.split(/\s+/).length < 4) return null;
  return text;
}

/**
 * Construct a sentence from keywords and story structure
 */
function constructFromKeywords(keywords, structure) {
  const kw = keywords.slice(0, 3);
  const templates = {
    'Setting': [
      `The story is about ${kw.join(' and ')}.`,
      `Peppa and her friends are with ${kw[0]}.`,
    ],
    'Beginning': [
      `They start to ${kw[0]}.`,
      `Peppa wants to ${kw[0]}.`,
    ],
    'Middle': [
      `They ${kw[0]} together.`,
      `Something happens with the ${kw[0]}.`,
    ],
    'Ending': [
      `Everyone is happy about the ${kw[0]}.`,
      `They all ${kw[0]} in the end.`,
    ],
  };
  const options = templates[structure.label] || [`They ${kw[0]}.`];
  return options[0];
}

/**
 * Generate a screenshot description for the scene
 */
function generateScreenshotDesc(lines, structure) {
  const { narration } = extractDialogueAndNarration(lines);
  if (narration.length > 0) {
    const desc = narration[0].replace(/\[.*?\]/g, '').trim();
    if (desc.length > 10) return desc.substring(0, 100);
  }
  return `Screenshot for the ${structure.label.toLowerCase()} scene`;
}

function capitalizeFirst(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ============================================================
// Scene Card Rendering (supports multiple target sentences)
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

        <!-- Target Sentences (1-2) -->
        <div class="target-sentences-area">
          ${scene.targetSentences.map((sent, si) => `
            <div class="target-sentence-area" style="margin-bottom:0.75rem;">
              <div class="area-label">Target Sentence ${si + 1} (A1-A2)</div>
              <input type="text" class="target-edit-input" data-idx="${idx}" data-sent="${si}" value="${escAttr(sent)}" aria-label="Edit target sentence ${si + 1} for ${escHtml(scene.title)}">
              <div class="hint">Click a word to toggle blank (masked words shown in blue).${scene.targetSentences.length > 1 ? ` <span class="remove-sent-btn" data-idx="${idx}" data-sent="${si}" style="color:var(--danger);cursor:pointer;font-style:normal;">✕ Remove</span>` : ''}</div>
              <div class="word-tokens" id="tokens-${idx}-${si}">
                ${(scene.sentenceWords[si] || []).map((w, wi) => `
                  <span class="word-token ${(scene.sentenceMasks[si] || []).includes(wi) ? 'masked' : ''}"
                        data-scene="${idx}" data-sent="${si}" data-word="${wi}"
                        role="button" tabindex="0"
                        aria-pressed="${(scene.sentenceMasks[si] || []).includes(wi)}"
                        aria-label="Toggle blank for word ${escHtml(w)}">${escHtml(w)}</span>
                `).join('')}
              </div>
            </div>
          `).join('')}
          ${scene.targetSentences.length < 2 ? `<button class="btn-secondary btn-add-sentence" data-idx="${idx}">+ Add Target Sentence</button>` : ''}
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

  // Word token click (toggle mask) — now with sentence index
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
      state.scenes[idx].targetSentences[si] = e.target.value;
      state.scenes[idx].sentenceWords[si] = tokenize(e.target.value);
      state.scenes[idx].sentenceMasks[si] = [];
      renderSceneCards();
    });
  });

  // Add target sentence
  document.querySelectorAll('.btn-add-sentence').forEach(btn => {
    btn.addEventListener('click', e => {
      const idx = +e.target.dataset.idx;
      const scene = state.scenes[idx];
      scene.targetSentences.push('New target sentence.');
      scene.sentenceWords.push(tokenize('New target sentence.'));
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

  // Delete scene
  document.querySelectorAll('.btn-delete-scene').forEach(btn => {
    btn.addEventListener('click', e => {
      const idx = +e.target.dataset.idx;
      state.scenes.splice(idx, 1);
      state.scenes.forEach((s, i) => { s.index = i; });
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
// Export — updated for multiple sentences
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
    version: '2.0',
    exportedAt: new Date().toISOString(),
    scenes: state.scenes.map(s => ({
      title: s.title,
      screenshotDesc: s.screenshotDesc,
      keywords: s.keywords,
      connector: s.connector,
      targetSentences: s.targetSentences.map((sent, si) => ({
        text: sent,
        words: s.sentenceWords[si],
        maskedWords: (s.sentenceMasks[si] || []).map(i => ({
          index: i,
          word: (s.sentenceWords[si] || [])[i],
          is_masked: true,
        })),
      })),
      // Legacy compat: first sentence as targetSentence
      targetSentence: s.targetSentences[0] || '',
      words: s.sentenceWords[0] || [],
      maskedWords: (s.sentenceMasks[0] || []).map(i => ({
        index: i,
        word: (s.sentenceWords[0] || [])[i],
        is_masked: true,
      })),
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
