// Demand Capacity Simulator - Test Suite
// Run with: node test.js

import { gaussian, generateGaussianDemand, generateLinearDemand, runFullSimulation } from './simulation-core.js';

// ========== TEST FRAMEWORK ==========

const assert = {
  close: (actual, expected, tolerance = 0.001) => {
    const diff = Math.abs(actual - expected);
    const maxDiff = Math.abs(expected * tolerance);
    if (diff > maxDiff) {
      throw new Error(`Expected ${expected} ± ${maxDiff} (${(tolerance * 100).toFixed(1)}%), got ${actual} (diff: ${diff.toFixed(2)})`);
    }
  },
  equal: (actual, expected) => {
    if (actual !== expected) {
      throw new Error(`Expected ${expected}, got ${actual}`);
    }
  },
  lessThanOrEqual: (actual, max) => {
    if (actual > max) {
      throw new Error(`Expected <= ${max}, got ${actual}`);
    }
  }
};

function runTest(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
    return true;
  } catch (err) {
    console.error(`✗ ${name}`);
    console.error(`  ${err.message}`);
    return false;
  }
}

// ========== TEST SUITE ==========

console.log('\n=== Demand Capacity Simulator Tests ===\n');

let passed = 0;
let failed = 0;

// Test 1: Gaussian Demand Conservation
if (runTest('Test 1: Gaussian demand integrates to total within 0.2%', () => {
  const totalDemand = 100000;
  const demand = generateGaussianDemand(totalDemand, 15, 3);
  const actualTotal = demand.reduce((sum, v) => sum + v, 0);
  assert.close(actualTotal, totalDemand, 0.002); // 0.2% tolerance (numerical integration)
})) {
  passed++;
} else {
  failed++;
}

// Test 2: Linear Demand Distribution
if (runTest('Test 2: Linear demand distributes evenly (50/minute for 72k total)', () => {
  const totalDemand = 72000;
  const demand = generateLinearDemand(totalDemand);
  const expectedPerMinute = 50; // 72000 / 1440

  // Check all values are equal to expected
  const allMatch = demand.every(v => Math.abs(v - expectedPerMinute) < 0.001);
  if (!allMatch) {
    throw new Error(`Not all values equal ${expectedPerMinute}`);
  }
  assert.equal(demand.length, 1440);
})) {
  passed++;
} else {
  failed++;
}

// Test 3: Single Curve Demand Conservation (Integration)
if (runTest('Test 3: Single curve - served + shed ≈ total demand (100k)', () => {
  const curves = [{
    id: 'curve-1',
    type: 'gaussian',
    totalDemand: 100000,
    peakHour: 15,
    curveWidth: 3,
    priority: 1,
    color: '#818cf8'
  }];

  const { metrics } = runFullSimulation(100, curves, 30);
  const total = metrics.totalUtilization + metrics.shedDemand;

  assert.close(total, 100000, 0.002); // within 0.2% (Gaussian numerical integration)
})) {
  passed++;
} else {
  failed++;
}

// Test 4: Zero Capacity Edge Case
if (runTest('Test 4: Zero capacity → 100% shed, 0% served', () => {
  const curves = [{
    id: 'curve-1',
    type: 'linear',
    totalDemand: 100000,
    priority: 1,
    color: '#818cf8'
  }];

  const { metrics } = runFullSimulation(0, curves, 30);

  assert.equal(metrics.totalUtilization, 0);
  assert.close(metrics.shedDemand, 100000, 0.001);
})) {
  passed++;
} else {
  failed++;
}

// Test 5: Infinite Capacity (No Shedding)
if (runTest('Test 5: Infinite capacity → 0% shed, 100% served', () => {
  const curves = [{
    id: 'curve-1',
    type: 'gaussian',
    totalDemand: 50000,
    peakHour: 15,
    curveWidth: 3,
    priority: 1,
    color: '#818cf8'
  }];

  const { metrics } = runFullSimulation(10000, curves, 30); // 10k machines >> peak demand

  assert.equal(metrics.shedDemand, 0);
  assert.close(metrics.totalUtilization, 50000, 0.002); // Gaussian numerical integration
})) {
  passed++;
} else {
  failed++;
}

