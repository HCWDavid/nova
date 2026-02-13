/**
 * NOVA v0.2 - Nursing Operational View of Actions
 * Multi-Modal Video Annotation Tool
 * 
 * Phase 1: Multi-Video Support
 * Phase 3: Overlay Modalities (Gaze, Heatmap)
 * TODO: 
 * - scoping into two minuates from 15 mins
 * - change layers => tracks
 * - mechanism: refresh page prevention while its not 'exported' 
 * - input an input field for the time unit consistent throughout the session
 * - use this time unit to range in or range out the video range for more focused analysis. 
 * FIXED:
 * 02/10/2026
 * - [x] adding a new layer didn't work with the new layer annotation (v0.2.1 - initialized annotations array for new layers)
 * - [x] having only 'start-end' button for 1 frame instead of two buttons (like a button call "mark this frame" or something)
 * 02/13/2026 (1):
 * - [x] gaze potentially wrong with resizing browser or h*w
 * - [x] add fixation processing instead of raw data
 * - [x] add temporal sync for gaze data
 * 
 * 02/13/2026 (2):
 * - [x] add transcript
 * 
 * 02/13/2026 (3):
 * - [x] add mute button
 * - [x] add volume control
 * - [x] add comments on annotations
 * - [x] add editable timestamp/label on annotations (inline edit form)
 * - [x] add export annotations to CSV
 * - [x] add import annotations from CSV
 * - [x] add import annotations from JSON (header Import button)
 * - [x] add layers import/export in Settings
 * - [x] add export annotations name to JSON
 * - [x] forward/backward to 5 second
 * - [x] annotation list is not layout properly
 * 
 * Question: 
 * - why dont u use this app or feature that are lacking? 
 * - layer-view vs label-view? 
 * - exclusive vs inclusive? 
 * - discrete or just comment? 
 * 
 * fantasy:
 * - 
 */

// ============================================
// Default Configurations
// ============================================

// DEFAULT_LAYERS is loaded from config/default-layers.json at startup.
// This inline fallback is used only if the fetch fails.
let DEFAULT_LAYERS = [
    { id: 'behavior', name: 'Behaviors', shortcut: 'b', color: '#FF6B6B', types: [
        { id: 1, name: 'Introduction/Identification', color: '#FF6B6B' },
        { id: 2, name: 'Assessment', color: '#4ECDC4' },
        { id: 3, name: 'Med Administration', color: '#45B7D1' },
    ]},
    { id: 'action', name: 'Actions', shortcut: 'a', color: '#74b9ff', types: [
        { id: 1, name: 'Perform Hand Hygiene', color: '#a29bfe' },
        { id: 2, name: 'Put on Gloves', color: '#fd79a8' },
        { id: 3, name: 'Check Patient Wristband', color: '#e17055' },
        { id: 4, name: 'Check Patient History Screen', color: '#00cec9' },
        { id: 5, name: 'Examine Med Bottle', color: '#6c5ce7' },
        { id: 6, name: 'Review Vital Signs Screen', color: '#fdcb6e' },
        { id: 7, name: 'Assess Vital Signs (Palpate Wrist)', color: '#e84393' },
        { id: 8, name: 'Auscultate Lung Sounds', color: '#0984e3' },
        { id: 9, name: 'Measure Apical Pulse', color: '#2d98da' },
        { id: 10, name: 'Measure Temperature', color: '#d63031' },
        { id: 11, name: 'Measure Blood Pressure', color: '#55a3ff' },
        { id: 12, name: 'Writing', color: '#81ecec' },
        { id: 13, name: 'Use Calculator', color: '#fab1a0' },
        { id: 14, name: 'Check Phone', color: '#ffeaa7' },
        { id: 15, name: 'Prepare Medication', color: '#74b9ff' },
        { id: 16, name: 'Apply Medication to Patient', color: '#a29bfe' },
    ]},
    { id: 'comm', name: 'Communication', shortcut: 'c', color: '#4285F4', types: [
        { id: 1, name: 'Patient', color: '#4285F4' },
        { id: 2, name: 'Family', color: '#34A853' },
        { id: 3, name: 'Provider', color: '#FBBC05' },
    ]}
];

// Load layers from external config (overrides fallback above)
async function loadDefaultLayers() {
    try {
        const resp = await fetch('config/default-layers.json');
        if (resp.ok) {
            DEFAULT_LAYERS = await resp.json();
            console.log('✅ Loaded default layers from config/default-layers.json');
        }
    } catch (e) {
        console.warn('⚠️ Could not load config/default-layers.json, using inline fallback');
    }
}

// ============================================
// Application State
// ============================================

const state = {
    // Annotation Layers
    layers: [],
    activeLayerId: null,
    selectedType: null,
    pendingStart: null,
    annotations: {},
    
    // Modalities (videos, overlays)
    modalities: [],
    masterModalityId: null,
    
    // Playback
    duration: 0,
    currentTime: 0,
    isPlaying: false,
    fps: 30,
    
    // Metadata
    annotatorName: '',
    
    // UI State
    settingsOpen: false,
    settingsTab: 'layers',
    
    // Pin Mode
    annotationMode: 'range', // 'range' | 'pin'
    pinWindowValue: 1,
    pinWindowUnit: 'frames', // 'frames' | 'seconds' | 'ms'
    
    // Gaze Processing
    gazeConfig: {
        filter: 'moving-average',   // 'none' | 'moving-average' | 'median'
        filterWindow: 5,
        fixationAlgo: 'ivt',        // 'none' | 'idt' | 'ivt'
        idtDispersion: 0.03,        // normalized units
        idtMinDuration: 100,        // ms
        ivtThreshold: 0.5,          // normalized units per second
        showRawGaze: false,
        showFixations: true,
        fixationSizeMode: 'proportional', // 'fixed' | 'proportional'
    },
    
    // Transcript
    transcript: null,
    exportSourcePath: '',
};

// ============================================
// Modality Factory
// ============================================

function createVideoModality(file) {
    return {
        id: 'video_' + Date.now(),
        type: 'video',
        name: file.name.replace(/\.[^.]+$/, ''),
        file: file,
        url: URL.createObjectURL(file),
        offsetMs: 0,
        fps: 30,
        duration: 0,
        visible: true,
        isMaster: state.modalities.filter(m => m.type === 'video').length === 0,
        overlays: [], // IDs of overlay modalities attached to this video
    };
}

function createOverlayModality(type, parentVideoId, file) {
    return {
        id: 'overlay_' + Date.now(),
        type: type, // 'overlay-gaze', 'overlay-heatmap', 'overlay-pose', 'overlay-bbox'
        name: type.replace('overlay-', '').charAt(0).toUpperCase() + type.slice(9),
        parentVideoId: parentVideoId,
        file: file,
        data: null, // Parsed data
        offsetMs: 0,
        sampleRateHz: 120,
        visible: true,
        
        // Data mapping
        timestampColumn: 0,
        timestampUnit: 'ms',
        
        // Gaze-specific
        gazeXColumn: 1,
        gazeYColumn: 2,
        coordinateSystem: 'normalized', // 'normalized' | 'pixel'
        
        // Appearance
        color: '#FF0000',
        opacity: 0.8,
        dotSize: 20,
        trailLength: 5,
    };
}

// ============================================
// Initialization
// ============================================

async function init() {
    await loadDefaultLayers();
    loadState();
    setupEventListeners();
    renderAll();
}

function loadState() {
    // Load layers
    const savedLayers = localStorage.getItem('nova_layers');
    state.layers = savedLayers ? JSON.parse(savedLayers) : JSON.parse(JSON.stringify(DEFAULT_LAYERS));
    
    state.layers.forEach(layer => {
        if (!state.annotations[layer.id]) {
            state.annotations[layer.id] = [];
        }
    });
    
    if (state.layers.length > 0) {
        state.activeLayerId = state.layers[0].id;
    }
    
    // Load annotator name
    state.annotatorName = localStorage.getItem('nova_annotator_name') || '';
    const nameInput = document.getElementById('annotator-name');
    if (nameInput) nameInput.value = state.annotatorName;
    
    // Load Pin Mode settings
    state.pinWindowValue = parseFloat(localStorage.getItem('nova_pin_window_value')) || 1;
    state.pinWindowUnit = localStorage.getItem('nova_pin_window_unit') || 'frames';
    
    // Sync UI with loaded settings
    const windowValueInput = document.getElementById('pin-window-value');
    const windowUnitSelect = document.getElementById('pin-window-unit');
    if (windowValueInput) windowValueInput.value = state.pinWindowValue;
    if (windowUnitSelect) windowUnitSelect.value = state.pinWindowUnit;
}

function saveLayers() {
    localStorage.setItem('nova_layers', JSON.stringify(state.layers));
}

// ============================================
// Event Listeners
// ============================================

function setupEventListeners() {
    // Settings
    document.getElementById('settings-btn')?.addEventListener('click', openSettings);
    document.getElementById('settings-close')?.addEventListener('click', closeSettings);
    document.getElementById('settings-modal')?.addEventListener('click', (e) => {
        if (e.target.id === 'settings-modal') closeSettings();
    });
    
    // Settings tabs
    document.querySelectorAll('.settings-tab').forEach(tab => {
        tab.addEventListener('click', () => switchSettingsTab(tab.dataset.tab));
    });
    
    // Add modality (unified button)
    document.getElementById('add-modality-btn')?.addEventListener('click', () => {
        document.getElementById('add-modality-input')?.click();
    });
    document.getElementById('add-modality-input')?.addEventListener('change', handleAddModality);
    
    // Layer management
    document.getElementById('add-layer-btn')?.addEventListener('click', handleAddLayer);
    document.getElementById('reset-layers-btn')?.addEventListener('click', () => {
        if (confirm('Reset layers to defaults?')) {
            state.layers = JSON.parse(JSON.stringify(DEFAULT_LAYERS));
            saveLayers();
            renderAll();
        }
    });
    
    // Resize mode
    document.getElementById('toggle-resize-mode')?.addEventListener('click', enterResizeMode);
    document.getElementById('exit-resize-mode')?.addEventListener('click', exitResizeMode);
    document.getElementById('floating-exit-resize')?.addEventListener('click', exitResizeMode);
    
    // Data type picker
    document.querySelectorAll('#data-type-picker .picker-option').forEach(btn => {
        btn.addEventListener('click', () => handleDataTypeSelection(btn.dataset.type));
    });
    document.getElementById('picker-cancel')?.addEventListener('click', hideDataTypePicker);
    document.getElementById('video-picker-cancel')?.addEventListener('click', hideVideoPicker);
    
    // Playback
    document.getElementById('play-pause-btn')?.addEventListener('click', togglePlayPause);
    document.getElementById('frame-back-btn')?.addEventListener('click', () => stepTime(-5));
    document.getElementById('frame-forward-btn')?.addEventListener('click', () => stepTime(5));
    document.getElementById('playback-speed')?.addEventListener('change', handleSpeedChange);
    document.getElementById('seek-slider')?.addEventListener('input', handleSeek);
    
    // Annotation
    document.getElementById('start-annotation-btn')?.addEventListener('click', startAnnotation);
    document.getElementById('end-annotation-btn')?.addEventListener('click', endAnnotation);
    
    // Export & Import
    document.getElementById('export-btn')?.addEventListener('click', exportAnnotations);
    document.getElementById('import-btn')?.addEventListener('click', () => {
        document.getElementById('import-annotations-input')?.click();
    });
    document.getElementById('import-annotations-input')?.addEventListener('change', importAnnotationsJSON);
    document.getElementById('import-csv-input')?.addEventListener('change', importAnnotationsCSV);
    document.getElementById('import-layers-input')?.addEventListener('change', importLayersJSON);
    
    // Mute & Volume
    document.getElementById('mute-btn')?.addEventListener('click', toggleMute);
    document.getElementById('volume-slider')?.addEventListener('input', handleVolumeChange);
    
    // Annotator name
    document.getElementById('annotator-name')?.addEventListener('change', (e) => {
        state.annotatorName = e.target.value;
        localStorage.setItem('nova_annotator_name', e.target.value);
    });
    
    // Keyboard
    document.addEventListener('keydown', handleKeyPress);
    window.addEventListener('resize', () => {
        requestAnimationFrame(() => {
            renderTimelines();
            renderOverlays();
        });
    });
    
    // Pin Mode
    document.getElementById('annotation-mode-select')?.addEventListener('change', handleAnnotationModeChange);
    document.getElementById('pin-annotation-btn')?.addEventListener('click', pinAnnotation);
    document.getElementById('pin-window-value')?.addEventListener('change', (e) => {
        state.pinWindowValue = parseFloat(e.target.value) || 1;
        localStorage.setItem('nova_pin_window_value', state.pinWindowValue);
    });
    document.getElementById('pin-window-unit')?.addEventListener('change', (e) => {
        state.pinWindowUnit = e.target.value;
        localStorage.setItem('nova_pin_window_unit', state.pinWindowUnit);
    });
    
    // Panel resizer
    setupPanelResizer();
}

