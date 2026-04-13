export class ScalarField {
  readonly width: number;
  readonly height: number;
  readonly data: Float32Array;

  constructor(width: number, height: number, fill = 0) {
    this.width = width;
    this.height = height;
    this.data = new Float32Array(width * height).fill(fill);
  }

  get(x: number, y: number): number {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return 0;
    return this.data[y * this.width + x]!;
  }

  set(x: number, y: number, v: number): void {
    if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
      this.data[y * this.width + x] = v;
    }
  }

  /** 双线性插值采样 */
  sample(x: number, y: number): number {
    const x0 = Math.floor(x), y0 = Math.floor(y);
    const fx = x - x0, fy = y - y0;
    return this.get(x0, y0) * (1 - fx) * (1 - fy)
      + this.get(x0 + 1, y0) * fx * (1 - fy)
      + this.get(x0, y0 + 1) * (1 - fx) * fy
      + this.get(x0 + 1, y0 + 1) * fx * fy;
  }

  clone(): ScalarField {
    const f = new ScalarField(this.width, this.height);
    f.data.set(this.data);
    return f;
  }
}

export class ColorField {
  readonly width: number;
  readonly height: number;
  readonly r: Float32Array;
  readonly g: Float32Array;
  readonly b: Float32Array;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.r = new Float32Array(width * height);
    this.g = new Float32Array(width * height);
    this.b = new Float32Array(width * height);
  }

  clone(): ColorField {
    const f = new ColorField(this.width, this.height);
    f.r.set(this.r);
    f.g.set(this.g);
    f.b.set(this.b);
    return f;
  }
}