// Test 6: Multi-Curve Demand Conservation
if (runTest('Test 6: Multi-curve - served + shed ≈ total (50k + 75k = 125k)', () => {
  const curves = [
    {
      id: 'curve-1',
      type: 'linear',
      totalDemand: 50000,
      priority: 1,
      color: '#818cf8'
    },
    {
      id: 'curve-2',
      type: 'gaussian',
      totalDemand: 75000,
      peakHour: 12,
      curveWidth: 2,
      priority: 2,
      color: '#a78bfa'
    }
  ];

  const { metrics } = runFullSimulation(80, curves, 60);
  const total = metrics.totalUtilization + metrics.shedDemand;

  assert.close(total, 125000, 0.001);
})) {
  passed++;
} else {
  failed++;
}

// Test 7: Priority Processing (P1 before P2)
if (runTest('Test 7: Priority 1 gets capacity before Priority 2', () => {
  const curves = [
    {
      id: 'p1',
      type: 'linear',
      totalDemand: 216000, // 150 per minute
      priority: 1,
      color: '#818cf8'
    },
    {
      id: 'p2',
      type: 'linear',
      totalDemand: 144000, // 100 per minute
      priority: 2,
      color: '#a78bfa'
    }
  ];

  const { metrics } = runFullSimulation(100, curves, 30);

  // P1 should get all capacity (100 cidu/min × 1440 min = 144k)
  // P2 should get nothing
  assert.close(metrics.byCurve.p1.totalUtilization, 144000, 0.001);
  assert.equal(metrics.byCurve.p2.totalUtilization, 0);

  // P1 should shed: 216k - 144k = 72k
  assert.close(metrics.byCurve.p1.shedDemand, 72000, 0.001);
  // P2 should shed all: 144k
  assert.close(metrics.byCurve.p2.shedDemand, 144000, 0.001);
})) {
  passed++;
} else {
  failed++;
}

// Test 8: Fair Sharing - Identical curves at same priority share equally
if (runTest('Test 8: Identical curves at same priority share shedding equally', () => {
  const curves = [
    {
      id: 'curve-1',
      type: 'gaussian',
      totalDemand: 50000,
      peakHour: 15,
      curveWidth: 3,
      priority: 1,
      color: '#818cf8'
    },
    {
      id: 'curve-2',
      type: 'gaussian',
      totalDemand: 50000,
      peakHour: 15,
      curveWidth: 3,
      priority: 1,
      color: '#a78bfa'
    }
  ];

  // Use limited capacity so there's shedding
  const { metrics } = runFullSimulation(100, curves, 30);

  // Both curves should have equal shedding (within 1%)
  const shed1 = metrics.byCurve['curve-1'].shedDemand;
  const shed2 = metrics.byCurve['curve-2'].shedDemand;
  const shedRatio = shed1 / shed2;

  if (shedRatio < 0.99 || shedRatio > 1.01) {
    throw new Error(`Shedding not equal: curve1=${shed1}, curve2=${shed2}, ratio=${shedRatio.toFixed(3)}`);
  }

  // Both curves should have equal utilization (within 1%)
  const util1 = metrics.byCurve['curve-1'].totalUtilization;
  const util2 = metrics.byCurve['curve-2'].totalUtilization;
  const utilRatio = util1 / util2;

  if (utilRatio < 0.99 || utilRatio > 1.01) {
    throw new Error(`Utilization not equal: curve1=${util1}, curve2=${util2}, ratio=${utilRatio.toFixed(3)}`);
  }
})) {
  passed++;
} else {
  failed++;
}

// ========== SUMMARY ==========

console.log('\n' + '='.repeat(40));
console.log(`Results: ${passed}/${passed + failed} tests passed`);
if (failed > 0) {
  console.log(`\x1b[31m${failed} test(s) failed\x1b[0m`);
  process.exit(1);
} else {
  console.log(`\x1b[32mAll tests passed!\x1b[0m`);
  process.exit(0);
}