// ============================================
// Panel Resizer
// ============================================

function setupPanelResizer() {
    const resizer = document.getElementById('panel-resizer');
    const panel = document.querySelector('.annotation-panel');
    if (!resizer || !panel) return;
    
    let isResizing = false;
    let startX = 0;
    let startWidth = 0;
    
    // Load saved width
    const savedWidth = localStorage.getItem('nova_panel_width');
    if (savedWidth) {
        panel.style.width = savedWidth + 'px';
    }
    
    resizer.addEventListener('mousedown', (e) => {
        // Only allow resize when in resize mode
        if (!document.body.classList.contains('resize-mode')) return;
        
        isResizing = true;
        startX = e.clientX;
        startWidth = panel.offsetWidth;
        resizer.classList.add('dragging');
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        e.preventDefault();
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;
        
        const diff = startX - e.clientX;
        const newWidth = Math.min(600, Math.max(250, startWidth + diff));
        panel.style.width = newWidth + 'px';
    });
    
    document.addEventListener('mouseup', () => {
        if (isResizing) {
            isResizing = false;
            resizer.classList.remove('dragging');
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            
            // Save width
            localStorage.setItem('nova_panel_width', panel.offsetWidth);
            
            // Redraw timelines and overlays (gaze dot position depends on video display size)
            requestAnimationFrame(() => {
                renderTimelines();
                renderOverlays();
            });
        }
    });
    
    // Also setup horizontal resizer for annotations
    setupAnnotationsResizer();
}

function setupAnnotationsResizer() {
    const resizer = document.getElementById('annotations-resizer');
    const listContainer = document.querySelector('.annotations-list-container');
    if (!resizer || !listContainer) return;
    
    let isResizing = false;
    let startY = 0;
    let startHeight = 0;
    
    resizer.addEventListener('mousedown', (e) => {
        // Only allow resize when in resize mode
        if (!document.body.classList.contains('resize-mode')) return;
        
        isResizing = true;
        startY = e.clientY;
        startHeight = listContainer.offsetHeight;
        resizer.classList.add('dragging');
        document.body.style.cursor = 'row-resize';
        document.body.style.userSelect = 'none';
        e.preventDefault();
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;
        
        const diff = startY - e.clientY;
        const newHeight = Math.min(800, Math.max(200, startHeight + diff));
        listContainer.style.height = newHeight + 'px';
        listContainer.style.flex = 'none';
    });
    
    document.addEventListener('mouseup', () => {
        if (isResizing) {
            isResizing = false;
            resizer.classList.remove('dragging');
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            
            // Save height
            localStorage.setItem('nova_annotations_height', listContainer.offsetHeight);
        }
    });
}

function enterResizeMode() {
    document.body.classList.add('resize-mode');
    
    // Update UI
    const toggleBtn = document.getElementById('toggle-resize-mode');
    const exitBtn = document.getElementById('exit-resize-mode');
    const hint = document.getElementById('resize-hint');
    
    if (toggleBtn) toggleBtn.style.display = 'none';
    if (exitBtn) exitBtn.style.display = 'block';
    if (hint) hint.style.display = 'block';
    
    // Close settings modal so user can see the resizers
    closeSettings();
}

function exitResizeMode() {
    document.body.classList.remove('resize-mode');
    
    // Update UI
    const toggleBtn = document.getElementById('toggle-resize-mode');
    const exitBtn = document.getElementById('exit-resize-mode');
    const hint = document.getElementById('resize-hint');
    
    if (toggleBtn) toggleBtn.style.display = 'block';
    if (exitBtn) exitBtn.style.display = 'none';
    if (hint) hint.style.display = 'none';
    
    // Redraw timelines
    requestAnimationFrame(renderTimelines);
}

// ============================================
// Modality Management
// ============================================

function handleAddModality(e) {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    
    files.forEach(file => {
        const ext = file.name.split('.').pop().toLowerCase();
        const isVideo = ['mp4', 'mov', 'avi', 'webm', 'mkv', 'ogg'].includes(ext) || file.type.startsWith('video/');
        const isData = ['csv', 'tsv', 'txt', 'jsonl', 'json', 'gz'].includes(ext);
        
        if (isVideo) {
            // Auto-add video
            const modality = createVideoModality(file);
            state.modalities.push(modality);
            
            if (modality.isMaster) {
                state.masterModalityId = modality.id;
            }
            
            console.log(`Added video: ${file.name}`);
        } else if (isData) {
            // Data file - ask what type of overlay
            handleAddDataFile(file);
        } else {
            alert(`Unknown file type: ${file.name}`);
        }
    });
    
    renderModalities();
    renderSettings();
    e.target.value = '';
}

// Pending file for picker flow
let pendingDataFile = null;

function handleAddDataFile(file) {
    const videos = state.modalities.filter(m => m.type === 'video');
    
    if (videos.length === 0) {
        showNotification('Please add a video first, then add overlay data.');
        return;
    }
    
    // Check if this is a transcript JSON
    if (file.name.endsWith('.json')) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if (data.transcript && Array.isArray(data.transcript)) {
                    loadTranscript(data);
                    return;
                }
            } catch (err) {
                console.log('Not a transcript JSON, treating as data:', err);
            }
            // Not a transcript — fall through to data type picker
            pendingDataFile = { file, videos };
            showDataTypePicker(file.name);
        };
        reader.readAsText(file);
        return;
    }
    
    // Store file and show data type picker
    pendingDataFile = { file, videos };
    showDataTypePicker(file.name);
}

function showDataTypePicker(filename) {
    const picker = document.getElementById('data-type-picker');
    const filenameEl = document.getElementById('picker-filename');
    
    if (filenameEl) filenameEl.textContent = filename;
    if (picker) picker.classList.add('open');
}

function hideDataTypePicker() {
    const picker = document.getElementById('data-type-picker');
    if (picker) picker.classList.remove('open');
    pendingDataFile = null;
}

function handleDataTypeSelection(dataType) {
    if (!pendingDataFile) return;
    
    const { file, videos } = pendingDataFile;
    hideDataTypePicker();
    
    // IMU is standalone (not attached to video)
    if (dataType === 'timeseries-imu') {
        addTimeseriesModality(dataType, file);
        return;
    }
    
    // Overlays need a parent video
    if (videos.length === 1) {
        // Only one video, attach directly
        addOverlayModality(dataType, videos[0].id, file);
    } else if (videos.length > 1) {
        // Multiple videos, show video picker
        showVideoPicker(file, dataType, videos);
    } else {
        showNotification('Please add a video first for overlay data.');
    }
}

function showVideoPicker(file, overlayType, videos) {
    const picker = document.getElementById('video-picker');
    const optionsContainer = document.getElementById('video-picker-options');
    
    if (!picker || !optionsContainer) return;
    
    // Store for later
    pendingDataFile = { file, overlayType, videos };
    
    // Populate video options
    optionsContainer.innerHTML = '';
    videos.forEach((video, idx) => {
        const btn = document.createElement('button');
        btn.className = 'picker-option';
        btn.innerHTML = `<span>📹</span>${video.name}`;
        btn.onclick = () => handleVideoSelection(video.id);
        optionsContainer.appendChild(btn);
    });
    
    picker.classList.add('open');
}

function hideVideoPicker() {
    const picker = document.getElementById('video-picker');
    if (picker) picker.classList.remove('open');
}

function handleVideoSelection(videoId) {
    if (!pendingDataFile) return;
    
    const { file, overlayType } = pendingDataFile;
    hideVideoPicker();
    
    addOverlayModality(overlayType, videoId, file);
    pendingDataFile = null;
}

function showNotification(message) {
    // Simple alert fallback for now
    alert(message);
}

function handleAddVideo(e) {
    // Legacy function - kept for compatibility
    const file = e.target.files[0];
    if (!file) return;
    
    const modality = createVideoModality(file);
    state.modalities.push(modality);
    
    if (modality.isMaster) {
        state.masterModalityId = modality.id;
    }
    
    renderModalities();
    renderSettings();
    e.target.value = '';
}

function showAddOverlayMenu() {
    const videos = state.modalities.filter(m => m.type === 'video');
    if (videos.length === 0) {
        alert('Please add a video first before adding overlays.');
        return;
    }
    
    // Create overlay type menu
    const types = [
        { id: 'overlay-gaze', name: '👁 Gaze Overlay', icon: '👁' },
        { id: 'overlay-heatmap', name: '🔥 Heatmap Overlay', icon: '🔥' },
        { id: 'overlay-pose', name: '🦴 Pose Overlay', icon: '🦴' },
        { id: 'overlay-bbox', name: '📦 Bounding Box', icon: '📦' },
    ];
    
    const choice = prompt(
        'Select overlay type:\n' +
        types.map((t, i) => `${i + 1}. ${t.name}`).join('\n') +
        '\n\nEnter number (1-4):'
    );
    
    const typeIdx = parseInt(choice) - 1;
    if (isNaN(typeIdx) || typeIdx < 0 || typeIdx >= types.length) return;
    
    // Select parent video
    let parentVideoId;
    if (videos.length === 1) {
        parentVideoId = videos[0].id;
    } else {
        const videoChoice = prompt(
            'Select parent video:\n' +
            videos.map((v, i) => `${i + 1}. ${v.name}`).join('\n') +
            '\n\nEnter number:'
        );
        const videoIdx = parseInt(videoChoice) - 1;
        if (isNaN(videoIdx) || videoIdx < 0 || videoIdx >= videos.length) return;
        parentVideoId = videos[videoIdx].id;
    }
    
    // File input for overlay data
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,.tsv,.txt';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
            addOverlayModality(types[typeIdx].id, parentVideoId, file);
        }
    };
    input.click();
}

function addTimeseriesModality(type, file) {
    console.log(`Adding timeseries: type=${type}, file=${file.name}`);
    
    const modality = {
        id: 'timeseries_' + Date.now(),
        type: type,
        name: file.name.replace(/\.[^.]+$/, ''),
        file: file,
        data: null,
        offsetMs: 0,
        timestampUnit: 'ms',
        visible: true,
        color: '#00FF00',
    };
    
    const isGzipped = file.name.endsWith('.gz');
    const reader = new FileReader();
    
    reader.onload = (e) => {
        let text;
        
        if (isGzipped) {
            console.log('Decompressing gzip file...');
            try {
                const compressed = new Uint8Array(e.target.result);
                const decompressed = pako.inflate(compressed);
                text = new TextDecoder('utf-8').decode(decompressed);
                console.log(`Decompressed: ${text.length} chars`);
            } catch (err) {
                console.error('Gzip decompression failed:', err);
                return;
            }
        } else {
            text = e.target.result;
        }
        
        modality.data = parseIMUData(text, modality);
        console.log(`Parsed ${modality.data?.length || 0} IMU points`);
        
        state.modalities.push(modality);
        renderModalities();
        renderSettings();
    };
    
    if (isGzipped) {
        reader.readAsArrayBuffer(file);
    } else {
        reader.readAsText(file);
    }
}

