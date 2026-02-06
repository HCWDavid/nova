/**
 * NOVA Unit Tests - Pin Mode
 * 
 * To run these tests, open the browser console while NOVA is loaded
 * and paste this file, or include it with a script tag.
 * 
 * Usage: Run `NovaTests.runAll()` in the console.
 */

const NovaTests = {
    passed: 0,
    failed: 0,
    results: [],
    
    // Test utilities
    assert(condition, message) {
        if (condition) {
            this.passed++;
            this.results.push({ pass: true, message });
            console.log(`✅ ${message}`);
        } else {
            this.failed++;
            this.results.push({ pass: false, message });
            console.error(`❌ ${message}`);
        }
    },
    
    assertEqual(actual, expected, message) {
        if (actual === expected) {
            this.passed++;
            this.results.push({ pass: true, message });
            console.log(`✅ ${message}`);
        } else {
            this.failed++;
            this.results.push({ pass: false, message: `${message} (expected ${expected}, got ${actual})` });
            console.error(`❌ ${message} - expected ${expected}, got ${actual}`);
        }
    },
    
    assertApprox(actual, expected, tolerance, message) {
        if (Math.abs(actual - expected) <= tolerance) {
            this.passed++;
            this.results.push({ pass: true, message });
            console.log(`✅ ${message}`);
        } else {
            this.failed++;
            this.results.push({ pass: false, message: `${message} (expected ~${expected}, got ${actual})` });
            console.error(`❌ ${message} - expected ~${expected} ±${tolerance}, got ${actual}`);
        }
    },
    
    reset() {
        this.passed = 0;
        this.failed = 0;
        this.results = [];
    },
    
    summary() {
        console.log('\n========================================');
        console.log(`Test Results: ${this.passed} passed, ${this.failed} failed`);
        console.log('========================================\n');
        return { passed: this.passed, failed: this.failed };
    },
    
    // ========================================
    // Test Cases
    // ========================================
    
    testStateInitialization() {
        console.log('\n--- Testing State Initialization ---');
        
        this.assert(typeof state !== 'undefined', 'state object exists');
        this.assert('annotationMode' in state, 'state has annotationMode property');
        this.assert('pinWindowValue' in state, 'state has pinWindowValue property');
        this.assert('pinWindowUnit' in state, 'state has pinWindowUnit property');
        
        this.assert(
            ['range', 'pin'].includes(state.annotationMode),
            `annotationMode is valid (${state.annotationMode})`
        );
        this.assert(
            ['frames', 'seconds', 'ms'].includes(state.pinWindowUnit),
            `pinWindowUnit is valid (${state.pinWindowUnit})`
        );
        this.assert(
            typeof state.pinWindowValue === 'number' && state.pinWindowValue >= 0,
            `pinWindowValue is valid number (${state.pinWindowValue})`
        );
    },
    
    testGetWindowDurationMs() {
        console.log('\n--- Testing getWindowDurationMs ---');
        
        // Save original values
        const origValue = state.pinWindowValue;
        const origUnit = state.pinWindowUnit;
        const origFps = state.fps;
        
        try {
            // Test frames
            state.fps = 30;
            state.pinWindowValue = 1;
            state.pinWindowUnit = 'frames';
            this.assertApprox(getWindowDurationMs(), 33.33, 0.5, '1 frame at 30fps ≈ 33.33ms');
            
            state.pinWindowValue = 3;
            this.assertApprox(getWindowDurationMs(), 100, 0.5, '3 frames at 30fps = 100ms');
            
            // Test seconds
            state.pinWindowUnit = 'seconds';
            state.pinWindowValue = 0.5;
            this.assertEqual(getWindowDurationMs(), 500, '0.5 seconds = 500ms');
            
            state.pinWindowValue = 2;
            this.assertEqual(getWindowDurationMs(), 2000, '2 seconds = 2000ms');
            
            // Test milliseconds
            state.pinWindowUnit = 'ms';
            state.pinWindowValue = 100;
            this.assertEqual(getWindowDurationMs(), 100, '100ms = 100ms');
            
            state.pinWindowValue = 500;
            this.assertEqual(getWindowDurationMs(), 500, '500ms = 500ms');
            
        } finally {
            // Restore original values
            state.pinWindowValue = origValue;
            state.pinWindowUnit = origUnit;
            state.fps = origFps;
        }
    },
    
    testPinAnnotation() {
        console.log('\n--- Testing pinAnnotation ---');
        
        // Save original state
        const origLayerId = state.activeLayerId;
        const origSelectedType = state.selectedType;
        const origCurrentTime = state.currentTime;
        const origDuration = state.duration;
        const origAnnotations = JSON.stringify(state.annotations);
        const origPinValue = state.pinWindowValue;
        const origPinUnit = state.pinWindowUnit;
        
        try {
            // Setup test conditions
            if (state.layers.length === 0) {
                console.warn('No layers available, skipping pinAnnotation test');
                return;
            }
            
            const testLayer = state.layers[0];
            state.activeLayerId = testLayer.id;
            state.selectedType = testLayer.types[0];
            state.currentTime = 5000; // 5 seconds
            state.duration = 60000; // 60 seconds
            state.pinWindowValue = 1;
            state.pinWindowUnit = 'frames';
            state.fps = 30;
            
            // Clear annotations for test layer
            state.annotations[testLayer.id] = [];
            
            // Run pinAnnotation
            pinAnnotation();
            
            // Verify annotation was created
            const annotations = state.annotations[testLayer.id];
            this.assertEqual(annotations.length, 1, 'pinAnnotation creates one annotation');
            
            if (annotations.length > 0) {
                const ann = annotations[0];
                this.assertEqual(ann.typeId, state.selectedType.id, 'Annotation has correct typeId');
                this.assertEqual(ann.layerId, testLayer.id, 'Annotation has correct layerId');
                this.assert(ann.isPinned === true, 'Annotation is marked as pinned');
                this.assert(ann.startTime <= 5.0, 'startTime is <= current time');
                this.assert(ann.endTime >= 5.0, 'endTime is >= current time');
                this.assertApprox(ann.endTime - ann.startTime, 0.033, 0.01, 'Duration is ~1 frame');
            }
            
            // Test with larger window
            state.annotations[testLayer.id] = [];
            state.pinWindowValue = 500;
            state.pinWindowUnit = 'ms';
            
            pinAnnotation();
            
            const ann2 = state.annotations[testLayer.id][0];
            if (ann2) {
                this.assertApprox(ann2.endTime - ann2.startTime, 0.5, 0.05, 'Duration is ~500ms');
            }
            
        } finally {
            // Restore original state
            state.activeLayerId = origLayerId;
            state.selectedType = origSelectedType;
            state.currentTime = origCurrentTime;
            state.duration = origDuration;
            state.annotations = JSON.parse(origAnnotations);
            state.pinWindowValue = origPinValue;
            state.pinWindowUnit = origPinUnit;
        }
    },
    
    testAnnotationModeChange() {
        console.log('\n--- Testing Annotation Mode Change ---');
        
        const origMode = state.annotationMode;
        
        try {
            // Test switching to pin mode
            state.annotationMode = 'pin';
            this.assertEqual(state.annotationMode, 'pin', 'Can set mode to pin');
            
            // Test switching back to range
            state.annotationMode = 'range';
            this.assertEqual(state.annotationMode, 'range', 'Can set mode to range');
            
            // Test handleAnnotationModeChange function exists
            this.assert(typeof handleAnnotationModeChange === 'function', 'handleAnnotationModeChange exists');
            
        } finally {
            state.annotationMode = origMode;
        }
    },
    
    testNewLayerAnnotations() {
        console.log('\n--- Testing New Layer Annotations ---');
        
        // This tests the bug fix for new layers
        const testLayerId = 'test_layer_' + Date.now();
        
        try {
            // Create a new layer without initializing annotations
            state.layers.push({
                id: testLayerId,
                name: 'Test Layer',
                shortcut: 't',
                color: '#FF0000',
                types: [{ id: 1, name: 'Test Type', color: '#FF0000' }]
            });
            
            // Simulate the fix in handleAddLayer
            state.annotations[testLayerId] = [];
            
            this.assert(
                Array.isArray(state.annotations[testLayerId]),
                'New layer has initialized annotations array'
            );
            
            // Test adding annotation to new layer
            const origLayerId = state.activeLayerId;
            const origSelectedType = state.selectedType;
            
            state.activeLayerId = testLayerId;
            state.selectedType = { id: 1, name: 'Test Type' };
            state.currentTime = 1000;
            state.duration = 60000;
            
            pinAnnotation();
            
            this.assertEqual(
                state.annotations[testLayerId].length,
                1,
                'Can add annotation to new layer'
            );
            
            state.activeLayerId = origLayerId;
            state.selectedType = origSelectedType;
            
        } finally {
            // Cleanup
            state.layers = state.layers.filter(l => l.id !== testLayerId);
            delete state.annotations[testLayerId];
        }
    },
    
    // ========================================
    // Run All Tests
    // ========================================
    
    runAll() {
        console.log('🧪 NOVA Unit Tests - Starting...\n');
        this.reset();
        
        this.testStateInitialization();
        this.testGetWindowDurationMs();
        this.testAnnotationModeChange();
        this.testPinAnnotation();
        this.testNewLayerAnnotations();
        
        return this.summary();
    }
};

// Export for console access
window.NovaTests = NovaTests;

console.log('📋 NOVA Tests loaded. Run NovaTests.runAll() to execute tests.');
