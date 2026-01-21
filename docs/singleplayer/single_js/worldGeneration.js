// World Generation System
// Uses seeded RNG for consistent terrain generation

// Import world constants - ensure we match the main game constants
const WORLD_GEN_SIZE = (typeof WORLD_SIZE !== 'undefined') ? WORLD_SIZE : 5000;
const WORLD_GEN_GRID_SIZE = (typeof GRID_CELL_SIZE !== 'undefined') ? GRID_CELL_SIZE : 100;
const WORLD_GEN_BLOCK_GRID_SIZE = (typeof GRID_SIZE !== 'undefined') ? GRID_SIZE : 32;

// Reintroduce exact alignment to both grids via LCM (e.g., lcm(100,32)=800)
function __gcd(a, b) { while (b) { const t = b; b = a % b; a = t; } return Math.abs(a || 1); }
function __lcm(a, b) { return Math.abs(a * b) / __gcd(a, b); }
const WORLD_GEN_BIOME_BASE = __lcm(WORLD_GEN_GRID_SIZE, WORLD_GEN_BLOCK_GRID_SIZE);

// World generation constants - grid-aligned biomes
// BIOME_CELL_SIZE must be a multiple of GRID size to ensure perfect alignment
const WORLD_GEN = {
  CHUNK_SIZE: 500,                     // render chunk size (LCM of 32 & 100 for grid alignment)
  // Use block grid size for render tiles so background aligns with blocks and placement (e.g., 32)
  RENDER_TILE_SIZE: WORLD_GEN_BLOCK_GRID_SIZE,
  TILE_SIZE: WORLD_GEN_GRID_SIZE,     // keep resource grid size (100) for any logic that needs it
  BIOME_CELL_SIZE: WORLD_GEN_BIOME_BASE, // biomes aligned to both resource and block grids (e.g., 800px)
  // Base noise scales (will be multiplied by NOISE_ZOOM)
  LAND_INDEX_SCALE_BASE: 0.04,        // lower -> larger regions
  WATER_INDEX_SCALE_BASE: 0.08,       // pond noise scale
  RIVER_INDEX_SCALE_BASE: 0.05,       // river band noise scale
  NOISE_ZOOM: 0.3,                    // a bit more zoomed out for bigger regions
  RIVER_BAND: 0.035,                  // used by noise-mode rivers (kept for compatibility)
  WARP_STRENGTH: 0.6,                 // domain warp amount for organic shapes
  POND_THRESHOLD: 0.72,               // moderate threshold to bring ponds back
  POND_DENSITY: 1.05,                 // slightly fewer ponds overall
  POND_WORLD_SCALE_BASE: 0.0020,      // base size in world space
  POND_SCALE_MULT: 5,               // slightly larger than tiny for visibility
  FOREST_THRESHOLD: 0.1,              // (unused now) kept for potential future tuning
  // Carved river settings
  RIVER_MODE: 'carved',               // 'carved' | 'noise'
  RIVER_ORIENTATION: 'auto',          // 'vertical' | 'horizontal' | 'auto' (per-river seeded)
  RIVER_COUNT: 1,                     // number of main rivers
  RIVER_MEANDER: 0.6,                 // meander intensity for carved rivers
  RIVER_STEP_PX: 64,                  // step length per iteration (in world px)
  RIVER_WIDTH_PX: 96,                 // river half-width for classification
  SAND_WIDTH_PX: 64,                  // extra band beyond river for sand
  RIVER_WIDTH_CELLS: 1                // legacy (grid rivers)
};

// Simplified biome system - land/water + sand shore (between river and land)
const BIOMES = {
  SAND: {
    id: 'sand',
    color: '#f1c27d',
    name: 'Sand',
    resources: {
      // Disable all spawns on sand for now
      food: 0.0,
      wood: 0.0,
      stone: 0.0,
      iron: 0.0,
      gold: 0.0
    },
    backgroundColor: '#f1c27d'
  },
  FOREST: {
    id: 'forest',
    color: '#2E7D32',
    name: 'Forest',
    resources: {
      food: 0.9,    // Very high food (berries, etc.)
      wood: 1.0,    // Maximum wood spawn
      stone: 0.2,   // Little stone
      iron: 0.1,    // Little iron
      gold: 0.0     // No gold in forest
    },
    backgroundColor: '#388E3C'
  },
  
  POND: {
    id: 'pond',
    color: '#1976D2',
    name: 'Pond',
    resources: {
      food: 0.6,    // Moderate food (fish)
      wood: 0.1,    // Very few trees
      stone: 0.3,   // Some stone at edges
      iron: 0.2,    // Some iron
      gold: 0.0     // No gold in ponds
    },
    backgroundColor: '#42A5F5'
  },
  
  RIVER: {
    id: 'river',
    color: '#0D47A1',
    name: 'River',
    resources: {
      food: 0.4,    // Some food (fish)
      wood: 0.0,    // No trees in river
      stone: 0.5,   // Good stone (riverbed)
      iron: 0.4,    // Good iron deposits
      gold: 0.45    // Gold only in riverbed
    },
    backgroundColor: '#1E88E5'
  }
};