function addOverlayModality(type, parentVideoId, file) {
    console.log(`Adding overlay: type=${type}, parent=${parentVideoId}, file=${file.name}`);
    const modality = createOverlayModality(type, parentVideoId, file);
    const isGzipped = file.name.endsWith('.gz');
    
    // Parse the file
    const reader = new FileReader();
    reader.onload = (e) => {
        let text;
        
        if (isGzipped) {
            // Decompress gzip
            console.log('Decompressing gzip file...');
            try {
                const compressed = new Uint8Array(e.target.result);
                const decompressed = pako.inflate(compressed);
                text = new TextDecoder('utf-8').decode(decompressed);
                console.log(`Decompressed: ${text.length} chars`);
            } catch (err) {
                console.error('Gzip decompression failed:', err);
                alert('Failed to decompress .gz file');
                return;
            }
        } else {
            text = e.target.result;
            console.log(`File loaded, size: ${text.length} chars`);
        }
        
        // Use smart parser based on type
        if (type === 'overlay-gaze' || type === 'overlay-heatmap') {
            modality.data = parseGazeData(text, modality);
            
            // Auto-sync: align timestamps heuristically
            const parent = state.modalities.find(m => m.id === parentVideoId);
            if (parent) {
                autoAlignGazeTimestamps(modality, parent);
            }
            
            processGazeData(modality);
            

        } else if (type === 'timeseries-imu') {
            modality.data = parseIMUData(text, modality);
        } else {
            modality.data = parseCSV(text);
        }
        
        console.log(`Parsed ${modality.data ? modality.data.length : 0} data points`);
        console.log('Sample data point:', modality.data?.[0]);
        
        state.modalities.push(modality);
        
        // Add to parent's overlay list
        const parent = state.modalities.find(m => m.id === parentVideoId);
        if (parent) {
            parent.overlays.push(modality.id);
            console.log(`Linked overlay ${modality.id} to parent ${parent.id}, overlays:`, parent.overlays);
        } else {
            console.error(`Parent video ${parentVideoId} not found!`);
        }
        
        console.log('All modalities:', state.modalities.map(m => ({ id: m.id, type: m.type, dataLen: m.data?.length })));
        
        renderModalities();
        renderSettings();
    };
    reader.onerror = (e) => {
        console.error('File read error:', e);
    };
    
    // Read as ArrayBuffer for gzip, as text for plain files
    if (isGzipped) {
        reader.readAsArrayBuffer(file);
    } else {
        reader.readAsText(file);
    }
}

function parseGazeData(text, modality) {
    const lines = text.trim().split('\n');
    const data = [];
    
    // Check if this is Tobii JSON Lines format
    const firstLine = lines[0].trim();
    if (firstLine.startsWith('{')) {
        // Tobii Pro Glasses 3 format: JSON Lines
        console.log('Detected Tobii Pro Glasses 3 gaze format');
        
        for (const line of lines) {
            try {
                const obj = JSON.parse(line);
                if (obj.type === 'gaze' && obj.data && obj.data.gaze2d) {
                    // timestamp is in seconds, gaze2d is [x, y] normalized 0-1
                    data.push({
                        timestamp: obj.timestamp, // Already in seconds
                        x: obj.data.gaze2d[0],
                        y: obj.data.gaze2d[1],
                        pupil: obj.data.eyeleft?.pupildiameter || obj.data.eyeright?.pupildiameter || 3
                    });
                }
            } catch (e) {
                // Skip invalid JSON lines
            }
        }
        
        // Set modality to Tobii mode
        modality.timestampUnit = 's';
        modality.dataFormat = 'tobii';
        modality.coordinateSystem = 'normalized';
        
        console.log(`Parsed ${data.length} Tobii gaze points`);
        return data;
    }
    
    // CSV/TSV format: columns for timestamp, x, y
    console.log('Parsing as CSV/TSV format');
    for (const line of lines) {
        const values = line.split(/[,\t]/).map(v => parseFloat(v.trim()));
        if (values.length >= 3 && values.every(v => !isNaN(v))) {
            data.push({
                timestamp: values[modality.timestampColumn || 0],
                x: values[modality.gazeXColumn || 1],
                y: values[modality.gazeYColumn || 2],
                pupil: values[3] || 3
            });
        }
    }
    
    console.log(`Parsed ${data.length} CSV gaze points`);
    return data;
}

// ============================================
// Gaze Processing Pipeline
// ============================================

function applyGazeFilter(rawData, config) {
    if (config.filter === 'none' || !rawData || rawData.length === 0) {
        return rawData.map(p => ({ ...p }));
    }
    
    const window = Math.max(1, config.filterWindow);
    const half = Math.floor(window / 2);
    const result = [];
    
    for (let i = 0; i < rawData.length; i++) {
        const start = Math.max(0, i - half);
        const end = Math.min(rawData.length - 1, i + half);
        const windowPoints = rawData.slice(start, end + 1);
        
        let x, y;
        if (config.filter === 'moving-average') {
            x = windowPoints.reduce((sum, p) => sum + p.x, 0) / windowPoints.length;
            y = windowPoints.reduce((sum, p) => sum + p.y, 0) / windowPoints.length;
        } else if (config.filter === 'median') {
            const sortedX = windowPoints.map(p => p.x).sort((a, b) => a - b);
            const sortedY = windowPoints.map(p => p.y).sort((a, b) => a - b);
            const mid = Math.floor(sortedX.length / 2);
            x = sortedX.length % 2 ? sortedX[mid] : (sortedX[mid - 1] + sortedX[mid]) / 2;
            y = sortedY.length % 2 ? sortedY[mid] : (sortedY[mid - 1] + sortedY[mid]) / 2;
        }
        
        result.push({ ...rawData[i], x, y });
    }
    
    return result;
}

function detectFixationsIVT(filteredData, config) {
    if (!filteredData || filteredData.length < 2) return [];
    
    const threshold = config.ivtThreshold;
    const fixations = [];
    let currentFixationPoints = [];
    
    for (let i = 0; i < filteredData.length; i++) {
        let velocity = 0;
        if (i > 0) {
            const dt = filteredData[i].timestamp - filteredData[i - 1].timestamp;
            if (dt > 0) {
                const dx = filteredData[i].x - filteredData[i - 1].x;
                const dy = filteredData[i].y - filteredData[i - 1].y;
                velocity = Math.sqrt(dx * dx + dy * dy) / dt;
            }
        }
        
        if (velocity <= threshold) {
            // Fixation point
            currentFixationPoints.push(filteredData[i]);
        } else {
            // Saccade — finalize current fixation if any
            if (currentFixationPoints.length >= 2) {
                fixations.push(createFixation(currentFixationPoints));
            }
            currentFixationPoints = [];
        }
    }
    
    // Finalize last fixation
    if (currentFixationPoints.length >= 2) {
        fixations.push(createFixation(currentFixationPoints));
    }
    
    return fixations;
}

function detectFixationsIDT(filteredData, config) {
    if (!filteredData || filteredData.length < 2) return [];
    
    const dispThreshold = config.idtDispersion;
    const minDurationSec = config.idtMinDuration / 1000;
    const fixations = [];
    
    let i = 0;
    while (i < filteredData.length) {
        // Start a new potential fixation window
        let windowEnd = i;
        
        // Expand window while dispersion is below threshold
        while (windowEnd < filteredData.length) {
            const windowPoints = filteredData.slice(i, windowEnd + 1);
            const xs = windowPoints.map(p => p.x);
            const ys = windowPoints.map(p => p.y);
            const dispersion = (Math.max(...xs) - Math.min(...xs)) + (Math.max(...ys) - Math.min(...ys));
            
            if (dispersion > dispThreshold) {
                break;
            }
            windowEnd++;
        }
        
        // Check if fixation meets minimum duration
        const fixationPoints = filteredData.slice(i, windowEnd);
        if (fixationPoints.length >= 2) {
            const duration = fixationPoints[fixationPoints.length - 1].timestamp - fixationPoints[0].timestamp;
            if (duration >= minDurationSec) {
                fixations.push(createFixation(fixationPoints));
                i = windowEnd;
                continue;
            }
        }
        
        i++;
    }
    
    return fixations;
}

function createFixation(points) {
    const x = points.reduce((s, p) => s + p.x, 0) / points.length;
    const y = points.reduce((s, p) => s + p.y, 0) / points.length;
    const startTime = points[0].timestamp;
    const endTime = points[points.length - 1].timestamp;
    return {
        x, y,
        startTime,
        endTime,
        duration: endTime - startTime,
        pointCount: points.length,
    };
}

function processGazeData(overlay) {
    if (!overlay.data || overlay.data.length === 0) return;
    
    const config = state.gazeConfig;
    
    // Step 1: Apply smoothing filter
    overlay.processedData = applyGazeFilter(overlay.data, config);
    
    // Step 2: Detect fixations
    if (config.fixationAlgo === 'ivt') {
        overlay.fixations = detectFixationsIVT(overlay.processedData, config);
    } else if (config.fixationAlgo === 'idt') {
        overlay.fixations = detectFixationsIDT(overlay.processedData, config);
    } else {
        overlay.fixations = [];
    }
    
    console.log(`Processed gaze: ${overlay.processedData.length} points → ${overlay.fixations.length} fixations`);
}

function processAllGazeOverlays() {
    state.modalities
        .filter(m => m.type === 'overlay-gaze' && m.data && m.data.length > 0)
        .forEach(overlay => processGazeData(overlay));
    
    updateGazeStats();
    renderOverlays();
}

function updateGazeConfig(key, value) {
    state.gazeConfig[key] = value;
    
    // Show/hide algorithm-specific params
    const ivtParams = document.getElementById('ivt-params');
    const idtParams = document.getElementById('idt-params');
    if (key === 'fixationAlgo') {
        if (ivtParams) ivtParams.style.display = value === 'ivt' ? 'block' : 'none';
        if (idtParams) idtParams.style.display = value === 'idt' ? 'block' : 'none';
    }
    
    // Reprocess all gaze data
    processAllGazeOverlays();
}

function updateGazeStats() {
    const statsEl = document.getElementById('gaze-stats');
    if (!statsEl) return;
    
    const gazeOverlays = state.modalities.filter(m => m.type === 'overlay-gaze' && m.data);
    if (gazeOverlays.length === 0) {
        statsEl.innerHTML = '<p class="settings-hint">Load gaze data to see statistics.</p>';
        return;
    }
    
    let totalRaw = 0, totalFixations = 0, totalDuration = 0;
    gazeOverlays.forEach(o => {
        totalRaw += (o.data || []).length;
        totalFixations += (o.fixations || []).length;
        (o.fixations || []).forEach(f => totalDuration += f.duration);
    });
    
    const avgDuration = totalFixations > 0 ? (totalDuration / totalFixations * 1000).toFixed(0) : '—';
    
    statsEl.innerHTML = `
        <div class="gaze-stats-grid">
            <span class="stat-label">Raw samples:</span>
            <span class="stat-value">${totalRaw.toLocaleString()}</span>
            <span class="stat-label">Fixations detected:</span>
            <span class="stat-value">${totalFixations}</span>
            <span class="stat-label">Avg fixation duration:</span>
            <span class="stat-value">${avgDuration} ms</span>
        </div>
    `;
}

// ============================================
// Auto Gaze-Video Temporal Sync
// ============================================

function autoAlignGazeTimestamps(overlay, parentVideo) {
    if (!overlay.data || overlay.data.length < 2) return;
    
    const gazeStart = overlay.data[0].timestamp;
    const gazeEnd = overlay.data[overlay.data.length - 1].timestamp;
    const gazeDuration = gazeEnd - gazeStart;
    
    // Get video duration in the same unit as gaze timestamps
    const videoEl = document.getElementById('video-' + parentVideo.id);
    const videoDurationSec = videoEl ? videoEl.duration : (state.duration / 1000);
    
    // Convert gaze times to seconds for comparison
    const gazeStartSec = overlay.timestampUnit === 's' ? gazeStart : gazeStart / 1000;
    const gazeDurationSec = overlay.timestampUnit === 's' ? gazeDuration : gazeDuration / 1000;
    
    let offsetMs = 0;
    let reason = '';
    
    // Tier 1: Detect Unix epoch timestamps (gaze timestamps > 1e9 seconds or > 1e12 ms)
    if (gazeStartSec > 1e9) {
        // Unix epoch — subtract start time to make relative
        const startOffset = overlay.timestampUnit === 's' ? gazeStart : gazeStart / 1000;
        offsetMs = -startOffset * 1000;
        reason = `Unix epoch detected (start: ${gazeStartSec.toFixed(0)}s), rebaselined to 0`;
    }
    // Tier 2: If gaze starts significantly after video start, align first gaze point to t=0
    else if (gazeStartSec > 1 && Math.abs(gazeDurationSec - videoDurationSec) / videoDurationSec < 0.3) {
        // Gaze duration is similar to video duration but starts offset
        offsetMs = -(overlay.timestampUnit === 's' ? gazeStart * 1000 : gazeStart);
        reason = `Gaze starts at ${gazeStartSec.toFixed(2)}s, shifting to align with video start`;
    }
    // Tier 3: Tobii scene camera — typically both start at 0, minimal offset expected
    else if (gazeStartSec >= 0 && gazeStartSec < 1) {
        // Small offset, might be recording startup delay
        offsetMs = -(overlay.timestampUnit === 's' ? gazeStart * 1000 : gazeStart);
        if (Math.abs(offsetMs) < 10) offsetMs = 0; // ignore < 10ms
        reason = offsetMs !== 0 ? `Small startup offset: ${offsetMs.toFixed(0)}ms` : 'Already aligned';
    }
    
    if (offsetMs !== 0) {
        overlay.offsetMs = offsetMs;
        console.log(`Auto-sync: ${reason} → offset = ${offsetMs.toFixed(0)}ms`);
    } else {
        console.log(`Auto-sync: ${reason || 'No adjustment needed'}`);
    }
    
    return { offsetMs, reason };
}



