import { useEffect, useRef } from 'react';
import type { SceneAnimationPayload } from '../shared/gameTypes';
import { soundEngine } from '../utils/soundEngine';

interface SceneAnimationOverlayProps {
  scene: SceneAnimationPayload;
  onComplete: () => void;
}

interface BloodDrop {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;
  gravity: number;
}

export function SceneAnimationOverlay({ scene, onComplete }: SceneAnimationOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    const durationMs =
      scene.type === 'KILLED'
        ? 3900
        : scene.type === 'CLUE_DISCOVERED'
          ? 3800
          : scene.type === 'SAVED_BY_LOCKSMITH'
            ? 3600
            : 3500;

    if (scene.type === 'KILLED') {
      soundEngine.playKillSlashSequence();
    } else if (scene.type === 'SAVED_BY_LOCKSMITH') {
      soundEngine.playLocksmithSaveSound();
    } else if (scene.type === 'CLUE_DISCOVERED') {
      soundEngine.playClueHeartbeatSound();
    } else if (scene.type === 'ROOM_LYNCHED') {
      soundEngine.playFloorLockdownSound();
    }

    let rafId = 0;

    // Blood splatter Canvas strictly for KILLED scene
    if (scene.type === 'KILLED' && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = window.innerWidth;
      const height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      if (ctx) ctx.scale(dpr, dpr);

      const drops: BloodDrop[] = [];
      for (let i = 0; i < 95; i++) {
        const t = Math.random();
        const originX = width * (0.12 + t * 0.76);
        const originY = height * (0.82 - t * 0.64);
        const angle = -Math.PI / 4 + (Math.random() - 0.5) * 1.9;
        const speed = 2.5 + Math.random() * 14;
        drops.push({
          x: originX,
          y: originY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 2.2,
          radius: 2 + Math.random() * 10,
          alpha: 0.72 + Math.random() * 0.28,
          gravity: 0.22 + Math.random() * 0.2,
        });
      }

      let lastTime = performance.now();
      const startTime = lastTime;

      const tick = (now: number) => {
        const dt = Math.min((now - lastTime) / 16.67, 2.5);
        lastTime = now;
        const elapsed = now - startTime;

        if (ctx) {
          ctx.clearRect(0, 0, width, height);
          if (elapsed > 140) {
            for (const d of drops) {
              d.x += d.vx * dt;
              d.y += d.vy * dt;
              d.vy += d.gravity * dt;
              d.vx *= 0.96;

              ctx.beginPath();
              ctx.arc(d.x, d.y, d.radius, 0, Math.PI * 2);
              ctx.fillStyle = `rgba(176, 18, 28, ${d.alpha})`;
              ctx.fill();

              if (d.radius > 5) {
                ctx.beginPath();
                ctx.moveTo(d.x, d.y);
                ctx.lineTo(d.x - d.vx * 1.6, d.y - d.vy * 1.6);
                ctx.strokeStyle = `rgba(120, 10, 18, ${d.alpha * 0.7})`;
                ctx.lineWidth = d.radius * 0.55;
                ctx.lineCap = 'round';
                ctx.stroke();
              }
            }
          }
        }

        if (elapsed < durationMs) {
          rafId = requestAnimationFrame(tick);
        }
      };

      rafId = requestAnimationFrame(tick);
    }

    const timer = window.setTimeout(() => {
      onCompleteRef.current();
    }, durationMs);

    return () => {
      window.clearTimeout(timer);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [scene]);

  // 1. KILLED SCENE
  if (scene.type === 'KILLED') {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-[#070507] animate-noir-shake"
        role="alertdialog"
        aria-modal="true"
        aria-label={scene.title}
      >
        <div
          className="pointer-events-none absolute inset-0 animate-crimson-flash"
          style={{
            background:
              'radial-gradient(circle at 50% 50%, rgba(185, 22, 34, 0.55) 0%, rgba(120, 10, 18, 0.85) 58%, rgba(7, 5, 7, 0.98) 100%)',
          }}
        />
        <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />
        <svg
          viewBox="0 0 1200 800"
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-0 h-full w-full"
          aria-hidden="true"
        >
          <defs>
            <filter id="slashGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <path
            d="M 110 720 Q 590 385 1090 78"
            fill="none"
            stroke="#DC2626"
            strokeWidth="16"
            strokeLinecap="round"
            filter="url(#slashGlow)"
            className="animate-slash-draw"
          />
          <path
            d="M 122 712 Q 594 388 1085 84"
            fill="none"
            stroke="#FFF1F2"
            strokeWidth="3.5"
            strokeLinecap="round"
            className="animate-slash-draw"
          />
        </svg>

        <div className="relative z-10 max-w-xl px-6 text-center animate-settle">
          <p className="font-mono-tabular text-xs tracking-[0.35em] text-[#C8A25A] mb-3">
            ROOM {scene.room ?? '?'} · FLOOR {scene.floor ?? '?'} · NIGHT {scene.day}
          </p>
          <h2 className="font-display text-4xl sm:text-6xl font-bold tracking-wider text-[#F8F3EE] drop-shadow-[0_4px_24px_rgba(220,38,38,0.65)]">
            {scene.title}
          </h2>
          <div className="mx-auto my-5 h-[1px] w-40 bg-gradient-to-r from-transparent via-[#DC2626] to-transparent" />
          <p className="text-base sm:text-lg text-[#EAE4DC]/95 leading-relaxed">{scene.subtitle}</p>
          {scene.detail && <p className="mt-4 text-xs text-[#9D948A]">{scene.detail}</p>}
        </div>
      </div>
    );
  }

  // 2. SAVED BY LOCKSMITH SCENE
  if (scene.type === 'SAVED_BY_LOCKSMITH') {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-[#09080B] animate-noir-shake"
        role="alertdialog"
        aria-modal="true"
        aria-label={scene.title}
      >
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at 50% 45%, rgba(200,162,90,0.34) 0%, rgba(28,22,14,0.85) 52%, rgba(8,7,10,0.98) 100%)',
          }}
        />

        {/* Steel Door + Glowing Golden Padlock SVG */}
        <div className="relative z-10 flex max-w-lg flex-col items-center px-6 text-center">
          <div className="relative mb-6 flex h-40 w-40 items-center justify-center">
            <div className="pointer-events-none absolute inset-2 rounded-full border-2 border-[#E8C984]/60 animate-gold-aura" />
            <svg
              viewBox="0 0 160 160"
              className="h-36 w-36 animate-lock-slam drop-shadow-[0_0_28px_rgba(232,201,132,0.55)]"
              aria-hidden="true"
            >
              {/* Steel Shield Door Backing */}
              <rect
                x="18"
                y="14"
                width="124"
                height="132"
                rx="10"
                fill="#1D1916"
                stroke="#C8A25A"
                strokeWidth="3"
              />
              {/* Deadbolt Bars */}
              <line x1="18" y1="54" x2="142" y2="54" stroke="#6E5A35" strokeWidth="4" />
              <line x1="18" y1="108" x2="142" y2="108" stroke="#6E5A35" strokeWidth="4" />
              {/* Golden Padlock */}
              <path
                d="M58 70 V52 C58 38 102 38 102 52 V70"
                fill="none"
                stroke="#F3DC9F"
                strokeWidth="8"
                strokeLinecap="round"
              />
              <rect
                x="46"
                y="68"
                width="68"
                height="54"
                rx="8"
                fill="#C8A25A"
                stroke="#FFF3CE"
                strokeWidth="2.5"
              />
              <circle cx="80" cy="91" r="7" fill="#18120B" />
              <rect x="77" y="95" width="6" height="14" rx="2" fill="#18120B" />
            </svg>
          </div>

          <p className="font-mono-tabular text-xs tracking-[0.3em] text-[#E8C984] mb-2">
            KEYMASTER PROTECTION · ROOM {scene.room ?? '?'}
          </p>
          <h2 className="font-display text-3xl sm:text-5xl font-bold text-[#FAF2E1]">
            {scene.title}
          </h2>
          <p className="mt-4 text-sm sm:text-base text-[#E2D9CC] leading-relaxed">
            {scene.subtitle}
          </p>
        </div>
      </div>
    );
  }

  // 3. WITNESS / CLUE DISCOVERED SCENE
  if (scene.type === 'CLUE_DISCOVERED') {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-[#060609]"
        role="alertdialog"
        aria-modal="true"
        aria-label={scene.title}
      >
        {/* Flashlight Beam Sweeping through Darkness */}
        <div
          className="pointer-events-none absolute -top-20 left-1/2 h-[140vh] w-[520px] -translate-x-1/2 origin-top animate-beam-sweep"
          style={{
            background:
              'linear-gradient(180deg, rgba(243,220,159,0.28) 0%, rgba(200,162,90,0.08) 58%, transparent 100%)',
            clipPath: 'polygon(42% 0%, 58% 0%, 100% 100%, 0% 100%)',
          }}
        />

        <div className="relative z-10 flex max-w-xl flex-col items-center px-6 text-center">
          {/* Wide-Open Eye in the Dark SVG */}
          <svg
            viewBox="0 0 220 110"
            className="mb-6 h-24 w-48 animate-eye-awaken drop-shadow-[0_0_24px_rgba(200,162,90,0.45)]"
            aria-hidden="true"
          >
            <path
              d="M12 55 Q110 -8 208 55 Q110 118 12 55 Z"
              fill="#110E14"
              stroke="#E8C984"
              strokeWidth="3"
            />
            <circle cx="110" cy="55" r="28" fill="#1F1812" stroke="#C8A25A" strokeWidth="2.5" />
            <circle cx="110" cy="55" r="14" fill="#DC2626" />
            <circle cx="110" cy="55" r="6" fill="#090709" />
            <circle cx="117" cy="48" r="4" fill="#FFF8E7" />
          </svg>

          <p className="font-mono-tabular text-xs tracking-[0.32em] text-[#C8A25A] mb-2">
            SECRET CLUE · NIGHT {scene.day}
          </p>
          <h2 className="font-display text-3xl sm:text-5xl font-bold text-[#F8F3EE]">
            {scene.title}
          </h2>
          <p className="mt-2 text-sm text-[#E8C984]">{scene.subtitle}</p>
          {scene.detail && (
            <div className="mt-5 rounded-xl border border-[#4D3D27] bg-[#161218]/90 px-5 py-4 text-sm sm:text-base leading-relaxed text-[#F5EFE6]">
              {scene.detail}
            </div>
          )}
        </div>
      </div>
    );
  }

  // 4. ROOM LYNCHED / BREACH SCENE
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-[#08070A]"
      role="alertdialog"
      aria-modal="true"
      aria-label={scene.title}
    >
      {/* Descending Steel Security Shutter */}
      <div className="pointer-events-none absolute inset-0 animate-shutter-drop">
        <div
          className="h-full w-full opacity-95"
          style={{
            backgroundImage:
              'repeating-linear-gradient(180deg, #17141A 0px, #17141A 34px, #0D0B0F 34px, #0D0B0F 40px, #252028 40px, #252028 42px)',
          }}
        />
        {/* Diagonal Iron Chains SVG */}
        <svg
          viewBox="0 0 1200 800"
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full opacity-55"
          aria-hidden="true"
        >
          <line
            x1="0"
            y1="140"
            x2="1200"
            y2="660"
            stroke="#59505C"
            strokeWidth="16"
            strokeDasharray="24 14"
          />
          <line
            x1="1200"
            y1="140"
            x2="0"
            y2="660"
            stroke="#59505C"
            strokeWidth="16"
            strokeDasharray="24 14"
          />
        </svg>
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/45 to-black/85" />
      </div>

      {/* Stamped Room / Floor / Column Lockdown Warning Plaque */}
      <div className="relative z-10 max-w-xl px-6 text-center">
        <div className="inline-block rounded-xl border-4 border-[#DC2626] bg-[#1A0D10]/95 px-7 py-5 shadow-[0_0_50px_rgba(220,38,38,0.45)] animate-stamp-slam">
          <p className="font-mono-tabular text-xs tracking-[0.3em] text-[#FCA5A5]">
            {scene.lockdownMode === 'FLOOR'
              ? 'HORIZONTAL FLOOR LOCKDOWN · ปิดตายทั้งชั้น'
              : scene.lockdownMode === 'COLUMN'
                ? 'VERTICAL COLUMN LOCKDOWN · ปิดตายทั้งแถวแนวตั้ง'
                : 'ROOM BREACH · รุมประชาทัณฑ์ห้องพัก'}
          </p>
          <h2 className="mt-1 font-display text-4xl sm:text-6xl font-bold tracking-widest text-[#F8F3EE]">
            {scene.title}
          </h2>
          <p className="mt-2 text-base sm:text-lg font-bold text-[#F3DC9F]">{scene.subtitle}</p>
        </div>
        {scene.detail && (
          <p className="mt-6 text-sm sm:text-base text-[#E2D9CC] leading-relaxed animate-settle">
            {scene.detail}
          </p>
        )}
      </div>
    </div>
  );
}
