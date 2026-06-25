import { useEffect } from "react";

const PARTICLE_COUNT = 8;
const COLORS = ["#95c7ae", "#e59266", "#d4c9b4"] as const;
const ANIMATION_MS = 500;
const LAYER_ID = "click-particles-layer";

/**
 * 全局监听 click 事件，在点击位置创建粒子飞散效果。
 * 粒子挂在 document.body 的专用层（position: fixed），不依赖任何祖先元素。
 * 任何 DOM 元素的点击都会触发，无需 [data-ripple] 标记。
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

    function handleClick(event: MouseEvent) {
      // 忽略右键、修饰键、文本选择拖动
      if (event.button !== 0 || event.metaKey || event.ctrlKey) return;
      if (!layer) return;

      const color = COLORS[Math.floor(Math.random() * COLORS.length)];

      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const particle = document.createElement("span");
        particle.className = "click-particle click-particle--active";
        particle.style.setProperty("--particle-color", color);
        // 用 clientX/Y 直接定位（layer 是 position: fixed，相对视口）
        particle.style.left = `${event.clientX}px`;
        particle.style.top = `${event.clientY}px`;
        layer.appendChild(particle);
        window.setTimeout(() => particle.remove(), ANIMATION_MS);
      }
    }

    document.addEventListener("click", handleClick);
    return () => {
      document.removeEventListener("click", handleClick);
    };
  }, []);
}
