import { useEffect } from "react";

const PARTICLE_COUNT = 8;
const COLORS = ["#95c7ae", "#e59266", "#d4c9b4"] as const;
const ANIMATION_MS = 500;
const FLY_DISTANCE = 26;

/**
 * 监听全局 click 事件，在带 [data-ripple] 的元素上创建粒子飞散效果。
 * 每次点击创建 PARTICLE_COUNT 个 span，绝对定位到点击点，
 * 用 nth-child 给 8 套方向（每 45°）播放扩散 + 淡出 500ms 动画。
 * 颜色从 3 色调色板中随机，DOM 在动画结束后自动移除。
 */
export function useClickParticles(selector = "[data-ripple]") {
  useEffect(() => {
    function handleClick(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const host = target.closest<HTMLElement>(selector);
      if (!host) return;

      // host 需要 position: relative + overflow: visible（CSS 已配）
      const rect = host.getBoundingClientRect();
      const color = COLORS[Math.floor(Math.random() * COLORS.length)];

      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const particle = document.createElement("span");
        particle.className = "click-particle";
        particle.style.setProperty("--particle-color", color);
        particle.style.left = `${event.clientX - rect.left}px`;
        particle.style.top = `${event.clientY - rect.top}px`;
        host.appendChild(particle);
        // 触发 CSS 动画：先 reflow 再加 active class
        particle.offsetHeight;
        particle.classList.add("click-particle--active");
        window.setTimeout(() => particle.remove(), ANIMATION_MS);
      }
    }

    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [selector]);
}
