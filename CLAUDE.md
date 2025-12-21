# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is a GitHub Pages static site repository containing interactive HTML/JavaScript simulation tools. The primary tool is a demand capacity simulation for modeling resource utilization patterns.

## Project Structure

- **[demand-simulator.html](demand-simulator.html)** - Main capacity planning simulation tool
  - Uses React 18 via ESM imports (no build step required)
  - Recharts for visualization
  - Implements a queueing model with timeout-based demand shedding
- **[index.html](index.html)** - Landing page (not yet implemented)
- **[numeric-cores.html](numeric-cores.html)** - Secondary tool (out of scope for current development)

## Architecture: Demand Simulator

### Technology Stack
- **No build system** - Pure HTML with inline JavaScript modules
- **React 18.2.0** - Loaded via `esm.sh` CDN
- **Recharts 2.10.3** - Chart visualization library
- **Import maps** - Modern ES module resolution

### Core Components

The demand simulator is a single-page React application embedded in [demand-simulator.html](demand-simulator.html):

**State Management (lines 84-87)**
- `machines` - Total available capacity
- `curveWidth` - Standard deviation of demand curve (in hours)
- `totalDemand` - Daily demand volume
- `queueTimeout` - Minutes before queued requests are dropped

**URL State Synchronization (lines 73-98)**
- All parameters persist to URL query string
- On load, restores state from URL
- Updates URL when sliders change (enables sharing configurations)

**Simulation Logic (lines 102-197)**
- Generates 1440 data points (1 per minute of 24-hour day)
- Uses Gaussian distribution for demand curve
- Implements FIFO queue with timeout-based shedding:
  1. Expire and shed requests older than `queueTimeout`
  2. Serve new demand up to available capacity
  3. Queue excess demand
  4. Process queued requests with remaining capacity
  5. Shed all remaining queued demand at end of day

**Metrics Calculation**
- Peak utilization: Average of top 180 minutes (3 hours)
- Average utilization: Total utilization / 1440 minutes
- Shed demand: Total requests dropped due to timeout

### Key Implementation Details

**Gaussian Distribution (lines 66-69)**
```javascript
const gaussian = (x, mean, stdDev) => {
  const exponent = -0.5 * Math.pow((x - mean) / stdDev, 2);
  return Math.exp(exponent);
};
```
Models realistic demand patterns with configurable width.

**Queue Management (lines 112-156)**
The queue is an array of `{arrivalTime, demand}` objects. Each minute:
1. Timeouts are removed and added to shed total
2. New demand is served immediately if capacity exists
3. Excess queued with arrival time
4. Remaining capacity processes oldest queued items first

**Chart Rendering (lines 309-336)**
- Uses ResponsiveContainer for fluid sizing
- AreaChart with multiple data series
- Gradients defined in SVG `<defs>`
- Reference line shows capacity threshold

## Development Workflow

### Testing Changes
Open [demand-simulator.html](demand-simulator.html) directly in a browser (no build step needed). Use query parameters to test specific scenarios:
```
demand-simulator.html?machines=200&curveWidth=4&totalDemand=80000&queueTimeout=60
```

### Modifying the Simulation
- **Algorithm changes**: Edit the main `useMemo` block (lines 102-197)
- **UI controls**: Modify slider definitions (lines 214-250)
- **Visualization**: Update AreaChart configuration (lines 309-336)
- **Styling**: Adjust inline styles in React.createElement calls

### Adding New Metrics
1. Calculate in the main simulation loop
2. Add to `metrics` object return
3. Display in metrics panel (lines 253-282)

## Common Scenarios

### Adjusting Demand Distribution
Modify the Gaussian parameters or replace with alternative distribution function at [demand-simulator.html:117](demand-simulator.html#L117).

### Changing Queueing Behavior
The queue logic spans lines 119-156. To modify timeout behavior, adjust the expiration check at [demand-simulator.html:122](demand-simulator.html#L122).

### Updating Visual Theme
All colors use inline styles with gradient definitions. Primary color scheme uses indigo (`#6366f1`), with red for shed demand (`#ef4444`) and green for utilization metrics (`#4ade80`).

## Version Control

This repository uses Sapling (`.sl` directory), which is Git-compatible. Standard Git commands will work for version control operations.

## TODO:
- Add multiple demand sources.
- Add prioritization between them.
- Permit demand sources to be linear instead of gaussian
- consider timeshifting the day to start at peak for easier analysis, or else have two days on screen.
- consider modeling the queueing/shedding SLIs