// Seeded Perlin 2D with fBM
class Perlin2D {
  constructor(seed) {
    this.perm = new Uint8Array(512);
    this._init(seed >>> 0);
  }
  _init(seed) {
    // Mulberry32 RNG
    let t = seed >>> 0;
    const rand = () => {
      t += 0x6D2B79F5;
      let x = Math.imul(t ^ (t >>> 15), 1 | t);
      x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      const tmp = p[i]; p[i] = p[j]; p[j] = tmp;
    }
    for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255];
  }
  static fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
  static lerp(a, b, t) { return a + t * (b - a); }
  static grad(hash, x, y) {
    switch (hash & 7) {
      case 0: return  x + y;
      case 1: return -x + y;
      case 2: return  x - y;
      case 3: return -x - y;
      case 4: return  x;
      case 5: return -x;
      case 6: return  y;
      default:return -y;
    }
  }
  noise(x, y) {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const aa = this.perm[X + this.perm[Y]];
    const ab = this.perm[X + this.perm[Y + 1]];
    const ba = this.perm[X + 1 + this.perm[Y]];
    const bb = this.perm[X + 1 + this.perm[Y + 1]];
    const u = Perlin2D.fade(xf);
    const v = Perlin2D.fade(yf);
    const x1 = Perlin2D.lerp(Perlin2D.grad(aa, xf, yf), Perlin2D.grad(ba, xf - 1, yf), u);
    const x2 = Perlin2D.lerp(Perlin2D.grad(ab, xf, yf - 1), Perlin2D.grad(bb, xf - 1, yf - 1), u);
    return Perlin2D.lerp(x1, x2, v);
  }
  fbm(x, y, octaves = 4, persistence = 0.5, lacunarity = 2.0) {
    let amp = 1, freq = 1, sum = 0, maxSum = 0;
    for (let i = 0; i < octaves; i++) {
      sum += this.noise(x * freq, y * freq) * amp;
      maxSum += amp;
      amp *= persistence;
      freq *= lacunarity;
    }
    return sum / maxSum;
  }
}

// World generation class
class WorldGenerator {
  constructor(worldSeed) {
    this.worldSeed = worldSeed;
    this.perlinMain = new Perlin2D(worldSeed);
    this.perlinWater = new Perlin2D(worldSeed + 1000);
    this.terrainCache = new Map(); // Cache generated terrain data
    // Biome grid (precomputed, grid-aligned)
    this.biomeGrid = null;
    this.biomeCols = 0;
    this.biomeRows = 0;
    // Continuous river polylines (arrays of {x,y})
    this.riverLines = [];
    this.buildBiomeGrid();
    this.buildRiversContinuous();
  }

  // Continuous base biome classifier (organic shapes, no river/sand here)
  _classifyBase(worldX, worldY) {
  const cell = WORLD_GEN.BIOME_CELL_SIZE;
  const ix = worldX / cell;
  const iy = worldY / cell;

    // Ponds via high water noise values with warp
    {
      // Use world-space pond scale so ponds retain size regardless of biome cell size
  const pondScale = (WORLD_GEN.POND_WORLD_SCALE_BASE / Math.max(0.0001, WORLD_GEN.NOISE_ZOOM)) / Math.max(0.1, WORLD_GEN.POND_SCALE_MULT);
      const bx = worldX * pondScale;
      const by = worldY * pondScale;
      const warpX = this.perlinWater.fbm(bx * 0.5, by * 0.5, 3, 0.5, 2.0) * WORLD_GEN.WARP_STRENGTH;
      const warpY = this.perlinMain.fbm(bx * 0.5 + 7.31, by * 0.5 + 3.17, 3, 0.5, 2.0) * WORLD_GEN.WARP_STRENGTH;
      let w = (this.perlinWater.fbm(bx + warpX, by + warpY, 3, 0.5, 2.0) + 1) / 2; // 0..1
  w = Math.min(1, Math.max(0, w * WORLD_GEN.POND_DENSITY));
  if (w > WORLD_GEN.POND_THRESHOLD) return BIOMES.POND;
    }
    return BIOMES.FOREST;
  }