// ============================================
// Transcript Module
// ============================================

function loadTranscript(data) {
    state.transcript = {
        video: data.video || null,
        duration: data.duration_s || null,
        speakers: data.speakers || [],
        segments: data.transcript || []
    };
    
    console.log(`Loaded transcript: ${state.transcript.segments.length} segments`);
    renderTranscript();
}

function renderTranscript() {
    const panel = document.getElementById('transcript-panel');
    const body = document.getElementById('transcript-body');
    if (!panel || !body || !state.transcript) return;
    
    panel.style.display = 'flex';
    
    body.innerHTML = state.transcript.segments.map((seg, i) => {
        const startTime = formatTimestamp(seg.start);
        const endTime = formatTimestamp(seg.end);
        const speaker = seg.speaker ? `<div class="transcript-segment-speaker">${seg.speaker}</div>` : '';
        
        return `
            <div class="transcript-segment" 
                 data-index="${i}" 
                 data-start="${seg.start}" 
                 data-end="${seg.end}"
                 onclick="seekToTranscriptSegment(${seg.start})">
                ${speaker}
                <div class="transcript-segment-time">${startTime} → ${endTime}</div>
                <div class="transcript-segment-text">${seg.text}</div>
            </div>
        `;
    }).join('');
}

function formatTimestamp(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}

function seekToTranscriptSegment(startSec) {
    const masterVideo = state.modalities.find(m => m.id === state.masterModalityId);
    if (!masterVideo) return;
    
    const videoEl = document.getElementById('video-' + masterVideo.id);
    if (videoEl) {
        videoEl.currentTime = startSec;
    }
}

function updateTranscriptHighlight() {
    if (!state.transcript || !state.transcript.segments.length) return;
    
    const currentTimeSec = state.currentTime / 1000;
    const body = document.getElementById('transcript-body');
    if (!body) return;
    
    const segments = body.querySelectorAll('.transcript-segment');
    let activeSegment = null;
    
    segments.forEach(seg => {
        const start = parseFloat(seg.dataset.start);
        const end = parseFloat(seg.dataset.end);
        
        if (currentTimeSec >= start && currentTimeSec <= end) {
            seg.classList.add('active');
            activeSegment = seg;
        } else {
            seg.classList.remove('active');
        }
    });
    
    // Auto-scroll to active segment
    if (activeSegment) {
        const bodyRect = body.getBoundingClientRect();
        const segRect = activeSegment.getBoundingClientRect();
        
        if (segRect.top < bodyRect.top || segRect.bottom > bodyRect.bottom) {
            activeSegment.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }
}

function closeTranscriptPanel() {
    const panel = document.getElementById('transcript-panel');
    if (panel) panel.style.display = 'none';
    state.transcript = null;
}

function adjustGazeOffset(deltaMs) {
    const gazeOverlays = state.modalities.filter(m => m.type === 'overlay-gaze' && m.data);
    gazeOverlays.forEach(o => {
        o.offsetMs = (o.offsetMs || 0) + deltaMs;
    });
    processAllGazeOverlays();
    
    // Update the offset display in modalities settings
    const offsetDisplay = document.getElementById('gaze-offset-display');
    if (offsetDisplay && gazeOverlays.length > 0) {
        offsetDisplay.textContent = `${gazeOverlays[0].offsetMs.toFixed(0)} ms`;
    }
}

function parseCSV(text) {
    // Legacy function - kept for backward compatibility
    const lines = text.trim().split('\n');
    const data = [];
    
    for (const line of lines) {
        const values = line.split(/[,\t]/).map(v => parseFloat(v.trim()));
        if (values.some(v => !isNaN(v))) {
            data.push(values);
        }
    }
    
    return data;
}

function parseIMUData(text, modality) {
    const lines = text.trim().split('\n');
    const data = [];
    
    // Check if this is Tobii JSON Lines format
    const firstLine = lines[0].trim();
    if (firstLine.startsWith('{')) {
        console.log('Detected Tobii Pro Glasses 3 IMU format');
        
        for (const line of lines) {
            try {
                const obj = JSON.parse(line);
                if (obj.type === 'imu' && obj.data) {
                    data.push({
                        timestamp: obj.timestamp,
                        accel: obj.data.accelerometer || [0, 0, 0],
                        gyro: obj.data.gyroscope || [0, 0, 0]
                    });
                }
            } catch (e) {
                // Skip invalid JSON lines
            }
        }
        
        modality.timestampUnit = 's';
        modality.dataFormat = 'tobii';
        console.log(`Parsed ${data.length} Tobii IMU points`);
        return data;
    }
    
    // CSV format: timestamp, ax, ay, az, gx, gy, gz
    console.log('Parsing IMU as CSV format');
    for (const line of lines) {
        const values = line.split(/[,\t]/).map(v => parseFloat(v.trim()));
        if (values.length >= 7 && values.every(v => !isNaN(v))) {
            data.push({
                timestamp: values[0],
                accel: [values[1], values[2], values[3]],
                gyro: [values[4], values[5], values[6]]
            });
        }
    }
    
    console.log(`Parsed ${data.length} CSV IMU points`);
    return data;
}

function deleteModality(id) {
    const modality = state.modalities.find(m => m.id === id);
    if (!modality) return;
    
    // If it's a video, also remove its overlays
    if (modality.type === 'video') {
        modality.overlays.forEach(overlayId => {
            state.modalities = state.modalities.filter(m => m.id !== overlayId);
        });
        if (modality.url) URL.revokeObjectURL(modality.url);
    }
    
    // If it's an overlay, remove from parent's list
    if (modality.type.startsWith('overlay-')) {
        const parent = state.modalities.find(m => m.id === modality.parentVideoId);
        if (parent) {
            parent.overlays = parent.overlays.filter(id => id !== modality.id);
        }
    }
    
    state.modalities = state.modalities.filter(m => m.id !== id);
    
    // Update master if needed
    if (id === state.masterModalityId) {
        const nextVideo = state.modalities.find(m => m.type === 'video');
        if (nextVideo) {
            nextVideo.isMaster = true;
            state.masterModalityId = nextVideo.id;
        } else {
            state.masterModalityId = null;
            state.duration = 0;
        }
    }
    
    renderModalities();
    renderSettings();
}

function setMasterModality(id) {
    state.modalities.forEach(m => {
        if (m.type === 'video') {
            m.isMaster = m.id === id;
        }
    });
    state.masterModalityId = id;
    
    const master = state.modalities.find(m => m.id === id);
    if (master) {
        state.duration = master.duration;
        state.fps = master.fps;
    }
    
    renderModalities();
    renderSettings();
}

function updateModalityOffset(id, offsetMs) {
    const modality = state.modalities.find(m => m.id === id);
    if (modality) {
        modality.offsetMs = offsetMs;
    }
}

// ============================================
// Rendering
// ============================================

function renderAll() {
    renderTabs();
    renderAnnotationTypes();
    renderTimelines();
    renderModalities();
    renderAnnotationsList();
    updateAnnotationControls();
    
    if (state.settingsOpen) {
        renderSettings();
    }
}

function renderModalities() {
    const container = document.getElementById('modalities-container');
    if (!container) return;
    
    container.innerHTML = '';
    
    const videos = state.modalities.filter(m => m.type === 'video');
    
    if (videos.length === 0) {
        container.innerHTML = `
            <div class="no-modalities">
                <span class="upload-icon">🎬</span>
                <h3>No data loaded</h3>
                <p>Add video or gaze data to start annotating</p>
                <button class="btn btn-primary" onclick="document.getElementById('add-modality-input').click()">
                    ➕ Add Data
                </button>
            </div>
        `;
        return;
    }
    
    videos.forEach(video => {
        const videoWrapper = document.createElement('div');
        videoWrapper.className = 'video-modality';
        videoWrapper.dataset.modalityId = video.id;
        
        // Header
        const header = document.createElement('div');
        header.className = 'modality-header';
        header.innerHTML = `
            <span class="modality-icon">📹</span>
            <span class="modality-name">${video.name}</span>
            ${video.isMaster ? '<span class="master-badge">Master</span>' : ''}
            <span class="modality-offset">Offset: ${video.offsetMs}ms</span>
            <div class="modality-actions">
                <button class="btn-icon-sm" onclick="toggleModalitySettings('${video.id}')" title="Settings">⚙️</button>
            </div>
        `;
        videoWrapper.appendChild(header);
        
        // Video container with canvas overlay
        const videoContainer = document.createElement('div');
        videoContainer.className = 'video-overlay-container';
        
        const videoEl = document.createElement('video');
        videoEl.id = 'video-' + video.id;
        videoEl.className = 'modality-video';
        videoEl.src = video.url;
        videoEl.muted = !video.isMaster;
        
        videoEl.addEventListener('loadedmetadata', () => {
            video.duration = videoEl.duration * 1000;
            video.fps = 30; // Could try to detect
            
            if (video.isMaster) {
                state.duration = video.duration;
                state.fps = video.fps;
                document.getElementById('duration').textContent = formatTime(state.duration);
                document.getElementById('seek-slider').max = state.duration;
                document.getElementById('export-btn').disabled = false;
            }
            
            // Size the overlay canvas
            const canvas = document.getElementById('canvas-' + video.id);
            if (canvas) {
                canvas.width = videoEl.videoWidth;
                canvas.height = videoEl.videoHeight;
                console.log(`Canvas sized: ${canvas.width}x${canvas.height}`);
            }
        });
        
        if (video.isMaster) {
            videoEl.addEventListener('timeupdate', handleMasterTimeUpdate);
        }
        
        videoContainer.appendChild(videoEl);
        
        // Canvas overlay for gaze/heatmap
        const canvas = document.createElement('canvas');
        canvas.id = 'canvas-' + video.id;
        canvas.className = 'overlay-canvas';
        videoContainer.appendChild(canvas);
        
        // Size canvas to match display dimensions (not native resolution)
        // renderOverlays() will keep this in sync on subsequent frames
        const sizeCanvas = () => {
            const rect = videoContainer.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
                canvas.width = rect.width;
                canvas.height = rect.height;
            }
        };
        if (videoEl.videoWidth > 0) {
            sizeCanvas();
        } else {
            videoEl.addEventListener('loadedmetadata', sizeCanvas, { once: true });
            // Fallback for edge cases
            setTimeout(sizeCanvas, 500);
        }
        
        // Overlay toggles
        const overlays = video.overlays.map(id => state.modalities.find(m => m.id === id)).filter(Boolean);
        if (overlays.length > 0) {
            const toggles = document.createElement('div');
            toggles.className = 'overlay-toggles';
            overlays.forEach(overlay => {
                const icon = overlay.type === 'overlay-gaze' ? '👁' :
                             overlay.type === 'overlay-heatmap' ? '🔥' :
                             overlay.type === 'overlay-pose' ? '🦴' : '📦';
                toggles.innerHTML += `
                    <label class="overlay-toggle">
                        <input type="checkbox" ${overlay.visible ? 'checked' : ''} 
                               onchange="toggleOverlay('${overlay.id}', this.checked)">
                        ${icon} ${overlay.name}
                    </label>
                `;
            });
            videoContainer.appendChild(toggles);
        }
        
        videoWrapper.appendChild(videoContainer);
        container.appendChild(videoWrapper);
    });
    
    // Render IMU timeseries charts
    const imuModalities = state.modalities.filter(m => m.type === 'timeseries-imu');
    imuModalities.forEach(imu => {
        const imuWrapper = document.createElement('div');
        imuWrapper.className = 'imu-modality';
        imuWrapper.innerHTML = `
            <div class="imu-header">
                <span class="imu-label">📈 ${imu.name}</span>
                <button class="btn-icon" onclick="deleteModality('${imu.id}')" title="Remove">✕</button>
            </div>
            <canvas id="imu-canvas-${imu.id}" class="imu-canvas"></canvas>
        `;
        container.appendChild(imuWrapper);
        
        // Initialize canvas
        setTimeout(() => {
            const canvas = document.getElementById('imu-canvas-' + imu.id);
            if (canvas) {
                canvas.width = canvas.parentElement.clientWidth;
                canvas.height = 80;
                renderIMUChart(imu);
            }
        }, 0);
    });
    
    updateAnnotationControls();
}

