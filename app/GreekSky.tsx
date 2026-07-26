"use client";

import { useEffect, useRef } from "react";

type Star = {
  x: number;
  y: number;
  size: number;
  phase: number;
  speed: number;
};

function seededValue(index: number, salt: number) {
  const value = Math.sin(index * 9283.17 + salt * 431.41) * 43758.5453;
  return value - Math.floor(value);
}

export function GreekSky() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let width = 0;
    let height = 0;
    let scale = 1;
    let stars: Star[] = [];
    let pointerX = -1000;
    let pointerY = -1000;
    let pointerVisible = false;

    function createStars() {
      const count = width < 760 ? 34 : 72;
      stars = Array.from({ length: count }, (_, index) => ({
        x: seededValue(index, 2) * width,
        y: seededValue(index, 7) * height,
        size: 0.7 + seededValue(index, 11) * 1.4,
        phase: seededValue(index, 17) * Math.PI * 2,
        speed: 0.22 + seededValue(index, 23) * 0.34,
      }));
    }

    function resize() {
      width = window.innerWidth;
      height = window.innerHeight;
      scale = Math.min(window.devicePixelRatio || 1, 1.75);
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(scale, 0, 0, scale, 0, 0);
      createStars();
      draw(performance.now());
    }

    function palette() {
      const dark = document.documentElement.dataset.theme === "dark";
      return dark
        ? {
            star: "rgba(205, 225, 233, 0.58)",
            line: "rgba(111, 152, 173, 0.21)",
            orbit: "rgba(212, 106, 77, 0.29)",
            pointer: "rgba(212, 106, 77, 0.58)",
          }
        : {
            star: "rgba(31, 70, 94, 0.46)",
            line: "rgba(45, 87, 111, 0.17)",
            orbit: "rgba(190, 76, 48, 0.25)",
            pointer: "rgba(190, 76, 48, 0.48)",
          };
    }

    function starPosition(star: Star, time: number) {
      const drift = time * 0.00008 * star.speed;
      let x = star.x + Math.sin(drift * 7 + star.phase) * 13;
      let y = star.y + Math.cos(drift * 5 + star.phase) * 9;

      if (pointerVisible && !reducedMotion.matches) {
        const dx = pointerX - x;
        const dy = pointerY - y;
        const distance = Math.hypot(dx, dy);
        if (distance < 190) {
          const pull = (1 - distance / 190) * 0.11;
          x += dx * pull;
          y += dy * pull;
        }
      }
      return { x, y };
    }

    function drawAstrolabe(time: number, colors: ReturnType<typeof palette>) {
      const centerX = width < 760 ? width * 0.78 : width * 0.76;
      const centerY = height * 0.33;
      const radius = Math.min(width, height) * (width < 760 ? 0.24 : 0.29);
      const rotation = reducedMotion.matches ? 0.24 : time * 0.000025;

      context.save();
      context.translate(centerX, centerY);
      context.rotate(rotation);
      context.strokeStyle = colors.orbit;
      context.lineWidth = 1;

      [1, 0.82, 0.58, 0.34].forEach((ratio) => {
        context.beginPath();
        context.arc(0, 0, radius * ratio, 0, Math.PI * 2);
        context.stroke();
      });

      context.beginPath();
      context.ellipse(0, 0, radius, radius * 0.34, 0, 0, Math.PI * 2);
      context.stroke();
      context.beginPath();
      context.ellipse(0, 0, radius * 0.34, radius, 0, 0, Math.PI * 2);
      context.stroke();

      for (let index = 0; index < 12; index += 1) {
        const angle = (Math.PI * 2 * index) / 12;
        context.beginPath();
        context.moveTo(
          Math.cos(angle) * radius * 0.88,
          Math.sin(angle) * radius * 0.88,
        );
        context.lineTo(
          Math.cos(angle) * radius,
          Math.sin(angle) * radius,
        );
        context.stroke();
      }
      context.restore();
    }

    function draw(time: number) {
      const colors = palette();
      context.clearRect(0, 0, width, height);
      drawAstrolabe(time, colors);

      const positions = stars.map((star) => starPosition(star, time));
      context.lineWidth = 1;
      context.strokeStyle = colors.line;

      for (let index = 0; index < positions.length; index += 1) {
        const origin = positions[index];
        for (let target = index + 1; target < positions.length; target += 1) {
          const next = positions[target];
          const distance = Math.hypot(origin.x - next.x, origin.y - next.y);
          if (distance < 138) {
            context.globalAlpha = 1 - distance / 138;
            context.beginPath();
            context.moveTo(origin.x, origin.y);
            context.lineTo(next.x, next.y);
            context.stroke();
          }
        }
      }

      context.globalAlpha = 1;
      positions.forEach((position, index) => {
        const star = stars[index];
        context.fillStyle = colors.star;
        context.beginPath();
        context.arc(position.x, position.y, star.size, 0, Math.PI * 2);
        context.fill();
      });

      if (pointerVisible && !reducedMotion.matches) {
        context.strokeStyle = colors.pointer;
        positions.forEach((position) => {
          const distance = Math.hypot(pointerX - position.x, pointerY - position.y);
          if (distance < 160) {
            context.globalAlpha = (1 - distance / 160) * 0.72;
            context.beginPath();
            context.moveTo(pointerX, pointerY);
            context.lineTo(position.x, position.y);
            context.stroke();
          }
        });
        context.globalAlpha = 1;
        context.beginPath();
        context.arc(pointerX, pointerY, 42, 0, Math.PI * 2);
        context.stroke();
        context.beginPath();
        context.arc(pointerX, pointerY, 9, 0, Math.PI * 2);
        context.stroke();
        context.beginPath();
        context.moveTo(pointerX - 52, pointerY);
        context.lineTo(pointerX - 34, pointerY);
        context.moveTo(pointerX + 34, pointerY);
        context.lineTo(pointerX + 52, pointerY);
        context.moveTo(pointerX, pointerY - 52);
        context.lineTo(pointerX, pointerY - 34);
        context.moveTo(pointerX, pointerY + 34);
        context.lineTo(pointerX, pointerY + 52);
        context.stroke();
      }
    }

    function animate(time: number) {
      draw(time);
      if (!reducedMotion.matches) {
        frame = window.requestAnimationFrame(animate);
      }
    }

    function onPointerMove(event: PointerEvent) {
      pointerX = event.clientX;
      pointerY = event.clientY;
      pointerVisible = true;
    }

    function onPointerLeave() {
      pointerVisible = false;
    }

    function onMotionChange() {
      window.cancelAnimationFrame(frame);
      if (reducedMotion.matches) {
        draw(performance.now());
      } else {
        frame = window.requestAnimationFrame(animate);
      }
    }

    resize();
    if (!reducedMotion.matches) {
      frame = window.requestAnimationFrame(animate);
    }
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onPointerLeave);
    reducedMotion.addEventListener("change", onMotionChange);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointerMove);
      document.documentElement.removeEventListener("pointerleave", onPointerLeave);
      reducedMotion.removeEventListener("change", onMotionChange);
    };
  }, []);

  return <canvas ref={canvasRef} className="greek-sky" aria-hidden="true" />;
}