  // Build continuous snake-like rivers as polylines across the world
  buildRiversContinuous() {
    this.riverLines = [];
    if (WORLD_GEN.RIVER_MODE !== 'carved' || WORLD_GEN.RIVER_COUNT <= 0) return;
    const step = WORLD_GEN.RIVER_STEP_PX;
    const maxSteps = Math.ceil(WORLD_GEN_SIZE / step) * 3;
    for (let i = 0; i < WORLD_GEN.RIVER_COUNT; i++) {
      // Choose orientation and starting edge (seeded, or forced by setting)
      const seededVal = this.perlinMain.noise(912.77 + i * 7.31, 415.19 + i * 3.73);
      const orientation = (WORLD_GEN.RIVER_ORIENTATION === 'vertical' || WORLD_GEN.RIVER_ORIENTATION === 'horizontal')
        ? WORLD_GEN.RIVER_ORIENTATION
        : (seededVal >= 0 ? 'vertical' : 'horizontal');

      // For vertical: start top or bottom. For horizontal: start left or right.
      const startFromPositiveEdge = this.perlinMain.noise(111.11 + i * 5.55, 222.22 + i * 4.44) >= 0; // true => top/right
      let x, y;
      if (orientation === 'vertical') {
        x = ((this.perlinMain.fbm(10 + i * 3.17, 20 + i * 5.23, 2, 0.5, 2.0) + 1) * 0.5) * (WORLD_GEN_SIZE - step) + step * 0.5;
        y = startFromPositiveEdge ? step * 0.5 : (WORLD_GEN_SIZE - step * 0.5);
      } else { // horizontal
        x = startFromPositiveEdge ? step * 0.5 : (WORLD_GEN_SIZE - step * 0.5);
        y = ((this.perlinMain.fbm(30 + i * 7.13, 40 + i * 9.19, 2, 0.5, 2.0) + 1) * 0.5) * (WORLD_GEN_SIZE - step) + step * 0.5;
      }
      const line = [{ x, y }];
      // Base flow direction points toward the opposite edge along the main axis
      let dirX = 0, dirY = 0;
      if (orientation === 'vertical') {
        dirX = 0;
        dirY = startFromPositiveEdge ? 1 : -1;
      } else {
        dirX = startFromPositiveEdge ? 1 : -1;
        dirY = 0;
      }
      for (let s = 0; s < maxSteps; s++) {
        const t = s / Math.max(1, maxSteps - 1);
        // Lateral meander using Perlin
        const n = this.perlinMain.noise((i + 1) * 5 + t * 6, (i + 3) * 7 + t * 4);
        // Build a perpendicular vector
        let perpX = -dirY;
        let perpY = dirX;
        // Normalize (dirX,dirY) already unit among {0,1} combos; perp okay
        const meander = WORLD_GEN.RIVER_MEANDER * (0.5 + 0.5 * n);
        // Combine forward + lateral
        const vx = dirX + perpX * (meander * 0.8);
        const vy = dirY + perpY * (meander * 0.8);
        // Normalize
        const len = Math.max(0.0001, Math.hypot(vx, vy));
        const stepX = (vx / len) * step;
        const stepY = (vy / len) * step;
        x += stepX; y += stepY;
        // Clamp and stop at boundaries
        if (x < 0) x = 0; if (x > WORLD_GEN_SIZE) x = WORLD_GEN_SIZE;
        if (y < 0) y = 0; if (y > WORLD_GEN_SIZE) y = WORLD_GEN_SIZE;
        line.push({ x, y });
        // Update base flow to bias towards destination edge on main axis
        if (orientation === 'vertical') {
          // Keep forward sign toward opposite edge; vary lateral sign a bit
          dirY = startFromPositiveEdge ? 1 : -1;
          dirX = Math.sign(this.perlinMain.noise(100 + i * 3 + t * 8, 200 + i * 2) + 0.02);
        } else { // horizontal
          dirX = startFromPositiveEdge ? 1 : -1;
          dirY = Math.sign(this.perlinMain.noise(300 + i * 4, 400 + i * 5 + t * 8) + 0.02);
        }
        // Stop when we reach the opposite edge on the main axis
        const nearTop = y <= step * 0.5;
        const nearBottom = y >= WORLD_GEN_SIZE - step * 0.5;
        const nearLeft = x <= step * 0.5;
        const nearRight = x >= WORLD_GEN_SIZE - step * 0.5;
        if (orientation === 'vertical') {
          if (startFromPositiveEdge ? nearBottom : nearTop) break;
        } else {
          if (startFromPositiveEdge ? nearRight : nearLeft) break;
        }
      }
      this.riverLines.push(line);
    }
  }

  // Compute shortest distance to any river polyline
  _distanceToRivers(worldX, worldY) {
    let best = Infinity;
    for (const line of this.riverLines) {
      for (let i = 0; i < line.length - 1; i++) {
        const ax = line[i].x, ay = line[i].y;
        const bx = line[i + 1].x, by = line[i + 1].y;
        const abx = bx - ax, aby = by - ay;
        const apx = worldX - ax, apy = worldY - ay;
        const abLen2 = abx * abx + aby * aby || 1;
        let t = (apx * abx + apy * aby) / abLen2; t = Math.max(0, Math.min(1, t));
        const px = ax + abx * t, py = ay + aby * t;
        const d = Math.hypot(worldX - px, worldY - py);
        if (d < best) best = d;
      }
    }
    return best;
  }
  
