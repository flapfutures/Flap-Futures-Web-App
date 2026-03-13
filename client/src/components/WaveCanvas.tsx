import { useEffect, useRef } from "react";

class ClassicalNoise {
  private grad3: number[][];
  private p: number[];
  private perm: number[];

  constructor() {
    this.grad3 = [
      [1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],
      [1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],
      [0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]
    ];
    this.p = [];
    for (let i = 0; i < 256; i++) {
      this.p[i] = Math.floor(Math.random() * 256);
    }
    this.perm = [];
    for (let i = 0; i < 512; i++) {
      this.perm[i] = this.p[i & 255];
    }
  }

  private dot(g: number[], x: number, y: number, z: number): number {
    return g[0]*x + g[1]*y + g[2]*z;
  }

  private mix(a: number, b: number, t: number): number {
    return (1.0 - t)*a + t*b;
  }

  private fade(t: number): number {
    return t*t*t*(t*(t*6.0 - 15.0) + 10.0);
  }

  noise(x: number, y: number, z: number): number {
    let X = Math.floor(x);
    let Y = Math.floor(y);
    let Z = Math.floor(z);
    x = x - X; y = y - Y; z = z - Z;
    X = X & 255; Y = Y & 255; Z = Z & 255;

    const gi000 = this.perm[X+this.perm[Y+this.perm[Z]]] % 12;
    const gi001 = this.perm[X+this.perm[Y+this.perm[Z+1]]] % 12;
    const gi010 = this.perm[X+this.perm[Y+1+this.perm[Z]]] % 12;
    const gi011 = this.perm[X+this.perm[Y+1+this.perm[Z+1]]] % 12;
    const gi100 = this.perm[X+1+this.perm[Y+this.perm[Z]]] % 12;
    const gi101 = this.perm[X+1+this.perm[Y+this.perm[Z+1]]] % 12;
    const gi110 = this.perm[X+1+this.perm[Y+1+this.perm[Z]]] % 12;
    const gi111 = this.perm[X+1+this.perm[Y+1+this.perm[Z+1]]] % 12;

    const n000 = this.dot(this.grad3[gi000], x, y, z);
    const n100 = this.dot(this.grad3[gi100], x-1, y, z);
    const n010 = this.dot(this.grad3[gi010], x, y-1, z);
    const n110 = this.dot(this.grad3[gi110], x-1, y-1, z);
    const n001 = this.dot(this.grad3[gi001], x, y, z-1);
    const n101 = this.dot(this.grad3[gi101], x-1, y, z-1);
    const n011 = this.dot(this.grad3[gi011], x, y-1, z-1);
    const n111 = this.dot(this.grad3[gi111], x-1, y-1, z-1);

    const u = this.fade(x);
    const v = this.fade(y);
    const w = this.fade(z);

    const nx00 = this.mix(n000, n100, u);
    const nx01 = this.mix(n001, n101, u);
    const nx10 = this.mix(n010, n110, u);
    const nx11 = this.mix(n011, n111, u);
    const nxy0 = this.mix(nx00, nx10, v);
    const nxy1 = this.mix(nx01, nx11, v);

    return this.mix(nxy0, nxy1, w);
  }
}

export default function WaveCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const perlin = new ClassicalNoise();
    const variation = 0.0025;
    const amp = 300;
    const isFirefox = navigator.userAgent.toLowerCase().includes("firefox");
    const max_lines = isFirefox ? 25 : 40;
    const variators: number[] = [];

    for (let i = 0, u = 0; i < max_lines; i++, u += 0.02) {
      variators[i] = u;
    }

    let canvasWidth = 0;
    let canvasHeight = 0;
    let start_y = 0;

    function resizeCanvas() {
      canvasWidth = container!.offsetWidth;
      canvasHeight = container!.offsetHeight;
      canvas!.setAttribute("width", String(canvasWidth));
      canvas!.setAttribute("height", String(canvasHeight));
      start_y = canvasHeight / 2;
    }

    function lerpColor(t: number) {
      const r1 = 124, g1 = 58,  b1 = 237;
      const r2 = 213, g2 = 247, b2 = 4;
      const blend = t * 0.3;
      const r = Math.round(r1 + (r2 - r1) * blend);
      const g = Math.round(g1 + (g2 - g1) * blend);
      const b = Math.round(b1 + (b2 - b1) * blend);
      return { r, g, b };
    }

    function draw() {
      for (let i = 0; i <= max_lines; i++) {
        const t = i / max_lines;
        const { r, g, b } = lerpColor(t);

        ctx!.beginPath();
        ctx!.moveTo(0, start_y);
        let y = 0;
        for (let x = 0; x <= canvasWidth; x++) {
          y = perlin.noise(x * variation + variators[i], x * variation, 0);
          ctx!.lineTo(x, start_y + amp * y);
        }
        const alpha = Math.min(Math.abs(y) + 0.05, 0.05);
        ctx!.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha * 2})`;
        ctx!.stroke();
        ctx!.closePath();
        variators[i] += 0.005;
      }
    }

    function animate() {
      ctx!.clearRect(0, 0, canvasWidth, canvasHeight);
      draw();
      animFrameRef.current = requestAnimationFrame(animate);
    }

    resizeCanvas();
    animate();

    const observer = new ResizeObserver(resizeCanvas);
    observer.observe(container);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      observer.disconnect();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 1 }}
    >
      <canvas
        ref={canvasRef}
        style={{ display: "block", width: "100%", height: "100%" }}
      />
    </div>
  );
}
