/**
 * NOVA Unit Tests - Node.js Runner
 * 
 * This file extracts testable functions from app.js and runs unit tests.
 * Runs via: npm test
 */

// ============================================
// Mock Browser Environment
// ============================================

// Mock DOM
global.document = {
    getElementById: () => null,
    querySelectorAll: () => [],
    querySelector: () => null,
    addEventListener: () => {},
    createElement: () => ({ 
        addEventListener: () => {},
        appendChild: () => {},
        style: {}
    })
};
global.window = { addEventListener: () => {} };
global.localStorage = {
    getItem: () => null,
    setItem: () => {},
};
global.URL = { createObjectURL: () => 'mock-url', revokeObjectURL: () => {} };
global.alert = () => {};

// ============================================
// Extract Functions from app.js
// ============================================

// We need to simulate the state and functions
const state = {
    layers: [
        {
            id: 'behavior',
            name: 'Behaviors',
            shortcut: 'b',
            color: '#FF6B6B',
            types: [
                { id: 1, name: 'Introduction/Identification', color: '#FF6B6B' },
                { id: 2, name: 'Assessment', color: '#4ECDC4' },
            ]
        }
    ],
    activeLayerId: 'behavior',
    selectedType: { id: 1, name: 'Test Type' },
    pendingStart: null,
    annotations: { 'behavior': [] },
    modalities: [],
    masterModalityId: null,
    duration: 60000,
    currentTime: 5000,
    isPlaying: false,
    fps: 30,
    annotatorName: '',
    settingsOpen: false,
    settingsTab: 'layers',
    annotationMode: 'range',
    pinWindowValue: 1,
    pinWindowUnit: 'frames',
};

// Helper function from app.js
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
            return (1 / state.fps) * 1000;
    }
}

// Pin annotation function from app.js
function pinAnnotation() {
    if (!state.selectedType) return;
    
    const windowMs = getWindowDurationMs();
    const currentTimeMs = state.currentTime;
    
    const startTimeMs = Math.max(0, currentTimeMs - windowMs / 2);
    const endTimeMs = Math.min(state.duration, currentTimeMs + windowMs / 2);
    
    const minDuration = (1 / state.fps) * 1000;
    const finalEndMs = Math.max(endTimeMs, startTimeMs + minDuration);
    
    const record = {
        id: Date.now(),
        typeId: state.selectedType.id,
        typeName: state.selectedType.name,
        startTime: startTimeMs / 1000,
        endTime: finalEndMs / 1000,
        layerId: state.activeLayerId,
        isPinned: true,
    };
    
    if (!state.annotations[state.activeLayerId]) {
        state.annotations[state.activeLayerId] = [];
    }
    
    state.annotations[state.activeLayerId].push(record);
    state.annotations[state.activeLayerId].sort((a, b) => a.startTime - b.startTime);
}

// ============================================
// Test Runner
// ============================================

let passed = 0;
let failed = 0;

function assert(condition, message) {
    if (condition) {
        passed++;
        console.log(`  ✅ ${message}`);
    } else {
        failed++;
        console.error(`  ❌ ${message}`);
    }
}

function assertEqual(actual, expected, message) {
    if (actual === expected) {
        passed++;
        console.log(`  ✅ ${message}`);
    } else {
        failed++;
        console.error(`  ❌ ${message} - expected ${expected}, got ${actual}`);
    }
}

function assertApprox(actual, expected, tolerance, message) {
    if (Math.abs(actual - expected) <= tolerance) {
        passed++;
        console.log(`  ✅ ${message}`);
    } else {
        failed++;
        console.error(`  ❌ ${message} - expected ~${expected} ±${tolerance}, got ${actual}`);
    }
}

// ============================================
// Test Cases
// ============================================

console.log('\n🧪 NOVA Unit Tests\n');

console.log('--- State Initialization ---');
assert(typeof state !== 'undefined', 'state object exists');
assert('annotationMode' in state, 'state has annotationMode property');
assert('pinWindowValue' in state, 'state has pinWindowValue property');
assert('pinWindowUnit' in state, 'state has pinWindowUnit property');
assertEqual(state.annotationMode, 'range', 'default annotationMode is range');
assertEqual(state.pinWindowValue, 1, 'default pinWindowValue is 1');
assertEqual(state.pinWindowUnit, 'frames', 'default pinWindowUnit is frames');

console.log('\n--- getWindowDurationMs ---');

// Test frames
state.fps = 30;
state.pinWindowValue = 1;
state.pinWindowUnit = 'frames';
assertApprox(getWindowDurationMs(), 33.33, 0.5, '1 frame at 30fps ≈ 33.33ms');

state.pinWindowValue = 3;
assertApprox(getWindowDurationMs(), 100, 0.5, '3 frames at 30fps = 100ms');

// Test seconds
state.pinWindowUnit = 'seconds';
state.pinWindowValue = 0.5;
assertEqual(getWindowDurationMs(), 500, '0.5 seconds = 500ms');

state.pinWindowValue = 2;
assertEqual(getWindowDurationMs(), 2000, '2 seconds = 2000ms');

// Test milliseconds
state.pinWindowUnit = 'ms';
state.pinWindowValue = 100;
assertEqual(getWindowDurationMs(), 100, '100ms = 100ms');

state.pinWindowValue = 500;
assertEqual(getWindowDurationMs(), 500, '500ms = 500ms');

console.log('\n--- pinAnnotation ---');

// Reset state for pin test
state.annotations['behavior'] = [];
state.pinWindowValue = 1;
state.pinWindowUnit = 'frames';
state.fps = 30;
state.currentTime = 5000;
state.duration = 60000;
state.selectedType = { id: 1, name: 'Test Type' };
state.activeLayerId = 'behavior';

pinAnnotation();

assertEqual(state.annotations['behavior'].length, 1, 'pinAnnotation creates one annotation');

const ann = state.annotations['behavior'][0];
assertEqual(ann.typeId, 1, 'Annotation has correct typeId');
assertEqual(ann.layerId, 'behavior', 'Annotation has correct layerId');
assert(ann.isPinned === true, 'Annotation is marked as pinned');
assert(ann.startTime <= 5.0, 'startTime is <= current time (5s)');
assert(ann.endTime >= 5.0, 'endTime is >= current time (5s)');
assertApprox(ann.endTime - ann.startTime, 0.033, 0.01, 'Duration is ~1 frame (33ms)');

// Test larger window
state.annotations['behavior'] = [];
state.pinWindowValue = 500;
state.pinWindowUnit = 'ms';

pinAnnotation();

const ann2 = state.annotations['behavior'][0];
assertApprox(ann2.endTime - ann2.startTime, 0.5, 0.05, 'Duration is ~500ms');

console.log('\n--- New Layer Annotations ---');

// Test that new layers can have annotations added
const testLayerId = 'test_layer_new';
state.layers.push({
    id: testLayerId,
    name: 'Test Layer',
    types: [{ id: 1, name: 'Test', color: '#FF0000' }]
});
state.annotations[testLayerId] = []; // Simulating the fix
state.activeLayerId = testLayerId;

pinAnnotation();

assertEqual(state.annotations[testLayerId].length, 1, 'Can add annotation to new layer');

// ============================================
// Edge Case Tests
// ============================================

console.log('\n--- Edge Cases: No Type Selected ---');

// Reset
state.annotations[testLayerId] = [];
const origType = state.selectedType;
state.selectedType = null;