function handleMasterTimeUpdate() {
    const master = state.modalities.find(m => m.id === state.masterModalityId);
    if (!master) return;
    
    const videoEl = document.getElementById('video-' + master.id);
    if (!videoEl) return;
    
    state.currentTime = videoEl.currentTime * 1000;
    
    document.getElementById('current-time').textContent = formatTime(state.currentTime);
    document.getElementById('current-frame').textContent = Math.floor(state.currentTime / 1000 * state.fps);
    document.getElementById('seek-slider').value = state.currentTime;
    
    // Sync other videos
    state.modalities.filter(m => m.type === 'video' && m.id !== master.id).forEach(mod => {
        const el = document.getElementById('video-' + mod.id);
        if (el) {
            const targetTime = (state.currentTime + mod.offsetMs) / 1000;
            if (Math.abs(el.currentTime - targetTime) > 0.1) {
                el.currentTime = Math.max(0, targetTime);
            }
        }
    });
    
    // Render overlays
    renderOverlays();
    renderTimelines();
    
    // Render IMU charts
    state.modalities.filter(m => m.type === 'timeseries-imu').forEach(renderIMUChart);
    
    // Update transcript highlight
    updateTranscriptHighlight();
}

function renderOverlays() {
    state.modalities.filter(m => m.type === 'video').forEach(video => {
        const canvas = document.getElementById('canvas-' + video.id);
        const videoEl = document.getElementById('video-' + video.id);
        if (!canvas || !videoEl) return;
        
        // Ensure canvas matches video dimensions
        const rect = videoEl.getBoundingClientRect();
        if (rect.width > 0 && (canvas.width !== rect.width || canvas.height !== rect.height)) {
            canvas.width = rect.width;
            canvas.height = rect.height;
        }
        
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Get overlays for this video
        const overlays = video.overlays
            .map(id => state.modalities.find(m => m.id === id))
            .filter(m => m && m.visible);
        
        overlays.forEach(overlay => {
            if (overlay.type === 'overlay-gaze') {
                renderGazeOverlay(ctx, canvas, overlay, video);
            } else if (overlay.type === 'overlay-heatmap') {
                renderHeatmapOverlay(ctx, canvas, overlay, video);
            }
        });
    });
}

