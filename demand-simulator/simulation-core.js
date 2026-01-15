// Demand Capacity Simulator - Core Simulation Logic
// This module contains the pure simulation algorithms extracted from demand-simulator.html
// Can be imported by both the browser UI and Node.js tests

// Gaussian function for bell curve distribution
export const gaussian = (x, mean, stdDev) => {
  const exponent = -0.5 * Math.pow((x - mean) / stdDev, 2);
  return Math.exp(exponent);
};

// Generate Gaussian demand distribution across 1440 minutes
export const generateGaussianDemand = (totalDemand, peakHour, curveWidth) => {
  const stdDevMinutes = curveWidth * 60;
  const peakMinute = peakHour * 60;
  const gaussianIntegral = stdDevMinutes * Math.sqrt(2 * Math.PI);
  const scaleFactor = totalDemand / gaussianIntegral;

  return Array.from({ length: 1440 }, (_, minute) =>
    scaleFactor * gaussian(minute, peakMinute, stdDevMinutes)
  );
};

// Generate Linear demand distribution (constant throughout day)
export const generateLinearDemand = (totalDemand) => {
  const constantDemand = totalDemand / 1440;
  return Array.from({ length: 1440 }, () => constantDemand);
};

// Run full 24-hour simulation with queue management and priority processing
export const runFullSimulation = (machines, curves, queueTimeout) => {
  const points = [];

  // Generate demand arrays for each curve
  const demandByCurve = {};
  curves.forEach(curve => {
    if (curve.type === 'linear') {
      demandByCurve[curve.id] = generateLinearDemand(curve.totalDemand);
    } else {
      // Gaussian
      demandByCurve[curve.id] = generateGaussianDemand(curve.totalDemand, curve.peakHour, curve.curveWidth);
    }
  });

  let totalUtilization = 0;
  const demandValues = [];

  // Per-curve queues: {curveId: [{arrivalTime, demand, curveId}]}
  const queuesByCurve = {};
  const utilizationByCurve = {};
  const shedByCurve = {};
  const usageValuesByCurve = {};

  curves.forEach(curve => {
    queuesByCurve[curve.id] = [];
    utilizationByCurve[curve.id] = 0;
    shedByCurve[curve.id] = 0;
    usageValuesByCurve[curve.id] = [];
  });
  let totalShedDemand = 0;

  for (let minute = 0; minute < 1440; minute++) {
    const hour = minute / 60;

    // Sum demand across all curves for this minute
    const demand = curves.reduce((sum, curve) => sum + demandByCurve[curve.id][minute], 0);

    // Step 1: Remove timed-out requests from all queues
    let shedThisMinute = 0;
    curves.forEach(curve => {
      const queue = queuesByCurve[curve.id];
      for (let i = queue.length - 1; i >= 0; i--) {
        if (minute - queue[i].arrivalTime > queueTimeout) {
          const shedAmount = queue[i].demand;
          shedThisMinute += shedAmount;
          totalShedDemand += shedAmount;
          shedByCurve[curve.id] += shedAmount; // Track per-curve shed
          queue.splice(i, 1);
        }
      }
    });

    // Step 2 & 3 & 4: Priority-based processing with global FIFO within priority levels
    // Group curves by priority
    const priorityGroups = {};
    curves.forEach(curve => {
      const p = curve.priority;
      if (!priorityGroups[p]) priorityGroups[p] = [];
      priorityGroups[p].push(curve);
    });

    // Get sorted priority levels (1 = highest priority first)
    const priorityLevels = Object.keys(priorityGroups).map(Number).sort((a, b) => a - b);

    let availableCapacity = machines;
    let actualUsage = 0;

    // Track usage per curve for this minute
    const curveUsageThisMinute = {};
    curves.forEach(curve => { curveUsageThisMinute[curve.id] = 0; });

    // Process each priority level in order
    priorityLevels.forEach(priority => {
      const curvesAtPriority = priorityGroups[priority];

      // Step 2a: Queue all new demand for curves at this priority
      curvesAtPriority.forEach(curve => {
        const newDemand = demandByCurve[curve.id][minute];
        if (newDemand > 0) {
          queuesByCurve[curve.id].push({
            arrivalTime: minute,
            demand: newDemand,
            curveId: curve.id,
            priority: curve.priority
          });
        }
      });

      // Step 2b & 3: Process queued requests using global FIFO across all curves at this priority
      // Merge all queues at this priority into a single list, sorted by arrival time
      let combinedQueue = [];
      curvesAtPriority.forEach(curve => {
        queuesByCurve[curve.id].forEach(item => {
          combinedQueue.push(item);
        });
      });

      // Sort by arrival time (FIFO) - oldest first
      combinedQueue.sort((a, b) => a.arrivalTime - b.arrivalTime);

      // Process items in FIFO order, with fair sharing for items at the same arrival time
      let i = 0;
      while (i < combinedQueue.length && availableCapacity > 0) {
        // Find all items with the same arrival time (a cohort)
        const currentArrival = combinedQueue[i].arrivalTime;
        const cohort = [];
        while (i < combinedQueue.length && combinedQueue[i].arrivalTime === currentArrival) {
          cohort.push(combinedQueue[i]);
          i++;
        }

        // Calculate total demand in this cohort
        const cohortDemand = cohort.reduce((sum, item) => sum + item.demand, 0);

        if (cohortDemand <= availableCapacity) {
          // Serve all items in cohort fully
          cohort.forEach(item => {
            actualUsage += item.demand;
            curveUsageThisMinute[item.curveId] += item.demand;
            availableCapacity -= item.demand;
            item.demand = 0;
          });
        } else {
          // Not enough capacity - distribute proportionally among cohort
          cohort.forEach(item => {
            const share = item.demand / cohortDemand;
            const served = availableCapacity * share;
            actualUsage += served;
            curveUsageThisMinute[item.curveId] += served;
            item.demand -= served;
          });
          availableCapacity = 0;
        }
      }

      // Update per-curve queues: remove fully served items, keep partially served ones
      curvesAtPriority.forEach(curve => {
        queuesByCurve[curve.id] = queuesByCurve[curve.id].filter(item => item.demand > 0);
      });
    });

    // Record per-curve utilization for this minute
    curves.forEach(curve => {
      utilizationByCurve[curve.id] += curveUsageThisMinute[curve.id];
      usageValuesByCurve[curve.id].push({ minute, usage: curveUsageThisMinute[curve.id] });
    });

    totalUtilization += actualUsage;

    // Calculate total queued demand across all curves
    const queueSize = curves.reduce((sum, curve) => {
      return sum + queuesByCurve[curve.id].reduce((qSum, item) => qSum + item.demand, 0);
    }, 0);

    demandValues.push({ minute, demand, usage: actualUsage, queueSize, shed: shedThisMinute });

    if (minute % 5 === 0) {
      const point = {
        time: `${Math.floor(hour).toString().padStart(2, "0")}:${(minute % 60).toString().padStart(2, "0")}`,
        hour,
        inputDemand: demand,
        actualUtilization: actualUsage,
        capacity: machines,
        queuedDemand: queueSize,
        shedDemand: shedThisMinute,
      };

      // Add per-curve demands
      curves.forEach(curve => {
        point[`demand_${curve.id}`] = demandByCurve[curve.id][minute];
      });

      points.push(point);
    }
  }

  // Step 5: At end of day, shed any remaining queued demand from all curves
  curves.forEach(curve => {
    queuesByCurve[curve.id].forEach(item => {
      const shedAmount = item.demand;
      totalShedDemand += shedAmount;
      shedByCurve[curve.id] += shedAmount;
    });
  });

  const sortedDemand = [...demandValues].sort((a, b) => b.usage - a.usage);
  const top180 = sortedDemand.slice(0, 180);
  const peakUtilization = top180.reduce((sum, d) => sum + d.usage, 0) / 180;
  const avgUtilization = totalUtilization / 1440;

  // Calculate aggregate total demand across all curves
  const aggregateTotalDemand = curves.reduce((sum, curve) => sum + curve.totalDemand, 0);

  // Calculate per-curve metrics
  const metricsByCurve = {};
  curves.forEach(curve => {
    const curveUsageValues = usageValuesByCurve[curve.id];
    const sortedCurveUsage = [...curveUsageValues].sort((a, b) => b.usage - a.usage);
    const top180Curve = sortedCurveUsage.slice(0, 180);
    const peakCurveUtilization = top180Curve.reduce((sum, d) => sum + d.usage, 0) / 180;
    const avgCurveUtilization = utilizationByCurve[curve.id] / 1440;

    metricsByCurve[curve.id] = {
      totalUtilization: Math.round(utilizationByCurve[curve.id]),
      peakUtilization: peakCurveUtilization.toFixed(1),
      avgUtilization: avgCurveUtilization.toFixed(1),
      shedDemand: Math.round(shedByCurve[curve.id]),
      shedPercent: ((shedByCurve[curve.id] / curve.totalDemand) * 100).toFixed(1),
    };
  });

  return {
    data: points,
    metrics: {
      totalUtilization: Math.round(totalUtilization),
      peakUtilization: peakUtilization.toFixed(1),
      avgUtilization: avgUtilization.toFixed(1),
      peakPercent: ((peakUtilization / machines) * 100).toFixed(1),
      avgPercent: ((avgUtilization / machines) * 100).toFixed(1),
      shedDemand: Math.round(totalShedDemand),
      shedPercent: ((totalShedDemand / aggregateTotalDemand) * 100).toFixed(1),
      byCurve: metricsByCurve,
    },
  };
};
