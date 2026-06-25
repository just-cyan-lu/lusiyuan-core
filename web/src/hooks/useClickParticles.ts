import { useEffect } from "react";

/**
 * 5 色调色板（取自项目色板，与 admin 视觉协调）：
 *  - 薄荷绿 / 暖橙 / 鲜黄 / 靛蓝 / 粉
 * 一次 click 共享同一颜色保持整体感。
 */
const COLORS = ["#95c7ae", "#e59266", "#f7cd67", "#889df0", "#f8a6b2"] as const;
const LAYER_ID = "click-particles-layer";

/**
 * 全局监听 click 事件，在点击位置创建粒子飞散效果。
 * 粒子挂在 document.body 的专用层（position: fixed），不依赖任何祖先元素。
 * 任何 DOM 元素的点击都会触发，无需 [data-ripple] 标记。
 *
 * 每粒独立随机：方向 0-360° / 距离 14-48px（远的更远近的更近）/
 * 大小 4-7px / 时长 280-820ms（快的更快慢的更慢）/ 起点偏移 ±3px。
 * 一次 click 共享同一颜色（保持整体感），数量 6-10 粒随机。
 * 动画 ease-out 匀减速到落点。
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
      const duration = Math.floor(rand(280, 821));

      // DocumentFragment 批量挂载：避免每次 appendChild 触发 reflow
      const frag = document.createDocumentFragment();

      for (let i = 0; i < count; i++) {
        const angleDeg = Math.random() * 360;
        const distance = rand(14, 48);
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
        frag.appendChild(particle);
        window.setTimeout(() => particle.remove(), duration);
      }

      // 一次性挂到 layer（一次 reflow）
      layer.appendChild(frag);
    }

    document.addEventListener("click", handleClick);
    return () => {
      document.removeEventListener("click", handleClick);
    };
  }, []);
}