function renderIMUChart(imu) {
    const canvas = document.getElementById('imu-canvas-' + imu.id);
    if (!canvas || !imu.data || imu.data.length === 0) return;
    
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    ctx.clearRect(0, 0, width, height);
    
    // Background
    ctx.fillStyle = 'rgba(30, 30, 40, 0.8)';
    ctx.fillRect(0, 0, width, height);
    
    // Get time window (5 seconds around current time)
    const windowMs = 5000;
    const currentTimeSec = (imu.timestampUnit === 's') 
        ? (state.currentTime + imu.offsetMs) / 1000 
        : state.currentTime + imu.offsetMs;
    
    const startTime = currentTimeSec - windowMs / 2000;
    const endTime = currentTimeSec + windowMs / 2000;
    
    // Filter data to window
    const windowData = imu.data.filter(p => p.timestamp >= startTime && p.timestamp <= endTime);
    if (windowData.length < 2) return;
    
    // Draw accelerometer (X=red, Y=green, Z=blue)
    const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1'];
    const centerY = height / 2;
    const scale = height / 40;  // Scale for ±20 m/s²
    
    for (let axis = 0; axis < 3; axis++) {
        ctx.beginPath();
        ctx.strokeStyle = colors[axis];
        ctx.lineWidth = 1.5;
        
        windowData.forEach((point, i) => {
            const x = ((point.timestamp - startTime) / (endTime - startTime)) * width;
            const y = centerY - (point.accel[axis] * scale);
            
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        
        ctx.stroke();
    }
    
    // Draw current time indicator
    ctx.beginPath();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.moveTo(width / 2, 0);
    ctx.lineTo(width / 2, height);
    ctx.stroke();
    
    // Legend
    ctx.font = '10px Inter, sans-serif';
    ctx.fillStyle = colors[0];
    ctx.fillText('X', 5, 12);
    ctx.fillStyle = colors[1];
    ctx.fillText('Y', 18, 12);
    ctx.fillStyle = colors[2];
    ctx.fillText('Z', 31, 12);
}

function renderGazeOverlay(ctx, canvas, overlay, video) {
    if (!overlay.data || overlay.data.length === 0) {
        return;
    }
    
    if (canvas.width === 0 || canvas.height === 0) {
        return;
    }
    
    const config = state.gazeConfig;
    
    // Video time in ms
    const videoTimeMs = state.currentTime + video.offsetMs + overlay.offsetMs;
    // Convert to seconds for Tobii data
    const videoTimeSec = overlay.timestampUnit === 's' ? videoTimeMs / 1000 : videoTimeMs;
    
    // Calculate actual video display area (accounting for object-fit: contain)
    const videoEl = document.getElementById('video-' + video.id);
    let videoDisplayX = 0, videoDisplayY = 0, videoDisplayW = canvas.width, videoDisplayH = canvas.height;
    
    if (videoEl && videoEl.videoWidth > 0) {
        const videoAspect = videoEl.videoWidth / videoEl.videoHeight;
        const canvasAspect = canvas.width / canvas.height;
        
        if (videoAspect > canvasAspect) {
            videoDisplayW = canvas.width;
            videoDisplayH = canvas.width / videoAspect;
            videoDisplayY = (canvas.height - videoDisplayH) / 2;
        } else {
            videoDisplayH = canvas.height;
            videoDisplayW = canvas.height * videoAspect;
            videoDisplayX = (canvas.width - videoDisplayW) / 2;
        }
    }
    
    // Use processed data (filtered) if available, otherwise raw
    const gazeData = overlay.processedData || overlay.data;
    
    // Binary search to find closest point
    let closestIdx = 0;
    let closestDiff = Infinity;
    
    for (let i = 0; i < gazeData.length; i++) {
        const timestamp = gazeData[i].timestamp !== undefined ? gazeData[i].timestamp : gazeData[i][0];
        const diff = Math.abs(timestamp - videoTimeSec);
        if (diff < closestDiff) {
            closestDiff = diff;
            closestIdx = i;
        }
        if (timestamp > videoTimeSec && diff > closestDiff) break;
    }
    
    // Draw raw/filtered gaze trail
    if (config.showRawGaze || config.fixationAlgo === 'none') {
        for (let i = Math.max(0, closestIdx - overlay.trailLength); i <= closestIdx; i++) {
            const point = gazeData[i];
            if (!point) continue;
            
            let x = point.x !== undefined ? point.x : point[overlay.gazeXColumn || 1];
            let y = point.y !== undefined ? point.y : point[overlay.gazeYColumn || 2];
            
            if (x === undefined || y === undefined || isNaN(x) || isNaN(y)) continue;
            
            if (overlay.coordinateSystem === 'normalized') {
                x = videoDisplayX + (x * videoDisplayW);
                y = videoDisplayY + (y * videoDisplayH);
            }
            
            const age = closestIdx - i;
            const alpha = (overlay.trailLength - age) / overlay.trailLength;
            const size = overlay.dotSize * alpha;
            
            ctx.beginPath();
            ctx.arc(x, y, size / 2, 0, Math.PI * 2);
            ctx.fillStyle = overlay.color;
            ctx.globalAlpha = overlay.opacity * alpha;
            ctx.fill();
        }
    }
    
    // Draw fixation circles
    if (config.showFixations && overlay.fixations && overlay.fixations.length > 0) {
        const fixations = overlay.fixations;
        
        for (const fix of fixations) {
            // Only draw fixations near the current time
            if (videoTimeSec < fix.startTime || videoTimeSec > fix.endTime + 0.5) continue;
            
            let x = fix.x, y = fix.y;
            if (overlay.coordinateSystem === 'normalized') {
                x = videoDisplayX + (x * videoDisplayW);
                y = videoDisplayY + (y * videoDisplayH);
            }
            
            // Size based on duration
            let radius;
            if (config.fixationSizeMode === 'proportional') {
                radius = Math.max(10, Math.min(60, fix.duration * 100)); // 100ms → 10px, 600ms → 60px
            } else {
                radius = 20;
            }
            
            // Fade: full opacity during fixation, fade out after
            const isActive = videoTimeSec >= fix.startTime && videoTimeSec <= fix.endTime;
            const fadeAlpha = isActive ? 1 : Math.max(0, 1 - (videoTimeSec - fix.endTime) * 2);
            
            // Draw fixation circle
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.strokeStyle = overlay.color || '#FF0000';
            ctx.lineWidth = 2;
            ctx.globalAlpha = overlay.opacity * fadeAlpha * 0.8;
            ctx.stroke();
            
            // Fill with semi-transparent color
            ctx.fillStyle = overlay.color || '#FF0000';
            ctx.globalAlpha = overlay.opacity * fadeAlpha * 0.15;
            ctx.fill();
            
            // Duration label (only for active fixations with enough space)
            if (isActive && radius >= 15) {
                const durationMs = Math.round(fix.duration * 1000);
                ctx.font = `${Math.min(12, radius * 0.6)}px sans-serif`;
                ctx.fillStyle = '#FFFFFF';
                ctx.globalAlpha = overlay.opacity * fadeAlpha * 0.9;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(`${durationMs}`, x, y);
            }
        }
    }
    
    ctx.globalAlpha = 1;
}

function renderHeatmapOverlay(ctx, canvas, overlay, video) {
    if (!overlay.data || overlay.data.length === 0) return;
    
    const videoTimeMs = state.currentTime + video.offsetMs + overlay.offsetMs;
    const videoTimeSec = overlay.timestampUnit === 's' ? videoTimeMs / 1000 : videoTimeMs;
    const windowSec = overlay.timestampUnit === 's' ? 2 : 2000; // 2 second window
    
    // Create temporary canvas for heatmap
    const heatCanvas = document.createElement('canvas');
    heatCanvas.width = canvas.width;
    heatCanvas.height = canvas.height;
    const heatCtx = heatCanvas.getContext('2d');
    
    // Collect points in window
    for (const point of overlay.data) {
        const timestamp = point.timestamp !== undefined ? point.timestamp : point[0];
        
        if (timestamp >= videoTimeSec - windowSec && timestamp <= videoTimeSec) {
            let x = point.x !== undefined ? point.x : point[overlay.gazeXColumn || 1];
            let y = point.y !== undefined ? point.y : point[overlay.gazeYColumn || 2];
            
            if (x === undefined || y === undefined || isNaN(x) || isNaN(y)) continue;
            
            if (overlay.coordinateSystem === 'normalized') {
                x *= canvas.width;
                y *= canvas.height;
            }
            
            const gradient = heatCtx.createRadialGradient(x, y, 0, x, y, 50);
            gradient.addColorStop(0, 'rgba(255, 0, 0, 0.15)');
            gradient.addColorStop(1, 'rgba(255, 0, 0, 0)');
            
            heatCtx.fillStyle = gradient;
            heatCtx.fillRect(x - 50, y - 50, 100, 100);
        }
    }
    
    ctx.globalAlpha = overlay.opacity;
    ctx.drawImage(heatCanvas, 0, 0);
    ctx.globalAlpha = 1;
}

function toggleOverlay(id, visible) {
    const overlay = state.modalities.find(m => m.id === id);
    if (overlay) {
        overlay.visible = visible;
        renderOverlays();
    }
}

// ============================================
// Playback Control
// ============================================

function togglePlayPause() {
    const master = state.modalities.find(m => m.id === state.masterModalityId);
    if (!master) return;
    
    const masterEl = document.getElementById('video-' + master.id);
    if (!masterEl) return;
    
    if (masterEl.paused) {
        // Play all videos
        state.modalities.filter(m => m.type === 'video').forEach(mod => {
            const el = document.getElementById('video-' + mod.id);
            if (el) el.play();
        });
        state.isPlaying = true;
    } else {
        // Pause all videos
        state.modalities.filter(m => m.type === 'video').forEach(mod => {
            const el = document.getElementById('video-' + mod.id);
            if (el) el.pause();
        });
        state.isPlaying = false;
    }
    
    document.getElementById('play-icon').textContent = state.isPlaying ? '⏸' : '▶';
}

function stepFrame(direction) {
    const master = state.modalities.find(m => m.id === state.masterModalityId);
    if (!master) return;
    
    const masterEl = document.getElementById('video-' + master.id);
    if (masterEl) {
        masterEl.currentTime += direction / state.fps;
    }
}

function stepTime(seconds) {
    const master = state.modalities.find(m => m.id === state.masterModalityId);
    if (!master) return;
    
    const masterEl = document.getElementById('video-' + master.id);
    if (masterEl) {
        masterEl.currentTime = Math.max(0, masterEl.currentTime + seconds);
    }
}

function handleSpeedChange() {
    const speed = parseFloat(document.getElementById('playback-speed').value);
    state.modalities.filter(m => m.type === 'video').forEach(mod => {
        const el = document.getElementById('video-' + mod.id);
        if (el) el.playbackRate = speed;
    });
}

function handleSeek() {
    const slider = document.getElementById('seek-slider');
    if (!slider) return;
    
    const time = parseFloat(slider.value);
    state.currentTime = time;
    
    state.modalities.filter(m => m.type === 'video').forEach(mod => {
        const el = document.getElementById('video-' + mod.id);
        if (el) {
            const localTime = (time + (mod.isMaster ? 0 : mod.offsetMs)) / 1000;
            el.currentTime = Math.max(0, localTime);
        }
    });
    
    // Update playhead position on timelines
    requestAnimationFrame(renderTimelines);
}

// ============================================
// Annotation Layer Management (from v0.1)
// ============================================

function renderTabs() {
    const container = document.getElementById('mode-tabs');
    if (!container) return;
    
    container.innerHTML = '';
    state.layers.forEach(layer => {
        const tab = document.createElement('button');
        tab.className = 'tab' + (state.activeLayerId === layer.id ? ' active' : '');
        tab.textContent = layer.name;
        tab.addEventListener('click', () => {
            state.activeLayerId = layer.id;
            state.selectedType = null;
            state.pendingStart = null;
            renderTabs();
            renderAnnotationTypes();
            updateAnnotationControls();
            renderAnnotationsList();
        });
        container.appendChild(tab);
    });
}

function renderAnnotationTypes() {
    const container = document.getElementById('annotation-types');
    if (!container) return;
    
    container.innerHTML = '';
    
    const layer = state.layers.find(l => l.id === state.activeLayerId);
    if (!layer) return;
    
    layer.types.forEach(type => {
        const div = document.createElement('div');
        div.className = 'annotation-type' + (state.selectedType?.id === type.id ? ' selected' : '');
        div.innerHTML = `
            <span class="type-color" style="background: ${type.color}"></span>
            <span class="type-number">${type.id}.</span>
            <span class="type-name">${type.name}</span>
        `;
        div.addEventListener('click', () => {
            state.selectedType = type;
            renderAnnotationTypes();
            updateAnnotationControls();
        });
        container.appendChild(div);
    });
}

function renderTimelines() {
    const container = document.getElementById('timelines-container');
    if (!container) return;
    
    container.innerHTML = '';
    
    state.layers.forEach(layer => {
        const row = document.createElement('div');
        row.className = 'timeline-row';
        
        const label = document.createElement('span');
        label.className = 'timeline-label';
        label.textContent = layer.name.substring(0, 10);
        
        const canvas = document.createElement('canvas');
        canvas.className = 'timeline-canvas';
        
        const rect = container.getBoundingClientRect();
        canvas.width = rect.width - 100;
        canvas.height = 28;
        
        canvas.addEventListener('click', (e) => {
            if (state.duration > 0) {
                const x = e.clientX - canvas.getBoundingClientRect().left;
                const ratio = x / canvas.width;
                document.getElementById('seek-slider').value = state.duration * ratio;
                handleSeek();
            }
        });
        
        row.appendChild(label);
        row.appendChild(canvas);
        container.appendChild(row);
        
        drawTimeline(canvas, layer);
    });
}

function drawTimeline(canvas, layer) {
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#242b33';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    if (state.duration <= 0) return;
    
    const annotations = state.annotations[layer.id] || [];
    
    annotations.forEach(ann => {
        const type = layer.types.find(t => t.id === ann.typeId);
        const startX = (ann.startTime * 1000 / state.duration) * canvas.width;
        const endX = (ann.endTime * 1000 / state.duration) * canvas.width;
        const barWidth = Math.max(endX - startX, 2);
        
        ctx.fillStyle = type?.color || layer.color;
        ctx.fillRect(startX, 2, barWidth, canvas.height - 4);
    });
    
    // Playhead
    const playheadX = (state.currentTime / state.duration) * canvas.width;
    ctx.strokeStyle = '#ff4757';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(playheadX, 0);
    ctx.lineTo(playheadX, canvas.height);
    ctx.stroke();
}

// ============================================
// Annotation Recording
// ============================================

function startAnnotation() {
    if (!state.selectedType || state.pendingStart !== null) return;
    state.pendingStart = state.currentTime;
    updateAnnotationControls();
}

function endAnnotation() {
    if (state.pendingStart === null) return;
    
    const endTime = state.currentTime;
    if (endTime <= state.pendingStart) {
        alert('End time must be after start time');
        return;
    }
    
    const record = {
        id: Date.now(),
        typeId: state.selectedType.id,
        typeName: state.selectedType.name,
        startTime: state.pendingStart / 1000,
        endTime: endTime / 1000,
        layerId: state.activeLayerId,
    };
    
    // Ensure annotations array exists for this layer
    if (!state.annotations[state.activeLayerId]) {
        state.annotations[state.activeLayerId] = [];
    }
    state.annotations[state.activeLayerId].push(record);
    state.annotations[state.activeLayerId].sort((a, b) => a.startTime - b.startTime);
    
    state.pendingStart = null;
    renderAnnotationsList();
    renderTimelines();
    updateAnnotationControls();
}

// ============================================
// Pin Mode Functions
// ============================================

function handleAnnotationModeChange(e) {
    state.annotationMode = e.target.value;
    
    // Toggle UI visibility
    const rangeControls = document.getElementById('range-mode-controls');
    const pinControls = document.getElementById('pin-mode-controls');
    const hintRange = document.getElementById('hint-range');
    const hintPin = document.getElementById('hint-pin');
    
    if (state.annotationMode === 'pin') {
        if (rangeControls) rangeControls.style.display = 'none';
        if (pinControls) pinControls.style.display = 'flex';
        if (hintRange) hintRange.style.display = 'none';
        if (hintPin) hintPin.style.display = 'inline';
        // Clear any pending range annotation
        state.pendingStart = null;
    } else {
        if (rangeControls) rangeControls.style.display = 'flex';
        if (pinControls) pinControls.style.display = 'none';
        if (hintRange) hintRange.style.display = 'inline';
        if (hintPin) hintPin.style.display = 'none';
    }
    
    updateAnnotationControls();
}

function getWindowDurationMs() {
    const value = state.pinWindowValue;
    const unit = state.pinWindowUnit;
    
    switch (unit) {
        case 'frames':
            return (value / state.fps) * 1000;
        case 'seconds':
            return value * 1000;
        case 'ms':
            return value;
        default:
            return (1 / state.fps) * 1000; // Default to 1 frame
    }
}

function pinAnnotation() {
    if (!state.selectedType) return;
    
    const windowMs = getWindowDurationMs();
    const currentTimeMs = state.currentTime;
    
    // Calculate start and end times with window
    const startTimeMs = Math.max(0, currentTimeMs - windowMs / 2);
    const endTimeMs = Math.min(state.duration, currentTimeMs + windowMs / 2);
    
    // Ensure end > start (at minimum 1 frame difference)
    const minDuration = (1 / state.fps) * 1000;
    const finalEndMs = Math.max(endTimeMs, startTimeMs + minDuration);
    
    const record = {
        id: Date.now(),
        typeId: state.selectedType.id,
        typeName: state.selectedType.name,
        startTime: startTimeMs / 1000,
        endTime: finalEndMs / 1000,
        layerId: state.activeLayerId,
        isPinned: true, // Mark as pin annotation for visual distinction
    };
    
    // Ensure annotations array exists
    if (!state.annotations[state.activeLayerId]) {
        state.annotations[state.activeLayerId] = [];
    }
    
    state.annotations[state.activeLayerId].push(record);
    state.annotations[state.activeLayerId].sort((a, b) => a.startTime - b.startTime);
    
    renderAnnotationsList();
    renderTimelines();
    updateAnnotationControls();
}

function updateAnnotationControls() {
    const hasVideo = state.duration > 0;
    const hasType = state.selectedType !== null;
    const isRecording = state.pendingStart !== null;
    
    // Range Mode controls
    const startBtn = document.getElementById('start-annotation-btn');
    const endBtn = document.getElementById('end-annotation-btn');
    
    if (startBtn) startBtn.disabled = !hasVideo || !hasType || isRecording;
    if (endBtn) endBtn.disabled = !isRecording;
    
    // Pin Mode controls
    const pinBtn = document.getElementById('pin-annotation-btn');
    if (pinBtn) pinBtn.disabled = !hasVideo || !hasType;
    
    // Status display
    const status = document.getElementById('annotation-status');
    if (status) {
        if (isRecording && state.annotationMode === 'range') {
            status.innerHTML = `<div class="status-recording"><span class="recording-indicator"></span>Recording: ${state.selectedType.name}</div>`;
        } else if (hasType) {
            const modeHint = state.annotationMode === 'pin' ? 'Press M or click Pin' : 'Press S to start';
            status.innerHTML = `<div class="status-idle"><p>Selected: <strong>${state.selectedType.name}</strong></p><p class="status-hint">${modeHint}</p></div>`;
        } else {
            status.innerHTML = `<div class="status-idle"><p>Select a type above</p></div>`;
        }
    }
}

function renderAnnotationsList() {
    const container = document.getElementById('annotations-list');
    const countEl = document.getElementById('annotation-count');
    if (!container) return;
    
    container.innerHTML = '';
    
    const allAnnotations = [];
    const activeLayer = state.layers.find(l => l.id === state.activeLayerId);
    if (activeLayer) {
        (state.annotations[activeLayer.id] || []).forEach(ann => {
            const type = activeLayer.types.find(t => t.id === ann.typeId);
            allAnnotations.push({ ...ann, layerId: activeLayer.id, color: type?.color || activeLayer.color });
        });
    }
    allAnnotations.sort((a, b) => a.startTime - b.startTime);
    
    if (countEl) countEl.textContent = `(${allAnnotations.length})`;
    
    allAnnotations.forEach(ann => {
        const commentHtml = ann.comment ? `<div class="item-comment" title="${ann.comment}">${ann.comment}</div>` : '';
        
        const div = document.createElement('div');
        div.className = 'annotation-item';
        div.dataset.annId = ann.id;
        div.innerHTML = `
            <span class="item-color" style="background: ${ann.color}"></span>
            <div class="item-info">
                <div class="item-name">${ann.typeName}</div>
                <div class="item-time">${formatTime(ann.startTime * 1000)} → ${formatTime(ann.endTime * 1000)}</div>
                ${commentHtml}
            </div>
            <button class="edit-btn" title="Edit">✏️</button>
            <button class="delete-btn" title="Delete">×</button>
        `;
        div.querySelector('.edit-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            editAnnotation(ann.layerId, ann.id);
        });
        div.querySelector('.delete-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            state.annotations[ann.layerId] = state.annotations[ann.layerId].filter(a => a.id !== ann.id);
            renderAnnotationsList();
            renderTimelines();
        });
        div.addEventListener('click', () => {
            document.getElementById('seek-slider').value = ann.startTime * 1000;
            handleSeek();
        });
        container.appendChild(div);
    });
}

