import type { ScalarField, ColorField } from './fields.js';

// ─── 几何上下文（path-engine 的输出）───

export interface Geometry {
  width: number;
  height: number;
  scale: number;
  offsetX: number;
  offsetY: number;
  sdf: Float32Array;         // 带符号距离场：负=内部, 正=外部
  arcParam: Float32Array;    // 最近边缘点的弧长参数 [0,1)
  normalX: Float32Array;     // 最近边缘点法线X
  normalY: Float32Array;     // 最近边缘点法线Y
  insideMask: Uint8Array;    // 1=内部, 0=外部
  allPoints: PixelPoint[];
  subPaths: SubPathData[];
}

export interface PixelPoint {
  x: number; y: number;      // SVG 坐标
  px: number; py: number;    // 像素坐标
  tx: number; ty: number;    // 归一化切线
  nx: number; ny: number;    // 归一化法线
  arcLen: number;
  subPath: number;
}

export interface SubPathData {
  index: number;
  points: PathPoint[];
  pixelPoints: PixelPoint[];
  totalLength: number;
  segments: PathSegment[];
}

export interface PathPoint {
  x: number; y: number;
  tx: number; ty: number;
  nx: number; ny: number;
  arcLen: number;
}

export type PathSegment =
  | { type: 'L'; from: Vec2; to: Vec2 }
  | { type: 'C'; from: Vec2; cp1: Vec2; cp2: Vec2; to: Vec2 };

export interface Vec2 { x: number; y: number; }

// ─── 管线执行上下文 ───

export interface PipelineContext {
  geo: Geometry;
  t: number;                 // 归一化时间 [0, 1)
  feedback: Record<string, ScalarField>;  // 帧间反馈存储
}

// ─── 节点函数签名 ───
// 节点接收上下文 + 上游输入，输出一个场

export type NodeFn<Out = ScalarField | ColorField> =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (ctx: PipelineContext, ...inputs: any[]) => Out;

// ─── 组件协议 ───

export enum ComponentType {
  SOURCE = 'source',           // 无输入 → ScalarField
  TRANSFORM = 'transform',     // ScalarField → ScalarField
  COMBINER = 'combiner',       // (ScalarField, ScalarField) → ScalarField
  LIGHTING = 'lighting',       // Geometry → ScalarField
  COLOR = 'color',             // ScalarField → ColorField
  COLOR_TRANSFORM = 'color_transform', // ColorField → ColorField
  COMPOSE = 'compose',         // (ColorField, ColorField, ScalarField) → pixels
}

/** 参数 schema：字段名 → 约束 */
export interface ParamDef {
  type: 'float' | 'int' | 'enum' | 'stops';
  min?: number;
  max?: number;
  default?: number | string;
  options?: string[];          // for enum
}

export interface Component<Params = any> {
  id: string;
  type: ComponentType;
  params: Record<string, ParamDef>;
  create(params: Params): NodeFn<any>;
}

// ─── Recipe（管线配方）───

export enum RecipeSlot {
  ICON = 'icon',
  BG = 'bg',
  MASK = 'mask',
}

export interface Recipe {
  id: string;
  slot: RecipeSlot;
  build(rng: RNG, registry: ComponentRegistryReader): NodeFn<any>;
}

// ─── RNG 接口 ───

export interface RNG {
  random(): number;
  range(min: number, max: number): number;
  randInt(min: number, max: number): number;
  pick<T>(arr: T[]): T;
  pickN<T>(arr: T[], n: number): T[];
  gaussian(mean?: number, stddev?: number): number;
  biased(center: number, spread?: number): number;
  fork(): RNG;
}

// ─── Registry reader（只读视图，给 recipe 用）───

export interface ComponentRegistryReader {
  get(id: string): Component | undefined;
  listByType(type: ComponentType): Component[];
}

// ─── 渲染参数 ───

export interface RenderOptions {
  width?: number;
  height?: number;
  frames?: number;
  delay?: number;
  quality?: number;
}