  // Precompute a grid-aligned biome map for the entire world
  buildBiomeGrid() {
    const cell = WORLD_GEN.BIOME_CELL_SIZE;
    // Clear any cached terrain as biomes will change with zoom
    if (this.terrainCache) this.terrainCache.clear();
    // Effective noise scales after applying zoom
  const LAND_INDEX_SCALE = WORLD_GEN.LAND_INDEX_SCALE_BASE * WORLD_GEN.NOISE_ZOOM;
  const WATER_INDEX_SCALE = WORLD_GEN.WATER_INDEX_SCALE_BASE * WORLD_GEN.NOISE_ZOOM;
  const RIVER_INDEX_SCALE = WORLD_GEN.RIVER_INDEX_SCALE_BASE * WORLD_GEN.NOISE_ZOOM;
    this.biomeCols = Math.ceil(WORLD_GEN_SIZE / cell);
    this.biomeRows = Math.ceil(WORLD_GEN_SIZE / cell);
    this.biomeGrid = new Array(this.biomeRows);
    for (let r = 0; r < this.biomeRows; r++) {
      this.biomeGrid[r] = new Array(this.biomeCols);
    }

  // 1) Base land classification: default to FOREST; we can use land noise later for sub-variants
    const baseLand = new Array(this.biomeRows);
    for (let r = 0; r < this.biomeRows; r++) baseLand[r] = new Array(this.biomeCols);
    for (let r = 0; r < this.biomeRows; r++) {
      for (let c = 0; c < this.biomeCols; c++) {
        // Index-based noise to create coherent patches without off-grid artifacts
        // index-based land noise (reserved for future, currently unused)
        const nx = c * LAND_INDEX_SCALE;
        const ny = r * LAND_INDEX_SCALE;
  const _n = this.perlinMain.fbm(nx, ny, 2, 0.5, 2.0);
        const landBiome = BIOMES.FOREST;
        baseLand[r][c] = landBiome;
        this.biomeGrid[r][c] = landBiome;
      }
    }

    // 2) Ponds: overwrite some cells with pond based on water noise threshold
    for (let r = 0; r < this.biomeRows; r++) {
      for (let c = 0; c < this.biomeCols; c++) {
    // Precomputed grid uses cell center world coordinates for pond noise
    const centerX = (c + 0.5) * cell;
    const centerY = (r + 0.5) * cell;
  const pondScale = (WORLD_GEN.POND_WORLD_SCALE_BASE / Math.max(0.0001, WORLD_GEN.NOISE_ZOOM)) / Math.max(0.1, WORLD_GEN.POND_SCALE_MULT);
    const pbx = centerX * pondScale;
    const pby = centerY * pondScale;
  const warpX = this.perlinWater.fbm(pbx * 0.5, pby * 0.5, 3, 0.5, 2.0) * WORLD_GEN.WARP_STRENGTH;
  const warpY = this.perlinMain.fbm(pbx * 0.5 + 7.31, pby * 0.5 + 3.17, 3, 0.5, 2.0) * WORLD_GEN.WARP_STRENGTH;
  let w = (this.perlinWater.fbm(pbx + warpX, pby + warpY, 3, 0.5, 2.0) + 1) / 2; // 0..1
  w = Math.min(1, Math.max(0, w * WORLD_GEN.POND_DENSITY));
        if (w > WORLD_GEN.POND_THRESHOLD) {
          this.biomeGrid[r][c] = BIOMES.POND;
        }
      }
    }

    // 2b) Smooth ponds to avoid isolated single cells (simple neighbor pass)
    const inBounds = (rr, cc) => rr >= 0 && rr < this.biomeRows && cc >= 0 && cc < this.biomeCols;
    const pondGrid = this.biomeGrid.map(row => row.slice());
    for (let r = 0; r < this.biomeRows; r++) {
      for (let c = 0; c < this.biomeCols; c++) {
        if (pondGrid[r][c] !== BIOMES.POND) continue;
        let neighbors = 0;
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const rr = r + dr, cc = c + dc;
            if (inBounds(rr, cc) && pondGrid[rr][cc] === BIOMES.POND) neighbors++;
          }
        }
        // If few pond neighbors, revert to base land to reduce scatter
        if (neighbors <= 2) this.biomeGrid[r][c] = baseLand[r][c];
      }
    }

    if (WORLD_GEN.RIVER_MODE === 'noise') {
      // 3) Rivers via noise band around 0 with domain warping, then width expansion
      for (let r = 0; r < this.biomeRows; r++) {
        for (let c = 0; c < this.biomeCols; c++) {
          const rx = c * RIVER_INDEX_SCALE;
          const ry = r * RIVER_INDEX_SCALE;
          const warpX = this.perlinMain.fbm(rx * 0.6 + 11.1, ry * 0.6 + 5.7, 2, 0.5, 2.0) * (WORLD_GEN.WARP_STRENGTH * 0.6);
          const warpY = this.perlinWater.fbm(rx * 0.6 + 2.3, ry * 0.6 + 19.8, 2, 0.5, 2.0) * (WORLD_GEN.WARP_STRENGTH * 0.6);
          const n = this.perlinMain.noise(rx + warpX, ry + warpY);
          if (Math.abs(n) < WORLD_GEN.RIVER_BAND) {
            this.biomeGrid[r][c] = BIOMES.RIVER;
          }
        }
      }

      // Width expansion for rivers
      if (WORLD_GEN.RIVER_WIDTH_CELLS > 0) {
        const copy = this.biomeGrid.map(row => row.slice());
        for (let r = 0; r < this.biomeRows; r++) {
          for (let c = 0; c < this.biomeCols; c++) {
            if (copy[r][c] === BIOMES.RIVER) {
              for (let dr = -WORLD_GEN.RIVER_WIDTH_CELLS; dr <= WORLD_GEN.RIVER_WIDTH_CELLS; dr++) {
                for (let dc = -WORLD_GEN.RIVER_WIDTH_CELLS; dc <= WORLD_GEN.RIVER_WIDTH_CELLS; dc++) {
                  const rr = r + dr, cc = c + dc;
                  if (inBounds(rr, cc)) this.biomeGrid[rr][cc] = BIOMES.RIVER;
                }
              }
            }
          }
        }
      }

      // 4) Add sand shoreline (for noise mode): land cells adjacent to river become sand (but do not add sand near ponds)
      const riverCopy = this.biomeGrid.map(row => row.slice());
      for (let r = 0; r < this.biomeRows; r++) {
        for (let c = 0; c < this.biomeCols; c++) {
          if (riverCopy[r][c] !== BIOMES.FOREST) continue; // only land turns into sand
          let nearRiver = false;
          let nearPond = false;
          for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              if (dr === 0 && dc === 0) continue;
              const rr = r + dr, cc = c + dc;
              if (!inBounds(rr, cc)) continue;
              const b = riverCopy[rr][cc];
              if (b === BIOMES.RIVER) nearRiver = true;
              if (b === BIOMES.POND) nearPond = true;
            }
          }
          if (nearRiver && !nearPond) {
            this.biomeGrid[r][c] = BIOMES.SAND;
          }
        }
      }
    }

    // (carved rivers disabled when using noise-band rivers)
  }

  _carveRiverPath(index, widthCells) {
    // Start on a random edge (top or left) and flow to opposite edge
    const cols = this.biomeCols, rows = this.biomeRows;
    const useTopEdge = ((index % 2) === 0);
  let c = Math.floor(((this.perlinMain.fbm((index + 1) * 0.13, (index + 7) * 0.17, 1, 0.5, 2.0) + 1) / 2) * (cols - 1));
  let r = useTopEdge ? 0 : Math.floor(((this.perlinMain.fbm((index + 3) * 0.23, (index + 11) * 0.29, 1, 0.5, 2.0) + 1) / 2) * (rows - 1));

    const maxSteps = useTopEdge ? rows * 2 : cols * 2;
    for (let step = 0; step < maxSteps; step++) {
      // Carve river cells with given width
      for (let dy = -widthCells; dy <= widthCells; dy++) {
        for (let dx = -widthCells; dx <= widthCells; dx++) {
          const rr = r + dy;
          const cc = c + dx;
          if (rr >= 0 && rr < rows && cc >= 0 && cc < cols) {
            this.biomeGrid[rr][cc] = BIOMES.RIVER;
          }
        }
      }

      // Determine next step direction (biased forward + slight meander)
      if (useTopEdge) {
        // Flow downward, meander left/right by noise
        const t = step / Math.max(1, rows - 1);
  const lateral = this.perlinMain.noise((index + 1) * 10 + t * 2, (index + 5) * 7) * WORLD_GEN.RIVER_MEANDER;
        c += (lateral > 0.15 ? 1 : (lateral < -0.15 ? -1 : 0));
        r += 1; // always move forward
      } else {
        // Flow rightward, meander up/down by noise
        const t = step / Math.max(1, cols - 1);
  const lateral = this.perlinMain.noise((index + 9) * 8, (index + 2) * 10 + t * 2) * WORLD_GEN.RIVER_MEANDER;
        r += (lateral > 0.15 ? 1 : (lateral < -0.15 ? -1 : 0));
        c += 1; // always move forward
      }

      // Clamp to bounds
      if (c < 0) c = 0; if (c >= cols) c = cols - 1;
      if (r < 0) r = 0; if (r >= rows) { r = rows - 1; break; }
    }
  }

  // Biome lookup using continuous classifier with sand band near rivers (not ponds)
  getBiome(worldX, worldY) {
    const base = this._classifyBase(worldX, worldY);
    // Snake rivers via carved polylines
    if (WORLD_GEN.RIVER_MODE === 'carved' && this.riverLines.length > 0) {
      const d = this._distanceToRivers(worldX, worldY);
      const riverW = WORLD_GEN.RIVER_WIDTH_PX;
      const sandW = riverW + WORLD_GEN.SAND_WIDTH_PX;
      if (d <= riverW * 0.5) return BIOMES.RIVER;
      // Only create sand if base is forest and not next to a pond
      if (base === BIOMES.FOREST && d <= sandW * 0.5) {
        // Check pond proximity using base classifier around current point
        const step = WORLD_GEN_BLOCK_GRID_SIZE;
        let nearPond = false;
        for (let dy = -step; dy <= step; dy += step) {
          for (let dx = -step; dx <= step; dx += step) {
            if (dx === 0 && dy === 0) continue;
            if (this._classifyBase(worldX + dx, worldY + dy) === BIOMES.POND) { nearPond = true; break; }
          }
          if (nearPond) break;
        }
        if (!nearPond) return BIOMES.SAND;
      }
      return base;
    }
    // Fallback to noise-band rivers if enabled
    if (WORLD_GEN.RIVER_MODE === 'noise') {
      // Use prior river band inside base classifier if needed
      // For simplicity, treat base==RIVER as river
      if (base === BIOMES.RIVER) return BIOMES.RIVER;
      // Else apply sand adjacency check via base sampling
      if (base === BIOMES.FOREST) {
        const step = WORLD_GEN_BLOCK_GRID_SIZE;
        let nearRiver = false, nearPond = false;
        for (let dy = -step; dy <= step; dy += step) {
          for (let dx = -step; dx <= step; dx += step) {
            if (dx === 0 && dy === 0) continue;
            const b = this._classifyBase(worldX + dx, worldY + dy);
            if (b === BIOMES.RIVER) nearRiver = true;
            if (b === BIOMES.POND) nearPond = true;
          }
        }
        if (nearRiver && !nearPond) return BIOMES.SAND;
      }
      return base;
    }
    return base;
  }
  
  // Simple elevation based on distance from water
  getElevation(worldX, worldY) {
    const biome = this.getBiome(worldX, worldY);
    
    // Water areas have low elevation
    if (biome.id === 'pond' || biome.id === 'river') {
      return 0.1;
    }
    
    // Land areas have higher elevation
    return 0.6;
  }
  
  // Get terrain chunk data aligned with block grid for rendering
  getTerrainChunk(chunkX, chunkY) {
    const chunkKey = `${chunkX},${chunkY}`;
    
    // Check cache first
    if (this.terrainCache.has(chunkKey)) {
      return this.terrainCache.get(chunkKey);
    }
    
    // Generate new chunk
    const chunk = {
      x: chunkX,
      y: chunkY,
      tiles: []
    };
    
    // Generate tiles aligned to the GLOBAL block grid (32px) so seams match across chunks
    const step = WORLD_GEN.RENDER_TILE_SIZE || WORLD_GEN_BLOCK_GRID_SIZE;
    const minX = chunkX * WORLD_GEN.CHUNK_SIZE;
    const minY = chunkY * WORLD_GEN.CHUNK_SIZE;
    const maxX = minX + WORLD_GEN.CHUNK_SIZE;
    const maxY = minY + WORLD_GEN.CHUNK_SIZE;

    // Start from the nearest lower multiple of step to keep world-aligned grid
    const startX = Math.floor(minX / step) * step;
    const startY = Math.floor(minY / step) * step;

    for (let y = startY; y < maxY; y += step) {
      for (let x = startX; x < maxX; x += step) {
        if (x >= WORLD_GEN_SIZE || y >= WORLD_GEN_SIZE || x < 0 || y < 0) continue;
        // Clamp at edges so we never spill over chunk/world
        const w = Math.min(step, maxX - x, Math.max(0, WORLD_GEN_SIZE - x));
        const h = Math.min(step, maxY - y, Math.max(0, WORLD_GEN_SIZE - y));
        if (w <= 0 || h <= 0) continue;
        const cx = x + w * 0.5;
        const cy = y + h * 0.5;
        const biome = this.getBiome(cx, cy);
        const elevation = this.getElevation(cx, cy);
        chunk.tiles.push({ x, y, w, h, biome, elevation });
      }
    }
    
    // Cache the chunk
    this.terrainCache.set(chunkKey, chunk);
    return chunk;
  }
  
  // Get resource spawn multiplier for a location
  getResourceSpawnMultiplier(worldX, worldY, resourceType) {
    const biome = this.getBiome(worldX, worldY);
    return biome.resources[resourceType] || 0;
  }
  
  // Check if a location is suitable for resource spawning
  isValidResourceLocation(worldX, worldY, resourceType) {
    const biome = this.getBiome(worldX, worldY);
    const multiplier = biome.resources[resourceType] || 0;
    // No ocean biome; rivers/ponds allow limited resources via multiplier
    return multiplier > 0;
  }
}