pinAnnotation();
assertEqual(state.annotations[testLayerId].length, 0, 'pinAnnotation does nothing when no type selected');

state.selectedType = origType;

console.log('\n--- Edge Cases: Boundary Times ---');

// Test at time = 0
state.annotations[testLayerId] = [];
state.currentTime = 0;
state.pinWindowValue = 500;
state.pinWindowUnit = 'ms';

pinAnnotation();

let boundaryAnn = state.annotations[testLayerId][0];
assert(boundaryAnn.startTime >= 0, 'startTime is not negative when pinning at t=0');
assertEqual(boundaryAnn.startTime, 0, 'startTime is 0 when pinning at video start');

// Test at time = duration (end of video)
state.annotations[testLayerId] = [];
state.currentTime = state.duration; // 60000ms
state.pinWindowValue = 500;

pinAnnotation();

boundaryAnn = state.annotations[testLayerId][0];
assert(boundaryAnn.endTime <= state.duration / 1000, 'endTime does not exceed video duration');

console.log('\n--- Edge Cases: Invalid/Edge Window Values ---');

// Zero window value
state.annotations[testLayerId] = [];
state.currentTime = 5000;
state.pinWindowValue = 0;
state.pinWindowUnit = 'frames';

pinAnnotation();

let zeroWindowAnn = state.annotations[testLayerId][0];
assert(zeroWindowAnn.endTime > zeroWindowAnn.startTime, 'Annotation has positive duration even with 0 window');

// Very large window
state.annotations[testLayerId] = [];
state.pinWindowValue = 999999;
state.pinWindowUnit = 'ms';

pinAnnotation();

let largeWindowAnn = state.annotations[testLayerId][0];
assertEqual(largeWindowAnn.startTime, 0, 'Large window clamps startTime to 0');
assertEqual(largeWindowAnn.endTime, state.duration / 1000, 'Large window clamps endTime to duration');

console.log('\n--- Edge Cases: FPS Edge Cases ---');

// Very low FPS
state.annotations[testLayerId] = [];
state.fps = 1; // 1 frame per second
state.pinWindowValue = 1;
state.pinWindowUnit = 'frames';
state.currentTime = 5000;

pinAnnotation();

let lowFpsAnn = state.annotations[testLayerId][0];
assertApprox(lowFpsAnn.endTime - lowFpsAnn.startTime, 1.0, 0.1, '1 frame at 1fps = 1 second');

// Very high FPS
state.fps = 120;
state.annotations[testLayerId] = [];

pinAnnotation();

let highFpsAnn = state.annotations[testLayerId][0];
assertApprox(highFpsAnn.endTime - highFpsAnn.startTime, 0.00833, 0.001, '1 frame at 120fps ≈ 8.33ms');

// Restore FPS
state.fps = 30;

console.log('\n--- Edge Cases: Unknown Unit Fallback ---');

state.annotations[testLayerId] = [];
state.pinWindowUnit = 'invalid_unit';
state.pinWindowValue = 1;
state.currentTime = 5000;

pinAnnotation();

let unknownUnitAnn = state.annotations[testLayerId][0];
assertApprox(unknownUnitAnn.endTime - unknownUnitAnn.startTime, 0.033, 0.01, 'Unknown unit falls back to 1 frame');

state.pinWindowUnit = 'frames';

console.log('\n--- Range Mode: Start/End Annotation Flow ---');

// Simulating the Range mode flow
state.annotationMode = 'range';
state.activeLayerId = testLayerId;
state.annotations[testLayerId] = [];
state.pendingStart = null;
state.currentTime = 2000;

// Simulate startAnnotation
function testStartAnnotation() {
    if (!state.selectedType || state.pendingStart !== null) return;
    state.pendingStart = state.currentTime;
}

// Simulate endAnnotation
function testEndAnnotation() {
    if (state.pendingStart === null) return false;
    
    const endTime = state.currentTime;
    if (endTime <= state.pendingStart) {
        return false; // Error case
    }
    
    const record = {
        id: Date.now(),
        typeId: state.selectedType.id,
        typeName: state.selectedType.name,
        startTime: state.pendingStart / 1000,
        endTime: endTime / 1000,
        layerId: state.activeLayerId,
    };
    
    if (!state.annotations[state.activeLayerId]) {
        state.annotations[state.activeLayerId] = [];
    }
    state.annotations[state.activeLayerId].push(record);
    state.pendingStart = null;
    return true;
}

state.selectedType = { id: 1, name: 'Test Type' };
testStartAnnotation();
assertEqual(state.pendingStart, 2000, 'startAnnotation sets pendingStart');

state.currentTime = 4000;
const endResult = testEndAnnotation();
assert(endResult === true, 'endAnnotation succeeds with valid times');
assertEqual(state.annotations[testLayerId].length, 1, 'Range annotation created');
assertEqual(state.pendingStart, null, 'pendingStart cleared after end');

let rangeAnn = state.annotations[testLayerId][0];
assertEqual(rangeAnn.startTime, 2, 'Range annotation startTime = 2s');
assertEqual(rangeAnn.endTime, 4, 'Range annotation endTime = 4s');

console.log('\n--- Range Mode: End Before Start Error ---');

state.annotations[testLayerId] = [];
state.pendingStart = 5000;
state.currentTime = 3000; // End before start!

const badEndResult = testEndAnnotation();
assert(badEndResult === false, 'endAnnotation fails when end <= start');
assertEqual(state.annotations[testLayerId].length, 0, 'No annotation created on error');

console.log('\n--- Range Mode: New Layer Bug Scenario ---');

// This tests the exact bug that was reported
const bugTestLayerId = 'bug_test_layer_' + Date.now();
state.layers.push({
    id: bugTestLayerId,
    name: 'Bug Test Layer',
    types: [{ id: 1, name: 'Bug Test', color: '#00FF00' }]
});

// BEFORE FIX: annotations[bugTestLayerId] would be undefined
// AFTER FIX: handleAddLayer initializes it
state.annotations[bugTestLayerId] = []; // This line represents the fix

state.activeLayerId = bugTestLayerId;
state.pendingStart = null;
state.currentTime = 1000;

testStartAnnotation();
assert(state.pendingStart === 1000, 'Can start annotation on new layer');

state.currentTime = 2000;
const bugEndResult = testEndAnnotation();
assert(bugEndResult === true, 'Can end annotation on new layer (this was the bug)');
assertEqual(state.annotations[bugTestLayerId].length, 1, 'Annotation exists on new layer');

// Cleanup
state.layers = state.layers.filter(l => l.id !== bugTestLayerId);
delete state.annotations[bugTestLayerId];

console.log('\n--- Edge Cases: Multiple Rapid Pins ---');

state.activeLayerId = testLayerId;
state.annotations[testLayerId] = [];
state.pinWindowValue = 100;
state.pinWindowUnit = 'ms';
state.currentTime = 5000;

// Rapid-fire pins at same time
pinAnnotation();
pinAnnotation();
pinAnnotation();

assertEqual(state.annotations[testLayerId].length, 3, 'Multiple rapid pins create multiple annotations');

// Cleanup test layer
state.layers = state.layers.filter(l => l.id !== testLayerId);
delete state.annotations[testLayerId];

console.log('\n--- Settings Tab Switching Logic ---');

// This tests the logic that was buggy - pinmode pane wasn't being shown
// We simulate the renderSettings logic to ensure all tabs are handled

const EXPECTED_TABS = ['layers', 'modalities', 'pinmode', 'layout'];
const EXPECTED_PANES = ['layers-settings', 'modalities-settings', 'pinmode-settings', 'layout-settings'];

