/**********************************************************************
    FreecivWorld.net - Hex Tile Implementation Tests
    Simple test framework for JavaScript unit tests
***********************************************************************/

var testResults = {
    passed: 0,
    failed: 0,
    total: 0,
    failures: []
};

function assert(condition, message) {
    testResults.total++;
    if (condition) {
        testResults.passed++;
        console.log('✓ ' + message);
    } else {
        testResults.failed++;
        testResults.failures.push(message);
        console.error('✗ ' + message);
    }
}

function assertEquals(actual, expected, message) {
    var condition = actual === expected;
    if (!condition) {
        message += ' (expected: ' + expected + ', got: ' + actual + ')';
    }
    assert(condition, message);
}

function assertNotNull(value, message) {
    assert(value !== null && value !== undefined, message);
}

function assertApproxEquals(actual, expected, tolerance, message) {
    var condition = Math.abs(actual - expected) < tolerance;
    if (!condition) {
        message += ' (expected: ' + expected + ' ± ' + tolerance + ', got: ' + actual + ')';
    }
    assert(condition, message);
}

function runTestSuite(suiteName, testFunctions) {
    console.log('\n========================================');
    console.log('Running Test Suite: ' + suiteName);
    console.log('========================================\n');
    
    for (var i = 0; i < testFunctions.length; i++) {
        try {
            testFunctions[i]();
        } catch (e) {
            testResults.failed++;
            testResults.total++;
            testResults.failures.push('Test threw exception: ' + e.message);
            console.error('✗ Test threw exception: ' + e.message);
        }
    }
}

function printTestSummary() {
    console.log('\n========================================');
    console.log('Test Summary');
    console.log('========================================');
    console.log('Total tests: ' + testResults.total);
    console.log('Passed: ' + testResults.passed);
    console.log('Failed: ' + testResults.failed);
    console.log('Success rate: ' + ((testResults.passed / testResults.total * 100).toFixed(2)) + '%');
    
    if (testResults.failures.length > 0) {
        console.log('\nFailures:');
        testResults.failures.forEach(function(failure, index) {
            console.log((index + 1) + '. ' + failure);
        });
    }
    console.log('========================================\n');
    
    return testResults.failed === 0;
}