// Global world generator instance
let worldGenerator = null;

// Initialize world generation
function initializeWorldGeneration(worldSeed) {
  if (!worldSeed) {
    console.warn('No world seed provided for world generation');
    return;
  }
  
  worldGenerator = new WorldGenerator(worldSeed);
  console.log('World generator initialized with seed:', worldSeed);
  // Keep global reference in sync for other modules/debug
  if (typeof window !== 'undefined') {
    window.worldGenerator = worldGenerator;
  }
}

// Set noise zoom (lower = bigger continents). Rebuilds biome grid.
function setWorldNoiseZoom(zoom) {
  const z = Math.max(0.05, Math.min(5, Number(zoom) || 1));
  WORLD_GEN.NOISE_ZOOM = z;
  if (worldGenerator) {
    worldGenerator.buildBiomeGrid();
    worldGenerator.buildRiversContinuous();
  }
  console.log('World noise zoom set to', z);
}

// Live pond tuning
function setPondThreshold(v) {
  const t = Math.max(0, Math.min(1, Number(v)));
  WORLD_GEN.POND_THRESHOLD = t;
  if (worldGenerator) worldGenerator.buildBiomeGrid();
  console.log('Pond threshold set to', t);
}
function setPondDensity(v) {
  const d = Math.max(0.1, Math.min(5, Number(v)));
  WORLD_GEN.POND_DENSITY = d;
  if (worldGenerator) worldGenerator.buildBiomeGrid();
  console.log('Pond density set to', d);
}