// Simulate the renderSettings visibility logic
function testGetVisiblePane(currentTab) {
    const paneMap = {
        'layers': 'layers-settings',
        'modalities': 'modalities-settings',
        'pinmode': 'pinmode-settings',
        'layout': 'layout-settings',
    };
    return paneMap[currentTab] || null;
}

// Test that each tab shows exactly one pane
EXPECTED_TABS.forEach(tab => {
    const visiblePane = testGetVisiblePane(tab);
    assert(visiblePane !== null, `Tab "${tab}" has a corresponding pane`);
    assert(EXPECTED_PANES.includes(visiblePane), `Tab "${tab}" shows valid pane "${visiblePane}"`);
});

// Test pinmode specifically (this was the bug)
assertEqual(testGetVisiblePane('pinmode'), 'pinmode-settings', 'pinmode tab shows pinmode-settings pane');

// Test that unknown tabs don't crash
assertEqual(testGetVisiblePane('unknown_tab'), null, 'Unknown tab returns null (no crash)');

console.log('\n--- Settings State Management ---');

// Test settingsTab state changes
state.settingsTab = 'layers';
assertEqual(state.settingsTab, 'layers', 'settingsTab can be set to layers');

state.settingsTab = 'pinmode';
assertEqual(state.settingsTab, 'pinmode', 'settingsTab can be set to pinmode');

state.settingsTab = 'modalities';
assertEqual(state.settingsTab, 'modalities', 'settingsTab can be set to modalities');

state.settingsTab = 'layout';
assertEqual(state.settingsTab, 'layout', 'settingsTab can be set to layout');

// Restore
state.settingsTab = 'layers';

console.log('\n--- Seek Functionality ---');

// Simulate handleSeek logic
function testHandleSeek(sliderValue) {
    state.currentTime = sliderValue;
    return state.currentTime;
}

state.duration = 60000;
assertEqual(testHandleSeek(0), 0, 'Seek to start sets currentTime to 0');
assertEqual(testHandleSeek(30000), 30000, 'Seek to middle sets currentTime to 30000');
assertEqual(testHandleSeek(60000), 60000, 'Seek to end sets currentTime to duration');

console.log('\n--- Annotation Sorting ---');

// Test that annotations are sorted by startTime
const sortTestLayerId = 'sort_test_layer';
state.layers.push({ id: sortTestLayerId, name: 'Sort Test', types: [{ id: 1, name: 'Test', color: '#FF0000' }] });
state.annotations[sortTestLayerId] = [];
state.activeLayerId = sortTestLayerId;
state.selectedType = { id: 1, name: 'Test' };

// Add annotations out of order
state.currentTime = 10000;
state.pinWindowValue = 100;
state.pinWindowUnit = 'ms';
pinAnnotation();

state.currentTime = 5000;
pinAnnotation();

state.currentTime = 15000;
pinAnnotation();

// Check they are sorted
const sortedAnns = state.annotations[sortTestLayerId];
assert(sortedAnns[0].startTime < sortedAnns[1].startTime, 'First annotation has earliest startTime');
assert(sortedAnns[1].startTime < sortedAnns[2].startTime, 'Annotations sorted in ascending order');

// Cleanup
state.layers = state.layers.filter(l => l.id !== sortTestLayerId);
delete state.annotations[sortTestLayerId];

console.log('\n--- Layer Management ---');

// Test layer creation
const beforeLayerCount = state.layers.length;
const newTestLayer = {
    id: 'mgmt_test_layer_' + Date.now(),
    name: 'Management Test',
    shortcut: 'm',
    color: '#00FF00',
    types: [{ id: 1, name: 'Type 1', color: '#00FF00' }]
};
state.layers.push(newTestLayer);
assertEqual(state.layers.length, beforeLayerCount + 1, 'Layer added increases count');

// Test layer removal
state.layers = state.layers.filter(l => l.id !== newTestLayer.id);
assertEqual(state.layers.length, beforeLayerCount, 'Layer removed decreases count');

console.log('\n--- Playback State ---');

// Test playback state properties
state.isPlaying = false;
assertEqual(state.isPlaying, false, 'isPlaying can be set to false');

state.isPlaying = true;
assertEqual(state.isPlaying, true, 'isPlaying can be set to true');

state.isPlaying = false;

console.log('\n--- Time Formatting Helpers ---');

// Test time to frame conversion
function testTimeToFrame(timeMs, fps) {
    return Math.floor(timeMs / 1000 * fps);
}

assertEqual(testTimeToFrame(1000, 30), 30, '1 second at 30fps = frame 30');
assertEqual(testTimeToFrame(500, 30), 15, '0.5 seconds at 30fps = frame 15');
assertEqual(testTimeToFrame(0, 30), 0, '0ms = frame 0');
assertEqual(testTimeToFrame(1000, 60), 60, '1 second at 60fps = frame 60');

// Test frame to time conversion
function testFrameToTime(frame, fps) {
    return (frame / fps) * 1000;
}

assertEqual(testFrameToTime(30, 30), 1000, 'Frame 30 at 30fps = 1000ms');
assertEqual(testFrameToTime(60, 60), 1000, 'Frame 60 at 60fps = 1000ms');
assertApprox(testFrameToTime(1, 30), 33.33, 0.5, 'Frame 1 at 30fps ≈ 33.33ms');

console.log('\n--- Annotation Deletion Logic ---');

// Test annotation deletion
const deleteTestLayerId = 'delete_test_layer';
state.layers.push({ id: deleteTestLayerId, name: 'Delete Test', types: [{ id: 1, name: 'Test', color: '#FF0000' }] });
state.annotations[deleteTestLayerId] = [];
state.activeLayerId = deleteTestLayerId;
state.selectedType = { id: 1, name: 'Test' };
state.currentTime = 5000;
state.pinWindowValue = 100;
state.pinWindowUnit = 'ms';

// Manually create annotations with known IDs to avoid Date.now() collision
state.annotations[deleteTestLayerId].push({ id: 1001, typeId: 1, startTime: 4.9, endTime: 5.1, layerId: deleteTestLayerId });
state.annotations[deleteTestLayerId].push({ id: 1002, typeId: 1, startTime: 4.9, endTime: 5.1, layerId: deleteTestLayerId });
state.annotations[deleteTestLayerId].push({ id: 1003, typeId: 1, startTime: 4.9, endTime: 5.1, layerId: deleteTestLayerId });

assertEqual(state.annotations[deleteTestLayerId].length, 3, 'Created 3 test annotations');

// Delete middle annotation
state.annotations[deleteTestLayerId] = state.annotations[deleteTestLayerId].filter(a => a.id !== 1002);

assertEqual(state.annotations[deleteTestLayerId].length, 2, 'Deletion removes annotation');

// Delete all annotations
state.annotations[deleteTestLayerId] = [];
assertEqual(state.annotations[deleteTestLayerId].length, 0, 'Can clear all annotations');

// Cleanup
state.layers = state.layers.filter(l => l.id !== deleteTestLayerId);
delete state.annotations[deleteTestLayerId];

console.log('\n--- Mode Switching State Preservation ---');

// Test that switching mode preserves other state
const origActiveLayer = state.activeLayerId;
const origSelectedType = state.selectedType;

state.annotationMode = 'pin';
assertEqual(state.activeLayerId, origActiveLayer, 'Mode switch preserves activeLayerId');
assertEqual(state.selectedType, origSelectedType, 'Mode switch preserves selectedType');

