import { useEffect, useRef } from "react";

export function Atmosphere() {
  const grain = useRef<HTMLElement>(null);
  useEffect(() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 180;
    const ctx = canvas.getContext("2d");
    if (!ctx || !grain.current) return;
    const img = ctx.createImageData(180, 180);
    for (let i = 0; i < img.data.length; i += 4) {
      const color = Math.random() * 255;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = color;
      img.data[i + 3] = Math.random() * 26;
    }
    ctx.putImageData(img, 0, 0);
    grain.current.style.backgroundImage = `url(${canvas.toDataURL("image/png")})`;
  }, []);
  return (
    <div className="backdrop" aria-hidden="true">
      <i className="glow g1" />
      <i className="glow g2" />
      <i className="dots" />
      <i className="grain" ref={grain} />
    </div>
  );
}

export function Embers() {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = canvas.current;
    if (!cv || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    let width = 0,
      height = 0,
      frame = 0,
      visible = true;
    const particles: { x: number; y: number; r: number; vy: number; phase: number; alpha: number }[] = [];
    const size = () => {
      const dpr = Math.min(2, devicePixelRatio || 1);
      const rect = cv.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      cv.width = width * dpr;
      cv.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const spawn = (fresh: boolean) => ({
      x: Math.random() * width,
      y: fresh ? Math.random() * height : height + 10,
      r: 0.5 + Math.random() * 1.5,
      vy: 0.1 + Math.random() * 0.32,
      phase: Math.random() * 6.28,
      alpha: 0.15 + Math.random() * 0.55,
    });
    const draw = (t: number) => {
      ctx.clearRect(0, 0, width, height);
      for (let i = 0; i < particles.length; i++) {
        let p = particles[i];
        p.y -= p.vy;
        p.x += Math.sin(t / 2400 + p.phase) * 0.18;
        if (p.y < -10) particles[i] = p = spawn(false);
        ctx.globalAlpha =
          p.alpha * (0.55 + 0.45 * Math.sin(t / 900 + p.phase)) * Math.min(1, p.y / (height * 0.35));
        ctx.fillStyle = "#ff7a2a";
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, 6.2832);
        ctx.fill();
      }
      frame = visible && !document.hidden ? requestAnimationFrame(draw) : 0;
    };
    size();
    for (let i = 0; i < 46; i++) particles.push(spawn(true));
    window.addEventListener("resize", size);
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible && !frame) frame = requestAnimationFrame(draw);
    });
    observer.observe(cv);
    const resume = () => {
      if (!document.hidden && visible && !frame) frame = requestAnimationFrame(draw);
    };
    document.addEventListener("visibilitychange", resume);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", size);
      document.removeEventListener("visibilitychange", resume);
    };
  }, []);
  return <canvas className="embers" ref={canvas} aria-hidden="true" tabIndex={-1} />;
}
