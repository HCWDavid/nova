/**
 * NOVA v0.2 - Nursing Operational View of Actions
 * Multi-Modal Video Annotation Tool
 * 
 * Phase 1: Multi-Video Support
 * Phase 3: Overlay Modalities (Gaze, Heatmap)
 * TODO: 
 * - add mute
 * - add volume control
 * - add comments 
 * - add editable timestamp tool = annotations 
 * - add export annotations to csv
 * - add import annotations from csv
 * - unit test and consistent 
 * - scoping into two minuates from 15 mins
 * - change layers => tracks
 * - mechanism: refresh page prevention while its not 'exported' 
 * - having only 'start-end' button for 1 frame instead of two buttons (like a button call "mark this frame" or something)
 * 
 * FIXED:
 * - [x] adding a new layer didn't work with the new layer annotation (v0.2.1 - initialized annotations array for new layers)
 * 
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
        { id: 1, name: 'Perform hand hygiene (sanitizer)', color: '#a29bfe' },
        { id: 2, name: 'Put on gloves', color: '#fd79a8' },
        { id: 3, name: 'Check patient\'s wristband', color: '#e17055' },
        { id: 4, name: 'Check Patient History Screen', color: '#00cec9' },
        { id: 5, name: 'Examine Med Bottle', color: '#6c5ce7' },
        { id: 6, name: 'Review vital signs screen', color: '#fdcb6e' },
        { id: 7, name: 'Assess vital signs (touch patient\'s wrist)', color: '#e84393' },
        { id: 8, name: 'Auscultate Lung Sounds', color: '#0984e3' },
        { id: 9, name: 'Measure Apical Pulse', color: '#2d98da' },
        { id: 10, name: 'Measure temperature', color: '#d63031' },
        { id: 11, name: 'Measure blood pressure', color: '#55a3ff' },
        { id: 12, name: 'Writing', color: '#81ecec' },
        { id: 13, name: 'Use Calculator', color: '#fab1a0' },
        { id: 14, name: 'Check Phone', color: '#ffeaa7' },
        { id: 15, name: 'Prepare medication', color: '#74b9ff' },
        { id: 16, name: 'Apply medication to patient', color: '#a29bfe' },
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
    document.getElementById('frame-back-btn')?.addEventListener('click', () => stepFrame(-1));
    document.getElementById('frame-forward-btn')?.addEventListener('click', () => stepFrame(1));
    document.getElementById('playback-speed')?.addEventListener('change', handleSpeedChange);
    document.getElementById('seek-slider')?.addEventListener('input', handleSeek);
    
    // Annotation
    document.getElementById('start-annotation-btn')?.addEventListener('click', startAnnotation);
    document.getElementById('end-annotation-btn')?.addEventListener('click', endAnnotation);
    
    // Export
    document.getElementById('export-btn')?.addEventListener('click', exportAnnotations);
    
    // Annotator name
    document.getElementById('annotator-name')?.addEventListener('change', (e) => {
        state.annotatorName = e.target.value;
        localStorage.setItem('nova_annotator_name', e.target.value);
    });
    
    // Keyboard
    document.addEventListener('keydown', handleKeyPress);
    window.addEventListener('resize', () => requestAnimationFrame(renderTimelines));
    
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
            
            // Redraw timelines
            requestAnimationFrame(renderTimelines);
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
    
    // Load saved height
    const savedHeight = localStorage.getItem('nova_annotations_height');
    if (savedHeight) {
        listContainer.style.height = savedHeight + 'px';
        listContainer.style.flex = 'none';
    }
    
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
        const newHeight = Math.min(400, Math.max(100, startHeight + diff));
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
        
        // Size canvas immediately if video already loaded
        if (videoEl.videoWidth > 0) {
            canvas.width = videoEl.videoWidth;
            canvas.height = videoEl.videoHeight;
            console.log(`Canvas immediately sized: ${canvas.width}x${canvas.height}`);
        } else {
            // Fallback: size to container after a short delay
            setTimeout(() => {
                if (canvas.width === 0 && videoContainer.clientWidth > 0) {
                    canvas.width = videoContainer.clientWidth;
                    canvas.height = videoContainer.clientHeight;
                    console.log(`Canvas fallback sized: ${canvas.width}x${canvas.height}`);
                }
            }, 500);
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
        console.log('No gaze data to render');
        return;
    }
    
    if (canvas.width === 0 || canvas.height === 0) {
        console.log('Canvas has no size, skipping render');
        return;
    }
    
    // Video time in ms
    const videoTimeMs = state.currentTime + video.offsetMs + overlay.offsetMs;
    // Convert to seconds for Tobii data
    const videoTimeSec = overlay.timestampUnit === 's' ? videoTimeMs / 1000 : videoTimeMs;

    
    // Binary search to find closest point (data is sorted by timestamp)
    let closestIdx = 0;
    let closestDiff = Infinity;
    
    for (let i = 0; i < overlay.data.length; i++) {
        const point = overlay.data[i];
        const timestamp = point.timestamp !== undefined ? point.timestamp : point[0];
        
        const diff = Math.abs(timestamp - videoTimeSec);
        if (diff < closestDiff) {
            closestDiff = diff;
            closestIdx = i;
        }
        
        // Early exit if we've passed the time
        if (timestamp > videoTimeSec && diff > closestDiff) break;
    }
    
    // Draw trail + current point
    // Calculate actual video display area (accounting for object-fit: contain)
    const videoEl = document.getElementById('video-' + video.id);
    let videoDisplayX = 0, videoDisplayY = 0, videoDisplayW = canvas.width, videoDisplayH = canvas.height;
    
    if (videoEl && videoEl.videoWidth > 0) {
        const videoAspect = videoEl.videoWidth / videoEl.videoHeight;
        const canvasAspect = canvas.width / canvas.height;
        
        if (videoAspect > canvasAspect) {
            // Video is wider than canvas - letterbox top/bottom
            videoDisplayW = canvas.width;
            videoDisplayH = canvas.width / videoAspect;
            videoDisplayY = (canvas.height - videoDisplayH) / 2;
        } else {
            // Video is taller than canvas - pillarbox left/right
            videoDisplayH = canvas.height;
            videoDisplayW = canvas.height * videoAspect;
            videoDisplayX = (canvas.width - videoDisplayW) / 2;
        }
    }
    
    // DEBUG: Draw video area boundary (remove after verification)
    ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
    ctx.lineWidth = 2;
    ctx.strokeRect(videoDisplayX, videoDisplayY, videoDisplayW, videoDisplayH);
    
    for (let i = Math.max(0, closestIdx - overlay.trailLength); i <= closestIdx; i++) {
        const point = overlay.data[i];
        if (!point) continue;
        
        // Support both object format {x, y} and array format [ts, x, y]
        let x = point.x !== undefined ? point.x : point[overlay.gazeXColumn || 1];
        let y = point.y !== undefined ? point.y : point[overlay.gazeYColumn || 2];
        
        if (x === undefined || y === undefined || isNaN(x) || isNaN(y)) continue;
        
        // Convert normalized coords to canvas pixels (within actual video display area)
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
    state.layers.forEach(layer => {
        (state.annotations[layer.id] || []).forEach(ann => {
            const type = layer.types.find(t => t.id === ann.typeId);
            allAnnotations.push({ ...ann, layerId: layer.id, color: type?.color || layer.color });
        });
    });
    allAnnotations.sort((a, b) => a.startTime - b.startTime);
    
    if (countEl) countEl.textContent = `(${allAnnotations.length})`;
    
    allAnnotations.forEach(ann => {
        const div = document.createElement('div');
        div.className = 'annotation-item';
        div.innerHTML = `
            <span class="item-color" style="background: ${ann.color}"></span>
            <div class="item-info">
                <div class="item-name">${ann.typeName}</div>
                <div class="item-time">${formatTime(ann.startTime * 1000)} → ${formatTime(ann.endTime * 1000)}</div>
            </div>
            <button class="delete-btn" title="Delete">×</button>
        `;
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
    const layoutPane = document.getElementById('layout-settings');
    
    if (layersPane) layersPane.style.display = state.settingsTab === 'layers' ? 'block' : 'none';
    if (modalitiesPane) modalitiesPane.style.display = state.settingsTab === 'modalities' ? 'block' : 'none';
    if (pinmodePane) pinmodePane.style.display = state.settingsTab === 'pinmode' ? 'block' : 'none';
    if (layoutPane) layoutPane.style.display = state.settingsTab === 'layout' ? 'block' : 'none';
    
    if (state.settingsTab === 'layers') {
        renderLayersSettings();
    } else if (state.settingsTab === 'modalities') {
        renderModalitiesSettings();
    }
    // Layout and Pin Mode tabs are static HTML, no dynamic rendering needed
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
    a.download = `nova_${master?.name || 'annotations'}_${state.annotatorName || 'anon'}.json`;
    a.click();
    URL.revokeObjectURL(url);
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