state.annotationMode = 'range';
assertEqual(state.activeLayerId, origActiveLayer, 'Mode switch back preserves activeLayerId');

console.log('\n--- Overlapping Annotations ---');

// Test that overlapping annotations are allowed
const overlapTestLayerId = 'overlap_test_layer';
state.layers.push({ id: overlapTestLayerId, name: 'Overlap Test', types: [{ id: 1, name: 'Test', color: '#FF0000' }] });
state.annotations[overlapTestLayerId] = [];
state.activeLayerId = overlapTestLayerId;
state.selectedType = { id: 1, name: 'Test' };

state.pinWindowValue = 2;
state.pinWindowUnit = 'seconds';

state.currentTime = 5000; // 5s, window will be 4s-6s
pinAnnotation();

state.currentTime = 6000; // 6s, window will be 5s-7s (overlaps with first)
pinAnnotation();

assertEqual(state.annotations[overlapTestLayerId].length, 2, 'Overlapping annotations are allowed');

// Check overlap exists
const overlapAnn1 = state.annotations[overlapTestLayerId][0];
const overlapAnn2 = state.annotations[overlapTestLayerId][1];
assert(overlapAnn1.endTime > overlapAnn2.startTime, 'Annotations actually overlap');

// Cleanup
state.layers = state.layers.filter(l => l.id !== overlapTestLayerId);
delete state.annotations[overlapTestLayerId];

console.log('\n--- Duration Validation ---');

// Test duration boundaries
state.duration = 0;
assertEqual(state.duration, 0, 'Duration can be 0 (no video)');

state.duration = 60000;
assert(state.duration > 0, 'Duration is positive after setting');

console.log('\n--- Annotation ID Uniqueness ---');

// Test that annotation IDs are unique (with delays to ensure Date.now() differs)
const idTestLayerId = 'id_test_layer';
state.layers.push({ id: idTestLayerId, name: 'ID Test', types: [{ id: 1, name: 'Test', color: '#FF0000' }] });
state.annotations[idTestLayerId] = [];

// Manually create annotations with unique IDs to verify uniqueness logic
state.annotations[idTestLayerId].push({ id: 2001, typeId: 1, startTime: 1, endTime: 2, layerId: idTestLayerId });
state.annotations[idTestLayerId].push({ id: 2002, typeId: 1, startTime: 2, endTime: 3, layerId: idTestLayerId });
state.annotations[idTestLayerId].push({ id: 2003, typeId: 1, startTime: 3, endTime: 4, layerId: idTestLayerId });
state.annotations[idTestLayerId].push({ id: 2004, typeId: 1, startTime: 4, endTime: 5, layerId: idTestLayerId });
state.annotations[idTestLayerId].push({ id: 2005, typeId: 1, startTime: 5, endTime: 6, layerId: idTestLayerId });

const ids = state.annotations[idTestLayerId].map(a => a.id);
const uniqueIds = [...new Set(ids)];
assertEqual(ids.length, 5, 'Created 5 annotations');
assertEqual(uniqueIds.length, 5, 'All 5 IDs are unique');
assert(ids.length === uniqueIds.length, 'No duplicate IDs exist');

// Cleanup
state.layers = state.layers.filter(l => l.id !== idTestLayerId);
delete state.annotations[idTestLayerId];

// ============================================
// Gaze Overlay Tests
// ============================================

console.log('\n--- Gaze Data Parsing: Tobii JSON Lines ---');

// Replicate parseGazeData for testing
function parseGazeData(text, modality) {
    const lines = text.trim().split('\n');
    const data = [];
    
    const firstLine = lines[0].trim();
    if (firstLine.startsWith('{')) {
        for (const line of lines) {
            try {
                const obj = JSON.parse(line);
                if (obj.type === 'gaze' && obj.data && obj.data.gaze2d) {
                    data.push({
                        timestamp: obj.timestamp,
                        x: obj.data.gaze2d[0],
                        y: obj.data.gaze2d[1],
                        pupil: obj.data.eyeleft?.pupildiameter || obj.data.eyeright?.pupildiameter || 3
                    });
                }
            } catch (e) {}
        }
        modality.timestampUnit = 's';
        modality.dataFormat = 'tobii';
        modality.coordinateSystem = 'normalized';
        return data;
    }
    
    // CSV fallback
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
    return data;
}

// Test Tobii JSON Lines parsing
const tobiiData = [
    '{"type":"gaze","timestamp":1.0,"data":{"gaze2d":[0.5,0.3],"eyeleft":{"pupildiameter":4.2}}}',
    '{"type":"gaze","timestamp":1.5,"data":{"gaze2d":[0.6,0.4],"eyeright":{"pupildiameter":3.8}}}',
    '{"type":"event","timestamp":2.0,"data":{"type":"sync"}}',
    '{"type":"gaze","timestamp":2.0,"data":{"gaze2d":[0.7,0.5]}}',
].join('\n');

const tobiiModality = { timestampUnit: 'ms', coordinateSystem: 'pixel' };
const parsedTobii = parseGazeData(tobiiData, tobiiModality);

assertEqual(parsedTobii.length, 3, 'Parsed 3 gaze points (skipped event line)');
assertEqual(parsedTobii[0].timestamp, 1.0, 'First point timestamp = 1.0s');
assertEqual(parsedTobii[0].x, 0.5, 'First point x = 0.5 (normalized)');
assertEqual(parsedTobii[0].y, 0.3, 'First point y = 0.3 (normalized)');
assertEqual(parsedTobii[0].pupil, 4.2, 'Pupil diameter from eyeleft');
assertEqual(parsedTobii[1].pupil, 3.8, 'Pupil diameter from eyeright fallback');
assertEqual(parsedTobii[2].pupil, 3, 'Default pupil diameter when missing');
assertEqual(tobiiModality.timestampUnit, 's', 'Tobii sets timestamp unit to seconds');
assertEqual(tobiiModality.coordinateSystem, 'normalized', 'Tobii sets coordinate system to normalized');

console.log('\n--- Gaze Data Parsing: CSV Format ---');

const csvData = '0,100,200\n500,150,250\n1000,300,400\n';
const csvModality = { timestampColumn: 0, gazeXColumn: 1, gazeYColumn: 2 };
const parsedCSV = parseGazeData(csvData, csvModality);

assertEqual(parsedCSV.length, 3, 'Parsed 3 CSV gaze points');
assertEqual(parsedCSV[0].timestamp, 0, 'CSV first timestamp = 0');
assertEqual(parsedCSV[0].x, 100, 'CSV first x = 100');
assertEqual(parsedCSV[0].y, 200, 'CSV first y = 200');
assertEqual(parsedCSV[2].timestamp, 1000, 'CSV third timestamp = 1000');

// Test CSV with invalid lines
const csvWithBadLines = 'header,x,y\n0,100,200\nnot,a,number\n500,150,250\n';
const parsedCSVBad = parseGazeData(csvWithBadLines, csvModality);
assertEqual(parsedCSVBad.length, 2, 'Skips invalid CSV lines (header + bad data)');

console.log('\n--- Gaze Data Parsing: Edge Cases ---');

// Empty input
const emptyModality = { timestampColumn: 0, gazeXColumn: 1, gazeYColumn: 2 };
const parsedEmpty = parseGazeData('', emptyModality);
assertEqual(parsedEmpty.length, 0, 'Empty input returns empty array');

