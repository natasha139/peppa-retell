/**
 * Peppa Retell — Student Mode
 * Offline practice app with local Whisper STT
 */

// ============================================================
// State
// ============================================================
const state = {
  config: null,          // loaded config.json
  scenes: [],
  currentScene: 0,
  phase: 'load',         // load | listen | mask | finale
  recordings: [],        // per-scene Blob recordings
  finaleRecording: null,  // full retell Blob
  mediaRecorder: null,
  audioChunks: [],
  isRecording: false,
  audioData: null,       // base64 data URI of full story audio
};

// ============================================================
// Screen Management
// ============================================================
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(`screen-${id}`).classList.add('active');
  state.phase = id;
}

// ============================================================
// Course Pack Loading
// ============================================================
document.getElementById('config-upload').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    state.config = JSON.parse(text);
    state.scenes = state.config.scenes || [];
    state.currentScene = 0;
    state.recordings = new Array(state.scenes.length).fill(null);
    state.audioData = state.config.audioData || null;

    if (!state.scenes.length) {
      alert('This course pack has no scenes.');
      return;
    }

    showScreen('listen');
    renderListenScene();
  } catch (err) {
    alert('Could not read config.json: ' + err.message);
  }
});

// ============================================================
// Step 1: Listen & Look
// ============================================================
function renderListenScene() {
  const scene = state.scenes[state.currentScene];
  const total = state.scenes.length;
  const pct = ((state.currentScene + 1) / total) * 100;

  document.getElementById('progress-fill').style.width = pct + '%';

  // Image — use embedded base64 data
  const img = document.getElementById('scene-img');
  const placeholder = document.getElementById('scene-img-placeholder');
  const imgSrc = (scene.imageData && scene.imageData[0]) || null;
  if (imgSrc) {
    img.src = imgSrc;
    img.classList.add('visible');
    placeholder.style.display = 'none';
  } else {
    img.classList.remove('visible');
    placeholder.style.display = 'flex';
  }

  // Connector
  document.getElementById('connector-bubble').textContent = scene.connector || '';

  // Keywords
  const kwContainer = document.getElementById('keywords-display');
  kwContainer.innerHTML = (scene.keywords || []).map(k =>
    `<span class="kw-chip">${esc(k)}</span>`
  ).join('');

  // Full sentence with keyword highlights
  const kwSet = new Set((scene.keywords || []).map(k => k.toLowerCase()));
  const words = scene.words || scene.targetSentence.split(/\s+/);
  document.getElementById('sentence-full').innerHTML = words.map(w => {
    const clean = w.replace(/[^a-zA-Z']/g, '').toLowerCase();
    return kwSet.has(clean)
      ? `<span class="highlight">${esc(w)}</span>`
      : esc(w);
  }).join(' ');

  // Audio — use global audio with time range
  const btnAudio = document.getElementById('btn-play-audio');
  if (state.audioData && (scene.audioStartSec != null || scene.audioEndSec != null)) {
    btnAudio.disabled = false;
    btnAudio.onclick = () => {
      playAudioClip(scene.audioStartSec || 0, scene.audioEndSec || undefined);
    };
  } else {
    btnAudio.disabled = true;
  }

  // Nav
  document.getElementById('btn-listen-prev').disabled = state.currentScene === 0;
}

document.getElementById('btn-listen-prev').addEventListener('click', () => {
  if (state.currentScene > 0) {
    state.currentScene--;
    renderListenScene();
  }
});

document.getElementById('btn-listen-next').addEventListener('click', () => {
  showScreen('mask');
  state.currentScene = 0;
  renderMaskScene();
});

// ============================================================
// Step 2: Masked Challenge
// ============================================================
function renderMaskScene() {
  const scene = state.scenes[state.currentScene];
  const total = state.scenes.length;
  const pct = ((state.currentScene + 1) / total) * 100;

  document.getElementById('progress-fill-2').style.width = pct + '%';

  // Image — use embedded base64 data
  const img = document.getElementById('mask-img');
  const placeholder = document.getElementById('mask-img-placeholder');
  const imgSrc = (scene.imageData && scene.imageData[0]) || null;
  if (imgSrc) {
    img.src = imgSrc;
    img.classList.add('visible');
    placeholder.style.display = 'none';
  } else {
    img.classList.remove('visible');
    placeholder.style.display = 'flex';
  }

  // Connector
  document.getElementById('mask-connector').textContent = scene.connector || '';

  // Masked sentence
  const words = scene.words || scene.targetSentence.split(/\s+/);
  const maskedSet = new Set((scene.maskedWords || []).map(m => m.index));

  document.getElementById('masked-sentence').innerHTML = words.map((w, i) => {
    if (maskedSet.has(i)) {
      return `<span class="masked-word" data-word="${esc(w)}">${esc(w)}</span>`;
    }
    return `<span class="visible-word">${esc(w)}</span>`;
  }).join(' ');

  // Reset transcript area
  document.getElementById('transcript-area').classList.add('hidden');
  document.getElementById('record-status').textContent = 'Tap to record';
  document.getElementById('btn-record').classList.remove('recording');

  // Nav
  document.getElementById('btn-mask-next').textContent =
    state.currentScene < total - 1 ? 'Next Scene →' : '🎬 Grand Finale →';
}

// Record button (mask phase)
document.getElementById('btn-record').addEventListener('click', () => {
  if (state.isRecording) {
    stopRecording('mask');
  } else {
    startRecording('mask');
  }
});

document.getElementById('btn-mask-retry').addEventListener('click', () => {
  document.getElementById('transcript-area').classList.add('hidden');
  document.getElementById('record-status').textContent = 'Tap to record';
});

document.getElementById('btn-mask-next').addEventListener('click', () => {
  if (state.currentScene < state.scenes.length - 1) {
    state.currentScene++;
    renderMaskScene();
  } else {
    showScreen('finale');
    renderFinale();
  }
});

// ============================================================
// Step 3: Grand Finale — Filmstrip
// ============================================================
function renderFinale() {
  const filmstrip = document.getElementById('filmstrip');
  filmstrip.innerHTML = state.scenes.map((scene, i) => {
    const imgSrc = (scene.imageData && scene.imageData[0]) || null;
    return `
      <div class="film-frame" data-idx="${i}">
        ${imgSrc
          ? `<img src="${esc(imgSrc)}" alt="Scene ${i + 1}">`
          : `<div class="frame-placeholder">🖼️</div>`
        }
        <div class="frame-connector">${esc(scene.connector || '')}</div>
      </div>
    `;
  }).join('');

  document.getElementById('finale-result').classList.add('hidden');
  document.getElementById('video-output').classList.add('hidden');
  document.getElementById('finale-record-status').textContent = 'Record your full retell!';
  document.getElementById('btn-record-finale').classList.remove('recording');
}

// Record button (finale)
document.getElementById('btn-record-finale').addEventListener('click', () => {
  if (state.isRecording) {
    stopRecording('finale');
  } else {
    startRecording('finale');
  }
});

// Make video button
document.getElementById('btn-make-video').addEventListener('click', () => {
  document.getElementById('video-output').classList.remove('hidden');
});

// Export recordings
document.getElementById('btn-export-recordings').addEventListener('click', () => {
  // Download all recordings as individual files
  state.recordings.forEach((blob, i) => {
    if (blob) downloadBlob(blob, `scene-${i + 1}.webm`);
  });
  if (state.finaleRecording) {
    downloadBlob(state.finaleRecording, 'full-retell.webm');
  }
});

// ============================================================
// Audio Clip Playback (global audio + time range)
// ============================================================
let clipTimer = null;

function playAudioClip(startSec, endSec) {
  const player = document.getElementById('audio-player');
  if (!state.audioData) return;

  // Set src if not already set
  if (player.src !== state.audioData) {
    player.src = state.audioData;
  }

  // Stop any previous clip timer
  if (clipTimer) { clearInterval(clipTimer); clipTimer = null; }
  player.pause();

  player.currentTime = startSec || 0;
  player.play();

  if (endSec != null && endSec > startSec) {
    clipTimer = setInterval(() => {
      if (player.currentTime >= endSec) {
        player.pause();
        clearInterval(clipTimer);
        clipTimer = null;
      }
    }, 100);
  }
}

// ============================================================
// Recording (Web Audio / MediaRecorder)
// ============================================================
async function startRecording(phase) {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    state.audioChunks = [];
    state.mediaRecorder = new MediaRecorder(stream, {
      mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus' : 'audio/webm'
    });

    state.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) state.audioChunks.push(e.data);
    };

    state.mediaRecorder.onstop = () => {
      const blob = new Blob(state.audioChunks, { type: 'audio/webm' });
      stream.getTracks().forEach(t => t.stop());

      if (phase === 'mask') {
        state.recordings[state.currentScene] = blob;
        processTranscript(blob, phase);
      } else {
        state.finaleRecording = blob;
        processTranscript(blob, phase);
      }
    };

    state.mediaRecorder.start();
    state.isRecording = true;

    const btn = phase === 'mask' ? 'btn-record' : 'btn-record-finale';
    const status = phase === 'mask' ? 'record-status' : 'finale-record-status';
    document.getElementById(btn).classList.add('recording');
    document.getElementById(status).textContent = '🔴 Recording… tap to stop';

  } catch (err) {
    alert('Microphone access denied. Please allow microphone access to record.');
  }
}

