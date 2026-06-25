import { useEffect } from "react";

const COLORS = ["#95c7ae", "#e59266", "#d4c9b4"] as const;
const LAYER_ID = "click-particles-layer";

/**
 * 全局监听 click 事件，在点击位置创建粒子飞散效果。
 * 粒子挂在 document.body 的专用层（position: fixed），不依赖任何祖先元素。
 * 任何 DOM 元素的点击都会触发，无需 [data-ripple] 标记。
 *
 * 每粒独立随机：方向 0-360° / 距离 18-34px / 大小 4-7px / 时长 400-650ms /
 * 起点偏移 1-3px（避免从同一点冒）；一次 click 共享同一颜色（保持整体感）。
 * 数量 6-10 粒随机，动画 cubic-bezier 二次贝塞尔先冲后停。
 */
export function useClickParticles() {
  useEffect(() => {
    let layer = document.getElementById(LAYER_ID);
    if (!layer) {
      layer = document.createElement("div");
      layer.id = LAYER_ID;
      layer.className = "click-particles-layer";
      document.body.appendChild(layer);
    }

    function rand(min: number, max: number) {
      return min + Math.random() * (max - min);
    }

    function handleClick(event: MouseEvent) {
      if (event.button !== 0 || event.metaKey || event.ctrlKey) return;
      if (!layer) return;

      const color = COLORS[Math.floor(Math.random() * COLORS.length)];
      const count = Math.floor(rand(6, 11));
      const duration = Math.floor(rand(400, 651));

      for (let i = 0; i < count; i++) {
        const angleDeg = Math.random() * 360;
        const distance = rand(18, 34);
        const size = rand(4, 7);
        const startOffsetX = rand(-3, 3);
        const startOffsetY = rand(-3, 3);
        const rad = (angleDeg * Math.PI) / 180;
        const dx = Math.cos(rad) * distance;
        const dy = Math.sin(rad) * distance;

        const particle = document.createElement("span");
        particle.className = "click-particle click-particle--active";
        particle.style.setProperty("--particle-color", color);
        particle.style.setProperty("--particle-dx", `${dx}px`);
        particle.style.setProperty("--particle-dy", `${dy}px`);
        particle.style.setProperty("--particle-size", `${size}px`);
        particle.style.setProperty("--particle-dur", `${duration}ms`);
        particle.style.setProperty("--particle-ox", `${startOffsetX}px`);
        particle.style.setProperty("--particle-oy", `${startOffsetY}px`);
        particle.style.left = `${event.clientX}px`;
        particle.style.top = `${event.clientY}px`;
        particle.style.width = `${size}px`;
        particle.style.height = `${size}px`;
        layer.appendChild(particle);
        window.setTimeout(() => particle.remove(), duration);
      }
    }

    document.addEventListener("click", handleClick);
    return () => {
      document.removeEventListener("click", handleClick);
    };
  }, []);
}
