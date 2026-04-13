declare module 'gif-encoder-2' {
  class GIFEncoder {
    constructor(width: number, height: number, algorithm?: string, useOptimizer?: boolean);
    setDelay(ms: number): void;
    setRepeat(count: number): void;
    setQuality(quality: number): void;
    setTransparent(color: number | null): void;
    start(): void;
    addFrame(data: Uint8ClampedArray | Buffer): void;
    finish(): void;
    out: { getData(): Buffer };
  }
  export default GIFEncoder;
}