function setPondScaleMultiplier(v) {
  const m = Math.max(0.25, Math.min(10, Number(v)));
  WORLD_GEN.POND_SCALE_MULT = m;
  if (worldGenerator) worldGenerator.buildBiomeGrid();
  console.log('Pond scale multiplier set to', m);
}

// Get biome at specific world coordinates
function getBiomeAtPosition(worldX, worldY) {
  if (!worldGenerator) {
    console.warn('World generator not initialized');
    return BIOMES.FOREST; // Default fallback
  }
  
  return worldGenerator.getBiome(worldX, worldY);
}

// Get elevation at specific world coordinates
function getElevationAtPosition(worldX, worldY) {
  if (!worldGenerator) {
    return 0.5; // Default elevation
  }
  
  return worldGenerator.getElevation(worldX, worldY);
}

// Check if resource can spawn at location based on biome
function canResourceSpawnAtLocation(worldX, worldY, resourceType) {
  if (!worldGenerator) {
    return true; // Allow spawning if no world gen
  }
  
  return worldGenerator.isValidResourceLocation(worldX, worldY, resourceType);
}

// Get resource spawn chance multiplier for location
function getResourceSpawnChance(worldX, worldY, resourceType) {
  if (!worldGenerator) {
    return 1.0; // Default multiplier
  }
  
  return worldGenerator.getResourceSpawnMultiplier(worldX, worldY, resourceType);
}