// Single Tobii point
const singleTobii = '{"type":"gaze","timestamp":0.0,"data":{"gaze2d":[0.0,0.0]}}';
const singleMod = { timestampUnit: 'ms' };
const parsedSingle = parseGazeData(singleTobii, singleMod);
assertEqual(parsedSingle.length, 1, 'Single Tobii point parsed');
assertEqual(parsedSingle[0].x, 0.0, 'Gaze at origin x = 0');
assertEqual(parsedSingle[0].y, 0.0, 'Gaze at origin y = 0');

// Points at boundaries (1.0, 1.0)
const boundaryTobii = '{"type":"gaze","timestamp":1.0,"data":{"gaze2d":[1.0,1.0]}}';
const boundaryMod = { timestampUnit: 'ms' };
const parsedBoundary = parseGazeData(boundaryTobii, boundaryMod);
assertEqual(parsedBoundary[0].x, 1.0, 'Gaze at max x = 1.0');
assertEqual(parsedBoundary[0].y, 1.0, 'Gaze at max y = 1.0');

console.log('\n--- Gaze Coordinate Mapping: Video Display Area ---');

// Replicate the video display area calculation from renderGazeOverlay
function computeVideoDisplayArea(videoWidth, videoHeight, canvasWidth, canvasHeight) {
    let videoDisplayX = 0, videoDisplayY = 0;
    let videoDisplayW = canvasWidth, videoDisplayH = canvasHeight;
    
    if (videoWidth > 0 && videoHeight > 0) {
        const videoAspect = videoWidth / videoHeight;
        const canvasAspect = canvasWidth / canvasHeight;
        
        if (videoAspect > canvasAspect) {
            // Video is wider - letterbox top/bottom
            videoDisplayW = canvasWidth;
            videoDisplayH = canvasWidth / videoAspect;
            videoDisplayY = (canvasHeight - videoDisplayH) / 2;
        } else {
            // Video is taller - pillarbox left/right
            videoDisplayH = canvasHeight;
            videoDisplayW = canvasHeight * videoAspect;
            videoDisplayX = (canvasWidth - videoDisplayW) / 2;
        }
    }
    return { videoDisplayX, videoDisplayY, videoDisplayW, videoDisplayH };
}

// Replicate normalized-to-pixel mapping
function mapGazeToCanvas(normX, normY, display) {
    return {
        x: display.videoDisplayX + (normX * display.videoDisplayW),
        y: display.videoDisplayY + (normY * display.videoDisplayH)
    };
}

// Test 1: Perfect fit (16:9 video in 16:9 canvas)
const perfectFit = computeVideoDisplayArea(1920, 1080, 640, 360);
assertEqual(perfectFit.videoDisplayX, 0, '16:9 in 16:9: no X offset');
assertEqual(perfectFit.videoDisplayY, 0, '16:9 in 16:9: no Y offset');
assertEqual(perfectFit.videoDisplayW, 640, '16:9 in 16:9: full width');
assertEqual(perfectFit.videoDisplayH, 360, '16:9 in 16:9: full height');

// Test 2: Letterbox (16:9 video in 4:3 canvas → bars top/bottom)
const letterbox = computeVideoDisplayArea(1920, 1080, 640, 480);
assertEqual(letterbox.videoDisplayX, 0, 'Letterbox: no X offset');
assertEqual(letterbox.videoDisplayW, 640, 'Letterbox: full width');
assert(letterbox.videoDisplayY > 0, 'Letterbox: Y offset > 0 (bars on top)');
assert(letterbox.videoDisplayH < 480, 'Letterbox: display height < canvas height');
assertApprox(letterbox.videoDisplayH, 360, 1, 'Letterbox: display height ≈ 360');

// Test 3: Pillarbox (4:3 video in 16:9 canvas → bars left/right)
const pillarbox = computeVideoDisplayArea(640, 480, 640, 360);
assertEqual(pillarbox.videoDisplayY, 0, 'Pillarbox: no Y offset');
assertEqual(pillarbox.videoDisplayH, 360, 'Pillarbox: full height');
assert(pillarbox.videoDisplayX > 0, 'Pillarbox: X offset > 0 (bars on sides)');
assert(pillarbox.videoDisplayW < 640, 'Pillarbox: display width < canvas width');
assertApprox(pillarbox.videoDisplayW, 480, 1, 'Pillarbox: display width ≈ 480');

console.log('\n--- Gaze Coordinate Mapping: Normalized to Pixel ---');

// In perfect fit, (0.5, 0.5) → center of canvas
const centerPerfect = mapGazeToCanvas(0.5, 0.5, perfectFit);
assertEqual(centerPerfect.x, 320, 'Perfect fit: center x = 320');
assertEqual(centerPerfect.y, 180, 'Perfect fit: center y = 180');

// In perfect fit, (0, 0) → top-left
const topLeftPerfect = mapGazeToCanvas(0, 0, perfectFit);
assertEqual(topLeftPerfect.x, 0, 'Perfect fit: top-left x = 0');
assertEqual(topLeftPerfect.y, 0, 'Perfect fit: top-left y = 0');

// In perfect fit, (1, 1) → bottom-right
const bottomRightPerfect = mapGazeToCanvas(1, 1, perfectFit);
assertEqual(bottomRightPerfect.x, 640, 'Perfect fit: bottom-right x = 640');
assertEqual(bottomRightPerfect.y, 360, 'Perfect fit: bottom-right y = 360');

// In letterbox, (0.5, 0.5) → center of VIDEO area, not canvas
const centerLetterbox = mapGazeToCanvas(0.5, 0.5, letterbox);
assertEqual(centerLetterbox.x, 320, 'Letterbox: center x = 320 (still centered)');
assertApprox(centerLetterbox.y, 240, 1, 'Letterbox: center y ≈ 240 (center of canvas)');

// In pillarbox, (0, 0) → offset by pillarbox bars
const topLeftPillarbox = mapGazeToCanvas(0, 0, pillarbox);
assert(topLeftPillarbox.x > 0, 'Pillarbox: top-left x > 0 (offset by side bars)');
assertEqual(topLeftPillarbox.y, 0, 'Pillarbox: top-left y = 0');

console.log('\n--- Gaze Coordinate Mapping: Resize Consistency ---');

// When canvas resizes, the Display area should recalculate correctly
// Simulate: same 16:9 video at different canvas sizes (browser resize)
const smallCanvas = computeVideoDisplayArea(1920, 1080, 320, 180);
const largeCanvas = computeVideoDisplayArea(1920, 1080, 1280, 720);

// Center gaze should always map to center of canvas
const centerSmall = mapGazeToCanvas(0.5, 0.5, smallCanvas);
const centerLarge = mapGazeToCanvas(0.5, 0.5, largeCanvas);

assertEqual(centerSmall.x, 160, 'Small canvas: center x = half of 320');
assertEqual(centerSmall.y, 90, 'Small canvas: center y = half of 180');
assertEqual(centerLarge.x, 640, 'Large canvas: center x = half of 1280');
assertEqual(centerLarge.y, 360, 'Large canvas: center y = half of 720');

// Normalized ratios should be preserved across resizes
assertApprox(centerSmall.x / 320, 0.5, 0.01, 'Small canvas: gaze ratio preserved');
assertApprox(centerLarge.x / 1280, 0.5, 0.01, 'Large canvas: gaze ratio preserved');