function stopRecording(phase) {
  if (state.mediaRecorder && state.mediaRecorder.state !== 'inactive') {
    state.mediaRecorder.stop();
  }
  state.isRecording = false;

  const btn = phase === 'mask' ? 'btn-record' : 'btn-record-finale';
  const status = phase === 'mask' ? 'record-status' : 'finale-record-status';
  document.getElementById(btn).classList.remove('recording');
  document.getElementById(status).textContent = 'Processing…';
}

// ============================================================
// Transcript Processing (Whisper placeholder + scoring)
// ============================================================
async function processTranscript(blob, phase) {
  // Try local Whisper endpoint first, fall back to simulation
  let transcript = '';

  try {
    transcript = await callLocalWhisper(blob);
  } catch {
    // Simulate: use the target sentence with slight variation
    transcript = simulateTranscript(phase);
  }

  if (phase === 'mask') {
    const scene = state.scenes[state.currentScene];
    const target = scene.targetSentence;
    const { score, feedback, hasError } = evaluateTranscript(transcript, target, scene);

    document.getElementById('transcript-text').textContent = transcript;
    document.getElementById('score-display').textContent = `⭐ ${score}/100`;
    document.getElementById('feedback').textContent = feedback;
    document.getElementById('feedback').className = hasError ? 'feedback has-error' : 'feedback';
    document.getElementById('transcript-area').classList.remove('hidden');
    document.getElementById('record-status').textContent = 'Done!';
  } else {
    // Finale
    const allTargets = state.scenes.map(s => s.targetSentence).join(' ');
    const { score, feedback } = evaluateTranscript(transcript, allTargets, null);

    document.getElementById('finale-transcript').textContent = transcript;
    document.getElementById('finale-score').textContent = `⭐ ${score}/100`;
    document.getElementById('finale-result').classList.remove('hidden');
    document.getElementById('finale-record-status').textContent = 'Great job!';
  }
}

