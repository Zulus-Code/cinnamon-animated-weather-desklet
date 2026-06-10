#!/usr/bin/env node
/* tests/run.js — Test runner that executes all test suites */

const SUITES = [
    'utils.test.js',
    'constants.test.js',
    'sceneBuilder.test.js',
    'renderer.test.js',
    'weatherService.test.js'
];

const BASE = __dirname;

console.log('╔══════════════════════════════════════════╗');
console.log('║  Cinnamon Animated Weather Desklet Tests ║');
console.log('╚══════════════════════════════════════════╝');
console.log();

let totalPassed = 0;
let totalFailed = 0;
const allErrors = [];

for (const suite of SUITES) {
    try {
        const mod = require(BASE + '/' + suite);
        if (mod.passed !== undefined) totalPassed += mod.passed;
        if (mod.failed !== undefined) totalFailed += mod.failed;
        if (mod.errors) allErrors.push(...mod.errors);
    } catch (e) {
        console.log('\n── ' + suite + ' ──');
        console.log('  ✗ LOAD ERROR — ' + e.message);
        totalFailed++;
        allErrors.push({ name: suite, error: e.message });
    }
}

console.log();
console.log('══════════════════════════════════════════');
console.log('  Total: ' + (totalPassed + totalFailed) + ' tests');
console.log('  ✓ Passed: ' + totalPassed);
console.log('  ✗ Failed: ' + totalFailed);

if (totalFailed > 0) {
    console.log();
    console.log('  Failures:');
    allErrors.forEach(e => {
        console.log('    • ' + e.name + ': ' + e.error);
    });
}

console.log();
process.exit(totalFailed > 0 ? 1 : 0);