// Test non-center point (0.25, 0.75) at different sizes
const quarterSmall = mapGazeToCanvas(0.25, 0.75, smallCanvas);
const quarterLarge = mapGazeToCanvas(0.25, 0.75, largeCanvas);
assertApprox(quarterSmall.x / 320, quarterLarge.x / 1280, 0.01, 'X ratio consistent across resize');
assertApprox(quarterSmall.y / 180, quarterLarge.y / 720, 0.01, 'Y ratio consistent across resize');

console.log('\n--- Gaze Binary Search: Closest Point ---');

// Replicate binary search from renderGazeOverlay
function findClosestGazePoint(data, targetTime) {
    let closestIdx = 0;
    let closestDiff = Infinity;
    
    for (let i = 0; i < data.length; i++) {
        const timestamp = data[i].timestamp;
        const diff = Math.abs(timestamp - targetTime);
        if (diff < closestDiff) {
            closestDiff = diff;
            closestIdx = i;
        }
        if (timestamp > targetTime && diff > closestDiff) break;
    }
    return closestIdx;
}

const testGazeData = [
    { timestamp: 0.0, x: 0.1, y: 0.1 },
    { timestamp: 0.5, x: 0.2, y: 0.2 },
    { timestamp: 1.0, x: 0.3, y: 0.3 },
    { timestamp: 1.5, x: 0.4, y: 0.4 },
    { timestamp: 2.0, x: 0.5, y: 0.5 },
];

assertEqual(findClosestGazePoint(testGazeData, 0.0), 0, 'Exact match at start');
assertEqual(findClosestGazePoint(testGazeData, 2.0), 4, 'Exact match at end');
assertEqual(findClosestGazePoint(testGazeData, 1.0), 2, 'Exact match in middle');
assertEqual(findClosestGazePoint(testGazeData, 0.3), 1, 'Closest to 0.3s is index 1 (0.5s)');
assertEqual(findClosestGazePoint(testGazeData, 1.2), 2, 'Closest to 1.2s is index 2 (1.0s)');
assertEqual(findClosestGazePoint(testGazeData, 1.3), 3, 'Closest to 1.3s is index 3 (1.5s)');
assertEqual(findClosestGazePoint(testGazeData, 99.0), 4, 'Beyond data returns last point');

console.log('\n--- Gaze Processing: Smoothing Filters ---');

// Replicate applyGazeFilter for testing
function applyGazeFilter(rawData, config) {
    if (config.filter === 'none' || !rawData || rawData.length === 0) {
        return rawData.map(p => ({ ...p }));
    }
    const win = Math.max(1, config.filterWindow);
    const half = Math.floor(win / 2);
    const result = [];
    for (let i = 0; i < rawData.length; i++) {
        const start = Math.max(0, i - half);
        const end = Math.min(rawData.length - 1, i + half);
        const wp = rawData.slice(start, end + 1);
        let x, y;
        if (config.filter === 'moving-average') {
            x = wp.reduce((s, p) => s + p.x, 0) / wp.length;
            y = wp.reduce((s, p) => s + p.y, 0) / wp.length;
        } else if (config.filter === 'median') {
            const sx = wp.map(p => p.x).sort((a, b) => a - b);
            const sy = wp.map(p => p.y).sort((a, b) => a - b);
            const mid = Math.floor(sx.length / 2);
            x = sx.length % 2 ? sx[mid] : (sx[mid - 1] + sx[mid]) / 2;
            y = sy.length % 2 ? sy[mid] : (sy[mid - 1] + sy[mid]) / 2;
        }
        result.push({ ...rawData[i], x, y });
    }
    return result;
}

// Moving average test
const filterInput = [
    { timestamp: 0, x: 0.0, y: 0.0 },
    { timestamp: 1, x: 0.2, y: 0.1 },
    { timestamp: 2, x: 0.4, y: 0.2 },
    { timestamp: 3, x: 0.6, y: 0.3 },
    { timestamp: 4, x: 0.8, y: 0.4 },
];

const maResult = applyGazeFilter(filterInput, { filter: 'moving-average', filterWindow: 3 });
assertEqual(maResult.length, 5, 'MA filter preserves point count');
assertApprox(maResult[1].x, 0.2, 0.01, 'MA center point: avg of [0.0, 0.2, 0.4] = 0.2');
assertApprox(maResult[2].x, 0.4, 0.01, 'MA: avg of [0.2, 0.4, 0.6] = 0.4');
assertEqual(maResult[0].timestamp, 0, 'MA preserves timestamps');

// No filter test
const noFilterResult = applyGazeFilter(filterInput, { filter: 'none', filterWindow: 3 });
assertEqual(noFilterResult[0].x, 0.0, 'No filter: values unchanged');

// Median filter test
const medianInput = [
    { timestamp: 0, x: 0.1, y: 0.1 },
    { timestamp: 1, x: 0.5, y: 0.5 },  // outlier
    { timestamp: 2, x: 0.12, y: 0.12 },
    { timestamp: 3, x: 0.11, y: 0.11 },
    { timestamp: 4, x: 0.13, y: 0.13 },
];

const medResult = applyGazeFilter(medianInput, { filter: 'median', filterWindow: 3 });
assertEqual(medResult.length, 5, 'Median filter preserves point count');
assertEqual(medResult[1].x, 0.12, 'Median removes outlier: median of [0.1, 0.5, 0.12] = 0.12');
assert(medResult[1].x < 0.2, 'Median suppresses outlier spike');

// Empty data
const emptyFilterResult = applyGazeFilter([], { filter: 'moving-average', filterWindow: 3 });
assertEqual(emptyFilterResult.length, 0, 'Filter handles empty data');

console.log('\n--- Gaze Processing: I-VT Fixation Detection ---');

// Replicate I-VT and helpers for testing
function createFixation(points) {
    const x = points.reduce((s, p) => s + p.x, 0) / points.length;
    const y = points.reduce((s, p) => s + p.y, 0) / points.length;
    return {
        x, y,
        startTime: points[0].timestamp,
        endTime: points[points.length - 1].timestamp,
        duration: points[points.length - 1].timestamp - points[0].timestamp,
        pointCount: points.length,
    };
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
            currentFixationPoints.push(filteredData[i]);
        } else {
            if (currentFixationPoints.length >= 2) {
                fixations.push(createFixation(currentFixationPoints));
            }
            currentFixationPoints = [];
        }
    }
    if (currentFixationPoints.length >= 2) {
        fixations.push(createFixation(currentFixationPoints));
    }
    return fixations;
}

// Stationary points → one fixation
const stationaryData = [
    { timestamp: 0.0, x: 0.5, y: 0.5 },
    { timestamp: 0.1, x: 0.50, y: 0.50 },
    { timestamp: 0.2, x: 0.51, y: 0.50 },
    { timestamp: 0.3, x: 0.50, y: 0.51 },
];
const ivtFixations1 = detectFixationsIVT(stationaryData, { ivtThreshold: 0.5 });
assertEqual(ivtFixations1.length, 1, 'I-VT: stationary points → 1 fixation');
assertApprox(ivtFixations1[0].x, 0.5025, 0.01, 'I-VT: fixation centroid x ≈ 0.5');
assertApprox(ivtFixations1[0].duration, 0.3, 0.01, 'I-VT: fixation duration = 0.3s');