// Draw terrain background (replaces simple grass background)
function drawTerrainBackground() {
  if (!worldGenerator || !camera) {
    return;
  }

  // Draw per 32px block to show organic shapes while staying aligned to block grid
  const step = WORLD_GEN_BLOCK_GRID_SIZE;
  const startX = Math.max(0, Math.floor(camera.x / step) * step);
  const startY = Math.max(0, Math.floor(camera.y / step) * step);
  const endX = Math.min(WORLD_GEN_SIZE, Math.ceil((camera.x + camera.width) / step) * step);
  const endY = Math.min(WORLD_GEN_SIZE, Math.ceil((camera.y + camera.height) / step) * step);

  for (let y = startY; y < endY; y += step) {
    for (let x = startX; x < endX; x += step) {
      const biome = worldGenerator.getBiome(x + step * 0.5, y + step * 0.5);
      ctx.fillStyle = biome.backgroundColor;
      ctx.fillRect(x, y, step, step);
    }
  }
}

// Draw a single terrain chunk
function drawTerrainChunk(chunk) {
  if (!chunk || !chunk.tiles) return;
  for (let i = 0; i < chunk.tiles.length; i++) {
    const tile = chunk.tiles[i];
    ctx.fillStyle = tile.biome.backgroundColor;
    ctx.fillRect(tile.x, tile.y, tile.w, tile.h);
  }
}