// ============================================
// Settings Modal
// ============================================

function openSettings() {
    document.getElementById('settings-modal')?.classList.add('open');
    state.settingsOpen = true;
    renderSettings();
}

function closeSettings() {
    document.getElementById('settings-modal')?.classList.remove('open');
    state.settingsOpen = false;
    renderAll();
}

function switchSettingsTab(tab) {
    state.settingsTab = tab;
    document.querySelectorAll('.settings-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.tab === tab);
    });
    renderSettings();
}

function renderSettings() {
    const layersPane = document.getElementById('layers-settings');
    const modalitiesPane = document.getElementById('modalities-settings');
    const pinmodePane = document.getElementById('pinmode-settings');
    const gazePane = document.getElementById('gaze-settings');
    const layoutPane = document.getElementById('layout-settings');
    
    if (layersPane) layersPane.style.display = state.settingsTab === 'layers' ? 'block' : 'none';
    if (modalitiesPane) modalitiesPane.style.display = state.settingsTab === 'modalities' ? 'block' : 'none';
    if (pinmodePane) pinmodePane.style.display = state.settingsTab === 'pinmode' ? 'block' : 'none';
    if (gazePane) gazePane.style.display = state.settingsTab === 'gaze' ? 'block' : 'none';
    if (layoutPane) layoutPane.style.display = state.settingsTab === 'layout' ? 'block' : 'none';
    
    if (state.settingsTab === 'layers') {
        renderLayersSettings();
    } else if (state.settingsTab === 'modalities') {
        renderModalitiesSettings();
    } else if (state.settingsTab === 'gaze') {
        updateGazeStats();
    }
}

function renderLayersSettings() {
    const container = document.getElementById('layers-list');
    if (!container) return;
    
    container.innerHTML = '';
    
    state.layers.forEach((layer, idx) => {
        const div = document.createElement('div');
        div.className = 'layer-editor';
        div.innerHTML = `
            <div class="layer-header">
                <input type="color" value="${layer.color}" onchange="updateLayerColor('${layer.id}', this.value)">
                <input type="text" value="${layer.name}" onchange="updateLayerName('${layer.id}', this.value)">
                ${idx >= 3 ? `<button onclick="deleteLayer('${layer.id}')">🗑</button>` : ''}
            </div>
            <div class="layer-types">
                ${layer.types.map(t => `
                    <div class="type-row">
                        <input type="color" value="${t.color}" onchange="updateTypeColor('${layer.id}', ${t.id}, this.value)">
                        <span>${t.id}.</span>
                        <input type="text" value="${t.name}" onchange="updateTypeName('${layer.id}', ${t.id}, this.value)">
                        <button onclick="deleteType('${layer.id}', ${t.id})">×</button>
                    </div>
                `).join('')}
            </div>
            <button class="add-type-btn" onclick="addType('${layer.id}')">+ Add Type</button>
        `;
        container.appendChild(div);
    });
}

function renderModalitiesSettings() {
    const container = document.getElementById('modalities-list');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (state.modalities.length === 0) {
        container.innerHTML = '<p class="no-modalities-msg">No modalities added yet.</p>';
        return;
    }
    
    state.modalities.forEach(mod => {
        const div = document.createElement('div');
        div.className = 'modality-editor';
        
        const icon = mod.type === 'video' ? '📹' :
                     mod.type === 'overlay-gaze' ? '👁' :
                     mod.type === 'overlay-heatmap' ? '🔥' : '📊';
        
        div.innerHTML = `
            <div class="modality-editor-header">
                <span>${icon}</span>
                <input type="text" value="${mod.name}" onchange="updateModalityName('${mod.id}', this.value)">
                ${mod.type === 'video' && !mod.isMaster ? `<button onclick="setMasterModality('${mod.id}')" class="btn-sm">Set Master</button>` : ''}
                ${mod.isMaster ? '<span class="master-badge">Master</span>' : ''}
                <button onclick="deleteModality('${mod.id}')" class="btn-danger-sm">🗑</button>
            </div>
            <div class="modality-editor-body">
                <label>Offset: <input type="number" value="${mod.offsetMs}" onchange="updateModalityOffset('${mod.id}', parseInt(this.value))"> ms</label>
                ${mod.type.startsWith('overlay-') ? `
                    <label>X Column: <input type="number" value="${mod.gazeXColumn || 1}" onchange="updateOverlayColumn('${mod.id}', 'gazeXColumn', parseInt(this.value))"></label>
                    <label>Y Column: <input type="number" value="${mod.gazeYColumn || 2}" onchange="updateOverlayColumn('${mod.id}', 'gazeYColumn', parseInt(this.value))"></label>
                    <label>Coord System: 
                        <select onchange="updateOverlayCoordSystem('${mod.id}', this.value)">
                            <option value="normalized" ${mod.coordinateSystem === 'normalized' ? 'selected' : ''}>Normalized (0-1)</option>
                            <option value="pixel" ${mod.coordinateSystem === 'pixel' ? 'selected' : ''}>Pixel</option>
                        </select>
                    </label>
                ` : ''}
            </div>
        `;
        container.appendChild(div);
    });
}

// Layer CRUD (exposed to window for onclick)
window.updateLayerColor = (id, color) => { const l = state.layers.find(x => x.id === id); if (l) { l.color = color; saveLayers(); } };
window.updateLayerName = (id, name) => { const l = state.layers.find(x => x.id === id); if (l) { l.name = name; saveLayers(); renderAll(); } };
window.deleteLayer = (id) => { state.layers = state.layers.filter(l => l.id !== id); saveLayers(); renderAll(); };
window.updateTypeColor = (layerId, typeId, color) => { const l = state.layers.find(x => x.id === layerId); const t = l?.types.find(x => x.id === typeId); if (t) { t.color = color; saveLayers(); } };
window.updateTypeName = (layerId, typeId, name) => { const l = state.layers.find(x => x.id === layerId); const t = l?.types.find(x => x.id === typeId); if (t) { t.name = name; saveLayers(); } };
window.deleteType = (layerId, typeId) => { const l = state.layers.find(x => x.id === layerId); if (l) { l.types = l.types.filter(t => t.id !== typeId); saveLayers(); renderSettings(); } };
window.addType = (layerId) => { const l = state.layers.find(x => x.id === layerId); if (l) { const maxId = Math.max(0, ...l.types.map(t => t.id)); l.types.push({ id: maxId + 1, name: 'New Type', color: l.color }); saveLayers(); renderSettings(); } };

function handleAddLayer() {
    const name = prompt('Layer name:');
    if (name) {
        const newLayerId = 'layer_' + Date.now();
        state.layers.push({
            id: newLayerId,
            name,
            shortcut: name[0].toLowerCase(),
            color: '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0'),
            types: [{ id: 1, name: 'Type 1', color: '#888888' }]
        });
        // Initialize annotations array for the new layer
        state.annotations[newLayerId] = [];
        saveLayers();
        renderAll();
    }
}

// Modality CRUD (exposed to window)
window.updateModalityName = (id, name) => { const m = state.modalities.find(x => x.id === id); if (m) m.name = name; };
window.updateModalityOffset = updateModalityOffset;
window.setMasterModality = setMasterModality;
window.deleteModality = deleteModality;
window.toggleOverlay = toggleOverlay;
window.updateOverlayColumn = (id, col, val) => { const m = state.modalities.find(x => x.id === id); if (m) m[col] = val; };
window.updateOverlayCoordSystem = (id, val) => { const m = state.modalities.find(x => x.id === id); if (m) m.coordinateSystem = val; };
window.toggleModalitySettings = (id) => { /* TODO: inline expand */ };

// ============================================
// Keyboard
// ============================================

function handleKeyPress(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (state.settingsOpen) return;
    
    switch (e.key.toLowerCase()) {
        case ' ':
            e.preventDefault();
            togglePlayPause();
            break;
        case 'arrowleft':
            e.preventDefault();
            stepFrame(-1);
            break;
        case 'arrowright':
            e.preventDefault();
            stepFrame(1);
            break;
        case 's':
            e.preventDefault();
            if (state.annotationMode === 'range') startAnnotation();
            break;
        case 'e':
            e.preventDefault();
            if (state.annotationMode === 'range') endAnnotation();
            break;
        case 'm':
            e.preventDefault();
            if (state.annotationMode === 'pin') pinAnnotation();
            break;
        default:
            const num = parseInt(e.key);
            if (!isNaN(num) && num > 0) {
                const layer = state.layers.find(l => l.id === state.activeLayerId);
                const type = layer?.types.find(t => t.id === num);
                if (type) {
                    state.selectedType = type;
                    renderAnnotationTypes();
                    updateAnnotationControls();
                }
            }
    }
}

// ============================================
// Export
// ============================================

function exportAnnotations() {
    const modal = document.getElementById('export-modal');
    if (!modal) return;
    
    const master = state.modalities.find(m => m.id === state.masterModalityId);
    const videoName = master?.name || 'unknown';
    
    // Populate source path input with saved path or fallback to video name
    const pathInput = document.getElementById('export-source-path');
    if (pathInput) {
        pathInput.value = state.exportSourcePath || videoName;
        pathInput.oninput = () => {
            state.exportSourcePath = pathInput.value;
            refreshExportChips();
        };
    }
    
    refreshExportChips();
    
    // Clear custom name
    document.getElementById('export-custom-name').value = '';
    
    // Default to JSON
    document.querySelector('input[name="export-format"][value="json"]').checked = true;
    
    updateExportPreview();
    modal.style.display = 'flex';
    
    // Wire events
    const closeBtn = document.getElementById('export-modal-close');
    const cancelBtn = document.getElementById('export-cancel-btn');
    const confirmBtn = document.getElementById('export-confirm-btn');
    const customInput = document.getElementById('export-custom-name');
    
    const closeModal = () => modal.style.display = 'none';
    
    closeBtn.onclick = closeModal;
    cancelBtn.onclick = closeModal;
    confirmBtn.onclick = () => { performExport(); closeModal(); };
    customInput.oninput = updateExportPreview;
    
    // Format radio change
    document.querySelectorAll('input[name="export-format"]').forEach(r => {
        r.onchange = updateExportPreview;
    });
}

function refreshExportChips() {
    const pathInput = document.getElementById('export-source-path');
    const sourcePath = pathInput?.value || '';
    
    // Tokenize by path separators, underscores, hyphens, spaces, dots (but keep meaningful tokens)
    const segments = sourcePath
        .replace(/\.[^.]+$/, '') // strip file extension
        .split(/[\/\\]+/)       // split by path separators
        .filter(s => s.length > 0);
    
    const chipsContainer = document.getElementById('export-path-chips');
    chipsContainer.innerHTML = '';
    
    segments.forEach((seg, i) => {
        const chip = document.createElement('span');
        // Only activate the last 2 segments by default (likely the most relevant)
        chip.className = 'export-chip' + (i >= segments.length - 2 ? ' active' : '');
        chip.textContent = seg;
        chip.dataset.index = i;
        chip.addEventListener('click', () => {
            chip.classList.toggle('active');
            updateExportPreview();
        });
        chipsContainer.appendChild(chip);
    });
    
    // Also add annotator as a chip if set
    if (state.annotatorName) {
        const chip = document.createElement('span');
        chip.className = 'export-chip active';
        chip.textContent = state.annotatorName;
        chip.dataset.index = 'annotator';
        chip.addEventListener('click', () => {
            chip.classList.toggle('active');
            updateExportPreview();
        });
        chipsContainer.appendChild(chip);
    }
    
    updateExportPreview();
}