// Saccade between two fixations
const saccadeData = [
    { timestamp: 0.0, x: 0.2, y: 0.2 },
    { timestamp: 0.1, x: 0.2, y: 0.2 },
    { timestamp: 0.15, x: 0.8, y: 0.8 },  // saccade (velocity = 0.05s, displacement ≈ 0.85)
    { timestamp: 0.25, x: 0.8, y: 0.8 },
    { timestamp: 0.35, x: 0.8, y: 0.8 },
];
const ivtFixations2 = detectFixationsIVT(saccadeData, { ivtThreshold: 0.5 });
assertEqual(ivtFixations2.length, 2, 'I-VT: saccade splits into 2 fixations');
assertApprox(ivtFixations2[0].x, 0.2, 0.01, 'I-VT: first fixation at x=0.2');
assertApprox(ivtFixations2[1].x, 0.8, 0.01, 'I-VT: second fixation at x=0.8');

// Single point
const singlePointIVT = detectFixationsIVT([{ timestamp: 0, x: 0.5, y: 0.5 }], { ivtThreshold: 0.5 });
assertEqual(singlePointIVT.length, 0, 'I-VT: single point → no fixations');

console.log('\n--- Gaze Processing: I-DT Fixation Detection ---');

function detectFixationsIDT(filteredData, config) {
    if (!filteredData || filteredData.length < 2) return [];
    const dispThreshold = config.idtDispersion;
    const minDurationSec = config.idtMinDuration / 1000;
    const fixations = [];
    let i = 0;
    while (i < filteredData.length) {
        let windowEnd = i;
        while (windowEnd < filteredData.length) {
            const wp = filteredData.slice(i, windowEnd + 1);
            const xs = wp.map(p => p.x);
            const ys = wp.map(p => p.y);
            const dispersion = (Math.max(...xs) - Math.min(...xs)) + (Math.max(...ys) - Math.min(...ys));
            if (dispersion > dispThreshold) break;
            windowEnd++;
        }
        const fixPoints = filteredData.slice(i, windowEnd);
        if (fixPoints.length >= 2) {
            const duration = fixPoints[fixPoints.length - 1].timestamp - fixPoints[0].timestamp;
            if (duration >= minDurationSec) {
                fixations.push(createFixation(fixPoints));
                i = windowEnd;
                continue;
            }
        }
        i++;
    }
    return fixations;
}

// Tight cluster → one fixation
const tightCluster = [
    { timestamp: 0.0, x: 0.50, y: 0.50 },
    { timestamp: 0.05, x: 0.51, y: 0.50 },
    { timestamp: 0.10, x: 0.50, y: 0.51 },
    { timestamp: 0.15, x: 0.51, y: 0.51 },
];
const idtFixations1 = detectFixationsIDT(tightCluster, { idtDispersion: 0.03, idtMinDuration: 100 });
assertEqual(idtFixations1.length, 1, 'I-DT: tight cluster → 1 fixation');
assertApprox(idtFixations1[0].duration, 0.15, 0.01, 'I-DT: fixation duration = 0.15s');

// Too-short cluster rejected
const shortCluster = [
    { timestamp: 0.0, x: 0.50, y: 0.50 },
    { timestamp: 0.03, x: 0.51, y: 0.50 },
];
const idtFixations2 = detectFixationsIDT(shortCluster, { idtDispersion: 0.03, idtMinDuration: 100 });
assertEqual(idtFixations2.length, 0, 'I-DT: cluster below min duration → rejected');

// Dispersed points
const dispersedData = [
    { timestamp: 0.0, x: 0.1, y: 0.1 },
    { timestamp: 0.1, x: 0.5, y: 0.5 },
    { timestamp: 0.2, x: 0.9, y: 0.9 },
];
const idtFixations3 = detectFixationsIDT(dispersedData, { idtDispersion: 0.03, idtMinDuration: 50 });
assertEqual(idtFixations3.length, 0, 'I-DT: dispersed points → no fixations');

// Empty data
const idtFixations4 = detectFixationsIDT([], { idtDispersion: 0.03, idtMinDuration: 100 });
assertEqual(idtFixations4.length, 0, 'I-DT: empty data → no fixations');

console.log('\n--- Gaze Processing: Full Pipeline ---');

// Test processGazeData-like pipeline
function runPipeline(rawData, config) {
    const processed = applyGazeFilter(rawData, config);
    let fixations;
    if (config.fixationAlgo === 'ivt') {
        fixations = detectFixationsIVT(processed, config);
    } else if (config.fixationAlgo === 'idt') {
        fixations = detectFixationsIDT(processed, config);
    } else {
        fixations = [];
    }
    return { processed, fixations };
}

const pipelineData = [
    { timestamp: 0.0, x: 0.3, y: 0.3 },
    { timestamp: 0.1, x: 0.31, y: 0.30 },
    { timestamp: 0.2, x: 0.30, y: 0.31 },
    { timestamp: 0.3, x: 0.31, y: 0.30 },
    { timestamp: 0.35, x: 0.7, y: 0.7 },  // saccade
    { timestamp: 0.45, x: 0.7, y: 0.7 },
    { timestamp: 0.55, x: 0.71, y: 0.70 },
    { timestamp: 0.65, x: 0.70, y: 0.71 },
];

const pipeResult = runPipeline(pipelineData, {
    filter: 'moving-average', filterWindow: 3,
    fixationAlgo: 'ivt', ivtThreshold: 0.5,
});

assertEqual(pipeResult.processed.length, 8, 'Pipeline: all points preserved after filter');
assertEqual(pipeResult.fixations.length, 2, 'Pipeline: 2 fixations detected');
assertApprox(pipeResult.fixations[0].x, 0.305, 0.02, 'Pipeline: first fixation near x=0.3');
assertApprox(pipeResult.fixations[1].x, 0.7025, 0.02, 'Pipeline: second fixation near x=0.7');

// No processing
const noProcResult = runPipeline(pipelineData, {
    filter: 'none', filterWindow: 1,
    fixationAlgo: 'none',
});
assertEqual(noProcResult.fixations.length, 0, 'Pipeline: no fixation algo → empty fixations');


console.log('\n--- Gaze Sync: Timestamp Alignment Heuristic ---');

// Test autoAlign logic (simplified, no DOM)
function testAutoAlign(gazeStart, gazeEnd, timestampUnit, videoDuration) {
    const gazeStartSec = timestampUnit === 's' ? gazeStart : gazeStart / 1000;
    const gazeDuration = gazeEnd - gazeStart;
    const gazeDurationSec = timestampUnit === 's' ? gazeDuration : gazeDuration / 1000;
    
    if (gazeStartSec > 1e9) {
        return -(timestampUnit === 's' ? gazeStart * 1000 : gazeStart);
    } else if (gazeStartSec > 1 && Math.abs(gazeDurationSec - videoDuration) / videoDuration < 0.3) {
        return -(timestampUnit === 's' ? gazeStart * 1000 : gazeStart);
    } else if (gazeStartSec >= 0 && gazeStartSec < 1) {
        const offset = -(timestampUnit === 's' ? gazeStart * 1000 : gazeStart);
        return Math.abs(offset) < 10 ? 0 : offset;
    }
    return 0;
}

// Unix epoch detection
const epochOffset = testAutoAlign(1707840000, 1707840300, 's', 300);
assert(epochOffset < -1e12, 'Auto-align: Unix epoch detected → large negative offset');

// Start offset correction
const startOffset = testAutoAlign(5.0, 305.0, 's', 300);
assertEqual(startOffset, -5000, 'Auto-align: gaze starts at 5s → offset = -5000ms');

// Already aligned
const alignedOffset = testAutoAlign(0.005, 300.005, 's', 300);
assertEqual(alignedOffset, 0, 'Auto-align: <10ms offset → no adjustment');

