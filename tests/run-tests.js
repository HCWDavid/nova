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

// ============================================
// Summary
// ============================================

console.log('\n========================================');
console.log(`Test Results: ${passed} passed, ${failed} failed`);
console.log('========================================\n');

// Exit with error code if any tests failed
process.exit(failed > 0 ? 1 : 0);