function getExportFilename() {
    const customName = document.getElementById('export-custom-name')?.value.trim();
    const format = document.querySelector('input[name="export-format"]:checked')?.value || 'json';
    
    if (customName) {
        // Use custom name, ensure correct extension
        const base = customName.replace(/\.(json|csv)$/i, '');
        return `${base}.${format}`;
    }
    
    // Build from active chips
    const chips = document.querySelectorAll('#export-path-chips .export-chip.active');
    const parts = Array.from(chips).map(c => c.textContent);
    
    if (parts.length === 0) {
        return `nova_export.${format}`;
    }
    
    return `nova_${parts.join('_')}.${format}`;
}

function updateExportPreview() {
    const preview = document.getElementById('export-preview');
    if (preview) {
        preview.textContent = getExportFilename();
    }
}

function performExport() {
    const filename = getExportFilename();
    const format = document.querySelector('input[name="export-format"]:checked')?.value || 'json';
    
    if (format === 'csv') {
        exportAnnotationsCSV(filename);
    } else {
        exportAnnotationsJSON(filename);
    }
}

function exportAnnotationsJSON(filename) {
    const master = state.modalities.find(m => m.id === state.masterModalityId);
    
    const data = {
        meta: {
            tool: 'NOVA',
            version: '0.2',
            exportedAt: new Date().toISOString(),
            annotator: state.annotatorName,
            masterVideo: master?.name || 'unknown',
        },
        layers: state.layers,
        modalities: state.modalities.map(m => ({
            id: m.id,
            type: m.type,
            name: m.name,
            offsetMs: m.offsetMs,
            isMaster: m.isMaster,
            parentVideoId: m.parentVideoId,
        })),
        annotations: state.annotations,
    };
    
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || 'nova_export.json';
    a.click();
    URL.revokeObjectURL(url);
}

// ============================================
// Import Annotations (JSON)
// ============================================

function importAnnotationsJSON(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (evt) => {
        try {
            const data = JSON.parse(evt.target.result);
            
            // Import layers if present
            if (data.layers && Array.isArray(data.layers)) {
                state.layers = data.layers;
                // Ensure annotations arrays exist for each layer
                state.layers.forEach(l => {
                    if (!state.annotations[l.id]) state.annotations[l.id] = [];
                });
            }
            
            // Import annotations
            if (data.annotations) {
                Object.keys(data.annotations).forEach(layerId => {
                    state.annotations[layerId] = data.annotations[layerId];
                });
            }
            
            // Import annotator name if present
            if (data.meta?.annotator) {
                state.annotatorName = data.meta.annotator;
                const nameEl = document.getElementById('annotator-name');
                if (nameEl) nameEl.value = data.meta.annotator;
            }
            
            renderSettings();
            renderAnnotationsList();
            renderTimelines();
            updateAnnotationControls();
            showNotification(`Imported annotations from ${file.name}`);
        } catch (err) {
            alert('Failed to parse annotation file: ' + err.message);
        }
    };
    reader.readAsText(file);
    e.target.value = '';
}

// ============================================
// CSV Export / Import
// ============================================

function exportAnnotationsCSV(filename) {
    const allAnnotations = [];
    state.layers.forEach(layer => {
        (state.annotations[layer.id] || []).forEach(ann => {
            allAnnotations.push({
                layer: layer.name,
                label: ann.typeName,
                start_s: ann.startTime.toFixed(3),
                end_s: ann.endTime.toFixed(3),
                comment: ann.comment || '',
            });
        });
    });
    
    if (allAnnotations.length === 0) {
        showNotification('No annotations to export');
        return;
    }
    
    const header = 'layer,label,start_s,end_s,comment';
    const rows = allAnnotations.map(a => 
        `${csvEscape(a.layer)},${csvEscape(a.label)},${a.start_s},${a.end_s},${csvEscape(a.comment)}`
    );
    const csv = [header, ...rows].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || 'nova_export.csv';
    a.click();
    URL.revokeObjectURL(url);
}

function csvEscape(value) {
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
}

function importAnnotationsCSV(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (evt) => {
        try {
            const text = evt.target.result;
            const lines = text.trim().split('\n');
            if (lines.length < 2) {
                alert('CSV file is empty or has no data rows');
                return;
            }
            
            // Parse header
            const header = lines[0].toLowerCase().split(',').map(h => h.trim());
            const layerIdx = header.indexOf('layer');
            const labelIdx = header.indexOf('label');
            const startIdx = header.indexOf('start_s');
            const endIdx = header.indexOf('end_s');
            const commentIdx = header.indexOf('comment');
            
            if (labelIdx === -1 || startIdx === -1 || endIdx === -1) {
                alert('CSV must have columns: label, start_s, end_s');
                return;
            }
            
            let imported = 0;
            for (let i = 1; i < lines.length; i++) {
                const cols = parseCSVLine(lines[i]);
                const layerName = layerIdx >= 0 ? cols[layerIdx]?.trim() : null;
                const label = cols[labelIdx]?.trim();
                const startTime = parseFloat(cols[startIdx]);
                const endTime = parseFloat(cols[endIdx]);
                const comment = commentIdx >= 0 ? cols[commentIdx]?.trim() : '';
                
                if (!label || isNaN(startTime) || isNaN(endTime)) continue;
                
                // Find matching layer and type
                let targetLayer = null;
                let targetType = null;
                
                for (const layer of state.layers) {
                    if (layerName && layer.name !== layerName) continue;
                    const type = layer.types.find(t => t.name === label);
                    if (type) {
                        targetLayer = layer;
                        targetType = type;
                        break;
                    }
                }
                
                if (!targetLayer || !targetType) continue;
                
                if (!state.annotations[targetLayer.id]) {
                    state.annotations[targetLayer.id] = [];
                }
                
                state.annotations[targetLayer.id].push({
                    id: Date.now() + i,
                    typeId: targetType.id,
                    typeName: targetType.name,
                    startTime,
                    endTime,
                    layerId: targetLayer.id,
                    comment: comment || undefined,
                });
                imported++;
            }
            
            // Sort all layers
            state.layers.forEach(l => {
                if (state.annotations[l.id]) {
                    state.annotations[l.id].sort((a, b) => a.startTime - b.startTime);
                }
            });
            
            renderAnnotationsList();
            renderTimelines();
            showNotification(`Imported ${imported} annotations from CSV`);
        } catch (err) {
            alert('Failed to parse CSV: ' + err.message);
        }
    };
    reader.readAsText(file);
    e.target.value = '';
}

function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inQuotes) {
            if (ch === '"' && line[i + 1] === '"') {
                current += '"';
                i++;
            } else if (ch === '"') {
                inQuotes = false;
            } else {
                current += ch;
            }
        } else {
            if (ch === '"') {
                inQuotes = true;
            } else if (ch === ',') {
                result.push(current);
                current = '';
            } else {
                current += ch;
            }
        }
    }
    result.push(current);
    return result;
}

// ============================================
// Layers Import / Export
// ============================================

function exportLayersJSON() {
    const json = JSON.stringify(state.layers, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'nova_layers.json';
    a.click();
    URL.revokeObjectURL(url);
}

function importLayersJSON(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (evt) => {
        try {
            const layers = JSON.parse(evt.target.result);
            if (!Array.isArray(layers)) {
                alert('Layer file must contain a JSON array');
                return;
            }
            
            state.layers = layers;
            state.layers.forEach(l => {
                if (!state.annotations[l.id]) state.annotations[l.id] = [];
            });
            
            // Set first layer as active
            if (state.layers.length > 0) {
                state.activeLayerId = state.layers[0].id;
            }
            
            renderSettings();
            renderAnnotationsList();
            renderTimelines();
            updateAnnotationControls();
            showNotification(`Imported ${layers.length} layers from ${file.name}`);
        } catch (err) {
            alert('Failed to parse layers file: ' + err.message);
        }
    };
    reader.readAsText(file);
    e.target.value = '';
}

// ============================================
// Mute & Volume
// ============================================

function toggleMute() {
    const videos = document.querySelectorAll('video');
    const btn = document.getElementById('mute-btn');
    const slider = document.getElementById('volume-slider');
    
    if (videos.length === 0) return;
    
    const isMuted = videos[0].muted;
    videos.forEach(v => v.muted = !isMuted);
    
    if (btn) btn.textContent = isMuted ? '🔊' : '🔇';
    if (slider && !isMuted) slider.value = 0;
    if (slider && isMuted) slider.value = videos[0].volume;
}

function handleVolumeChange(e) {
    const volume = parseFloat(e.target.value);
    const videos = document.querySelectorAll('video');
    const btn = document.getElementById('mute-btn');
    
    videos.forEach(v => {
        v.volume = volume;
        v.muted = volume === 0;
    });
    
    if (btn) {
        if (volume === 0) btn.textContent = '🔇';
        else if (volume < 0.5) btn.textContent = '🔉';
        else btn.textContent = '🔊';
    }
}

// ============================================
// Annotation Edit (inline form)
// ============================================

function editAnnotation(layerId, annId) {
    const anns = state.annotations[layerId];
    if (!anns) return;
    const ann = anns.find(a => a.id === annId);
    if (!ann) return;
    
    const layer = state.layers.find(l => l.id === layerId);
    if (!layer) return;
    
    const container = document.getElementById('annotations-list');
    if (!container) return;
    
    // Find the annotation item element
    const items = container.querySelectorAll('.annotation-item');
    let targetItem = null;
    items.forEach(item => {
        if (item.dataset.annId == annId) targetItem = item;
    });
    
    // Check if edit form already exists
    const existing = document.getElementById('edit-form-' + annId);
    if (existing) {
        existing.remove();
        return;
    }
    
    const form = document.createElement('div');
    form.className = 'annotation-edit-form';
    form.id = 'edit-form-' + annId;
    
    const typeOptions = layer.types.map(t => 
        `<option value="${t.id}" ${t.id === ann.typeId ? 'selected' : ''}>${t.name}</option>`
    ).join('');
    
    form.innerHTML = `
        <label>Label</label>
        <select id="edit-type-${annId}">${typeOptions}</select>
        <label>Start (seconds)</label>
        <input type="number" id="edit-start-${annId}" value="${ann.startTime.toFixed(3)}" step="0.001">
        <label>End (seconds)</label>
        <input type="number" id="edit-end-${annId}" value="${ann.endTime.toFixed(3)}" step="0.001">
        <label>Comment</label>
        <textarea id="edit-comment-${annId}" placeholder="Add a note...">${ann.comment || ''}</textarea>
        <div class="edit-form-actions">
            <button class="btn btn-sm btn-primary" onclick="saveAnnotationEdit('${layerId}', ${annId})">Save</button>
            <button class="btn btn-sm" onclick="document.getElementById('edit-form-${annId}')?.remove()">Cancel</button>
        </div>
    `;
    
    if (targetItem) {
        targetItem.after(form);
    } else {
        container.appendChild(form);
    }
}

function saveAnnotationEdit(layerId, annId) {
    const anns = state.annotations[layerId];
    if (!anns) return;
    const ann = anns.find(a => a.id === annId);
    if (!ann) return;
    
    const layer = state.layers.find(l => l.id === layerId);
    if (!layer) return;
    
    const typeSelect = document.getElementById('edit-type-' + annId);
    const startInput = document.getElementById('edit-start-' + annId);
    const endInput = document.getElementById('edit-end-' + annId);
    const commentInput = document.getElementById('edit-comment-' + annId);
    
    if (typeSelect) {
        const newType = layer.types.find(t => t.id === typeSelect.value);
        if (newType) {
            ann.typeId = newType.id;
            ann.typeName = newType.name;
        }
    }
    
    if (startInput) ann.startTime = parseFloat(startInput.value);
    if (endInput) ann.endTime = parseFloat(endInput.value);
    if (commentInput) ann.comment = commentInput.value.trim() || undefined;
    
    // Re-sort
    anns.sort((a, b) => a.startTime - b.startTime);
    
    renderAnnotationsList();
    renderTimelines();
}

// ============================================
// Utilities
// ============================================

function formatTime(ms) {
    const s = ms / 1000;
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${sec.toFixed(3).padStart(6,'0')}`;
}

// ============================================
// Start
// ============================================

document.addEventListener('DOMContentLoaded', init);