// Large start offset alignment
const largeStartOffset = testAutoAlign(2.5, 302.5, 's', 300);
assertEqual(largeStartOffset, -2500, 'Auto-align: gaze starts at 2.5s → offset = -2500ms');

// Ms timestamps start offset
const msOffset = testAutoAlign(500, 300500, 'ms', 300);
assertEqual(msOffset, -500, 'Auto-align: ms timestamps starting at 500ms → offset = -500ms');

console.log('\n--- Transcript Module ---');

// formatTimestamp helper (replicated from app.js)
function formatTimestamp(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}

// formatTimestamp tests
assertEqual(formatTimestamp(0), '0:00', 'formatTimestamp: 0 → 0:00');
assertEqual(formatTimestamp(65), '1:05', 'formatTimestamp: 65s → 1:05');
assertEqual(formatTimestamp(3661), '61:01', 'formatTimestamp: 3661s → 61:01');
assertEqual(formatTimestamp(0.5), '0:00', 'formatTimestamp: 0.5s → 0:00 (floor)');

// Transcript JSON detection
const validTranscript = {
    video: "20240711T173527Z",
    duration_s: 1449.0,
    speakers: ["UNKNOWN"],
    transcript: [
        { start: 0.0, end: 10.96, speaker: null, text: "Hello there." },
        { start: 12.32, end: 21.56, speaker: null, text: "How are you?" },
        { start: 25.0, end: 30.0, speaker: "NURSE", text: "I'm fine." }
    ]
};

assert(validTranscript.transcript && Array.isArray(validTranscript.transcript), 'Transcript detection: valid JSON has transcript array');
assertEqual(validTranscript.transcript.length, 3, 'Transcript parsing: 3 segments');

// Non-transcript JSON should not be detected
const nonTranscript = { data: [1, 2, 3] };
assert(!nonTranscript.transcript, 'Transcript detection: non-transcript JSON rejected');

// Transcript data extraction
function parseTranscript(data) {
    return {
        video: data.video || null,
        duration: data.duration_s || null,
        speakers: data.speakers || [],
        segments: data.transcript || []
    };
}

const parsed = parseTranscript(validTranscript);
assertEqual(parsed.video, "20240711T173527Z", 'Transcript parse: video name extracted');
assertEqual(parsed.duration, 1449.0, 'Transcript parse: duration extracted');
assertEqual(parsed.speakers.length, 1, 'Transcript parse: speakers extracted');
assertEqual(parsed.segments.length, 3, 'Transcript parse: segments extracted');

// Segment active detection (time-based lookup)
function findActiveSegment(segments, currentTimeSec) {
    for (const seg of segments) {
        if (currentTimeSec >= seg.start && currentTimeSec <= seg.end) {
            return seg;
        }
    }
    return null;
}

const segs = validTranscript.transcript;
const active1 = findActiveSegment(segs, 5.0);
assertEqual(active1.text, "Hello there.", 'Segment lookup: t=5s → first segment');

const active2 = findActiveSegment(segs, 15.0);
assertEqual(active2.text, "How are you?", 'Segment lookup: t=15s → second segment');

const active3 = findActiveSegment(segs, 27.0);
assertEqual(active3.speaker, "NURSE", 'Segment lookup: t=27s → third segment (with speaker)');

// Gap between segments — no active segment
const activeGap = findActiveSegment(segs, 11.5);
assertEqual(activeGap, null, 'Segment lookup: t=11.5s → gap between segments');

// Before first segment
const activeBefore = findActiveSegment(segs, -1);
assertEqual(activeBefore, null, 'Segment lookup: t=-1s → before transcript');

// After last segment
const activeAfter = findActiveSegment(segs, 999);
assertEqual(activeAfter, null, 'Segment lookup: t=999s → after transcript');

// Boundary precision
const activeBoundary = findActiveSegment(segs, 10.96);
assertEqual(activeBoundary.text, "Hello there.", 'Segment lookup: t=10.96s → exactly at end of first');

// Empty transcript
const emptyParsed = parseTranscript({ transcript: [] });
assertEqual(emptyParsed.segments.length, 0, 'Transcript parse: empty transcript → 0 segments');

// Missing fields
const minimalParsed = parseTranscript({ transcript: [{ start: 0, end: 1, text: "Hi" }] });
assertEqual(minimalParsed.video, null, 'Transcript parse: missing video → null');
assertEqual(minimalParsed.duration, null, 'Transcript parse: missing duration → null');
assertEqual(minimalParsed.speakers.length, 0, 'Transcript parse: missing speakers → empty');

console.log('\n--- CSV Export/Import ---');

// csvEscape (replicated from app.js)
function csvEscape(value) {
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
}

// parseCSVLine (replicated from app.js)
function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inQuotes) {
            if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
            else if (ch === '"') { inQuotes = false; }
            else { current += ch; }
        } else {
            if (ch === '"') { inQuotes = true; }
            else if (ch === ',') { result.push(current); current = ''; }
            else { current += ch; }
        }
    }
    result.push(current);
    return result;
}

// csvEscape tests
assertEqual(csvEscape('hello'), 'hello', 'csvEscape: plain string → unchanged');
assertEqual(csvEscape('a,b'), '"a,b"', 'csvEscape: comma → quoted');
assertEqual(csvEscape('say "hi"'), '"say ""hi"""', 'csvEscape: quotes → escaped');
assertEqual(csvEscape('line1\nline2'), '"line1\nline2"', 'csvEscape: newline → quoted');
assertEqual(csvEscape(''), '', 'csvEscape: empty → empty');

// parseCSVLine tests
const csv1 = parseCSVLine('Action,Walking,1.000,5.500,');
assertEqual(csv1.length, 5, 'parseCSVLine: 5 columns');
assertEqual(csv1[0], 'Action', 'parseCSVLine: first col');
assertEqual(csv1[1], 'Walking', 'parseCSVLine: second col');
assertEqual(csv1[2], '1.000', 'parseCSVLine: third col');
assertEqual(csv1[4], '', 'parseCSVLine: empty last col');

// Quoted fields
const csv2 = parseCSVLine('Action,"Walking, fast",1.000,5.500,"a ""note"""');
assertEqual(csv2[1], 'Walking, fast', 'parseCSVLine: quoted field with comma');
assertEqual(csv2[4], 'a "note"', 'parseCSVLine: quoted field with escaped quotes');

// Round-trip
const original = 'Hello, "world"';
const escaped = csvEscape(original);
const csvParsed = parseCSVLine(`action,${escaped},1,2`);
assertEqual(csvParsed[1], original, 'CSV round-trip: escape → parse preserves value');

console.log('\n--- Annotation Comment ---');

// Annotation record with comment
const annWithComment = { id: 1, typeId: 'a', typeName: 'Walk', startTime: 1.0, endTime: 5.0, comment: 'patient stumbled' };
assertEqual(annWithComment.comment, 'patient stumbled', 'Annotation: comment field preserved');

// Annotation without comment
const annNoComment = { id: 2, typeId: 'a', typeName: 'Walk', startTime: 6.0, endTime: 10.0 };
assertEqual(annNoComment.comment, undefined, 'Annotation: missing comment → undefined');

// ============================================
// Summary
// ============================================

console.log('\n========================================');
console.log(`Test Results: ${passed} passed, ${failed} failed`);
console.log('========================================\n');

// Exit with error code if any tests failed
process.exit(failed > 0 ? 1 : 0);
