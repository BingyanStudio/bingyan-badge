// 自动加载所有组件和配方的入口
// 只需 import 此文件一次，所有组件和配方就会注册到全局 registry

// Sources
import './sources/sdf.js';
import './sources/arc.js';
import './sources/mask.js';
import './sources/noise.js';
import './sources/voronoi.js';
import './sources/time.js';

// Transforms
import './transforms/remap.js';
import './transforms/warp.js';
import './transforms/edge.js';
import './transforms/quantize.js';
import './transforms/feedback.js';
import './transforms/invert.js';

// Lighting
import './lighting/emboss.js';
import './lighting/specular.js';
import './lighting/rim.js';
import './lighting/ao.js';

// Color
import './color/gradient.js';
import './color/hsl-shift.js';
import './color/light-apply.js';
import './color/compose.js';

// Combiners
import './combiners/combine.js';

// Recipes
import '../recipes/icon/emboss-arc-flow.js';
import '../recipes/icon/sdf-texture.js';
import '../recipes/icon/voronoi-crystal.js';
import '../recipes/icon/noise-warp-bands.js';
import '../recipes/icon/rainbow-emboss.js';
import '../recipes/icon/pulse-feedback.js';
import '../recipes/bg/solid-dark.js';
import '../recipes/bg/noise-nebula.js';
import '../recipes/bg/voronoi-cells.js';
import '../recipes/bg/sdf-glow.js';
import '../recipes/mask/sharp.js';
import '../recipes/mask/soft.js';
import '../recipes/mask/breathing.js';
import '../recipes/mask/noisy.js';