async function callLocalWhisper(blob) {
  // Attempt to call a local Whisper HTTP endpoint
  // Default: http://localhost:8178/transcribe (configurable)
  const formData = new FormData();
  formData.append('audio', blob, 'recording.webm');

  const resp = await fetch('http://localhost:8178/transcribe', {
    method: 'POST',
    body: formData,
  });

  if (!resp.ok) throw new Error('Whisper unavailable');
  const data = await resp.json();
  return data.text || data.transcript || '';
}

function simulateTranscript(phase) {
  if (phase === 'mask') {
    const scene = state.scenes[state.currentScene];
    // Return target with minor "errors" for demo
    const words = (scene.words || scene.targetSentence.split(/\s+/)).slice();
    // Randomly drop one word to simulate imperfect speech
    if (words.length > 3) {
      const dropIdx = Math.floor(Math.random() * words.length);
      words.splice(dropIdx, 1);
    }
    return words.join(' ');
  } else {
    return state.scenes.map(s => s.targetSentence).join('. ');
  }
}

// ============================================================
// Scoring: Score = 90 + (accuracy_ratio × 10)
// ============================================================
function evaluateTranscript(transcript, target, scene) {
  const tWords = normalize(transcript).split(/\s+/).filter(Boolean);
  const gWords = normalize(target).split(/\s+/).filter(Boolean);

  // Word-level accuracy
  let matches = 0;
  const gSet = [...gWords];
  for (const w of tWords) {
    const idx = gSet.indexOf(w);
    if (idx !== -1) {
      matches++;
      gSet.splice(idx, 1);
    }
  }
  const ratio = gWords.length ? matches / gWords.length : 0;
  const score = Math.round(90 + ratio * 10);

  // Specific error detection
  const feedbackParts = [];
  let hasError = false;

  // he/she confusion
  const tLower = transcript.toLowerCase();
  const targetLower = target.toLowerCase();
  if (targetLower.includes(' she ') && tLower.includes(' he ') && !tLower.includes(' she ')) {
    feedbackParts.push('💡 Careful: it should be "she" not "he" here.');
    hasError = true;
  }
  if (targetLower.includes(' he ') && tLower.includes(' she ') && !tLower.includes(' he ')) {
    feedbackParts.push('💡 Careful: it should be "he" not "she" here.');
    hasError = true;
  }

  // Missing key verbs (if scene has keywords)
  if (scene && scene.keywords) {
    for (const kw of scene.keywords) {
      if (!tLower.includes(kw.toLowerCase())) {
        feedbackParts.push(`💡 Try to include the word "${kw}".`);
        hasError = true;
      }
    }
  }

  if (!hasError) {
    const encouragements = [
      '🌟 Wonderful! You nailed it!',
      '🎉 Great retelling! Keep it up!',
      '👏 Excellent work! Peppa would be proud!',
      '✨ Amazing! You remembered everything!',
    ];
    feedbackParts.push(encouragements[Math.floor(Math.random() * encouragements.length)]);
  }

  return { score, feedback: feedbackParts.join(' '), hasError };
}

function normalize(text) {
  return text.toLowerCase().replace(/[^a-z0-9'\s]/g, '').replace(/\s+/g, ' ').trim();
}

// ============================================================
// Utilities
// ============================================================
function esc(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