// Debug function to visualize biome distribution
function debugBiomeMap(centerX = 2500, centerY = 2500, size = 2000) {
  if (!worldGenerator) {
    console.log('World generator not initialized');
    return;
  }
  
  console.log('=== SIMPLIFIED BIOME MAP DEBUG ===');
  console.log(`Sampling area around (${centerX}, ${centerY}) with size ${size}x${size}`);
  console.log(`World size: ${WORLD_GEN_SIZE}, Grid size: ${WORLD_GEN_GRID_SIZE}`);
  console.log(`Noise zoom: ${WORLD_GEN.NOISE_ZOOM} (lower = bigger features)`);
  
  const biomeCount = {};
  const sampleSize = WORLD_GEN_GRID_SIZE * 2; // Sample every 2 grid cells for speed
  let totalSamples = 0;
  
  for (let y = centerY - size/2; y < centerY + size/2; y += sampleSize) {
    for (let x = centerX - size/2; x < centerX + size/2; x += sampleSize) {
      if (x >= 0 && y >= 0 && x < WORLD_GEN_SIZE && y < WORLD_GEN_SIZE) {
        const biome = worldGenerator.getBiome(x, y);
        const elevation = worldGenerator.getElevation(x, y);
        
        if (!biomeCount[biome.name]) {
          biomeCount[biome.name] = { count: 0, totalElevation: 0 };
        }
        biomeCount[biome.name].count++;
        biomeCount[biome.name].totalElevation += elevation;
        totalSamples++;
      }
    }
  }
  
  console.log('Biome distribution (should show large coherent regions):');
  for (const [biomeName, data] of Object.entries(biomeCount)) {
    const percentage = ((data.count / totalSamples) * 100).toFixed(1);
    const avgElevation = (data.totalElevation / data.count * 100).toFixed(1);
    console.log(`  ${biomeName}: ${percentage}% (avg elevation: ${avgElevation}%)`);
  }
  
  // Test a grid of locations to show biome coherence
  console.log('\nBiome coherence test (should show large same-biome areas):');
  const testSize = 5; // 5x5 grid
  const spacing = 200; // 200 pixels apart
  const startX = centerX - (testSize - 1) * spacing / 2;
  const startY = centerY - (testSize - 1) * spacing / 2;
  
  for (let row = 0; row < testSize; row++) {
    let rowString = '';
    for (let col = 0; col < testSize; col++) {
      const x = startX + col * spacing;
      const y = startY + row * spacing;
      const biome = worldGenerator.getBiome(x, y);
      // Use first letter of biome name
      rowString += biome.name[0] + ' ';
    }
    console.log(`  ${rowString}`);
  }
  console.log('  (F=Forest, P=Pond, R=River, S=Sand)');
}

// Visual biome overlay for testing (call in console: showBiomeOverlay())
function showBiomeOverlay() {
  if (!worldGenerator || !player) {
    console.log('World generator or player not available');
    return;
  }
  
  // Create overlay showing biomes around player
  const overlaySize = 20; // 20x20 grid around player
  const gridSize = WORLD_GEN_GRID_SIZE;
  const startX = player.x - (overlaySize * gridSize) / 2;
  const startY = player.y - (overlaySize * gridSize) / 2;
  
  console.log('=== BIOME OVERLAY AROUND PLAYER ===');
  console.log(`Player at (${Math.floor(player.x)}, ${Math.floor(player.y)})`);
  
  for (let row = 0; row < overlaySize; row++) {
    let rowString = '';
    for (let col = 0; col < overlaySize; col++) {
      const x = startX + col * gridSize;
      const y = startY + row * gridSize;
      
      if (x >= 0 && y >= 0 && x < WORLD_GEN_SIZE && y < WORLD_GEN_SIZE) {
        const biome = worldGenerator.getBiome(x, y);
        const letter = biome.name[0];
        
        // Mark player position
        if (Math.abs(x - player.x) < gridSize/2 && Math.abs(y - player.y) < gridSize/2) {
          rowString += `[${letter}]`;
        } else {
          rowString += ` ${letter} `;
        }
      } else {
        rowString += ' - ';
      }
    }
    console.log(rowString);
  }
  console.log('Player position marked with [ ]. F=Forest, P=Pond, R=River, S=Sand');
}

// Export functions for global use
if (typeof window !== 'undefined') {
  window.initializeWorldGeneration = initializeWorldGeneration;
  window.getBiomeAtPosition = getBiomeAtPosition;
  window.getElevationAtPosition = getElevationAtPosition;
  window.canResourceSpawnAtLocation = canResourceSpawnAtLocation;
  window.getResourceSpawnChance = getResourceSpawnChance;
  window.drawTerrainBackground = drawTerrainBackground;
  window.drawTerrainChunk = drawTerrainChunk;
  window.debugBiomeMap = debugBiomeMap;
  window.showBiomeOverlay = showBiomeOverlay;
  window.setWorldNoiseZoom = setWorldNoiseZoom;
  window.setPondThreshold = setPondThreshold;
  window.setPondDensity = setPondDensity;
  window.setPondScaleMultiplier = setPondScaleMultiplier;
  window.BIOMES = BIOMES;
  window.worldGenerator = worldGenerator;
}