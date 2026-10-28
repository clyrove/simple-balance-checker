document.addEventListener('DOMContentLoaded', () => {
  'use strict';

  const hasGsap = typeof window.gsap !== 'undefined';
  const CONFIG = window.KIOSK_CONFIG || {};

  const stateContainer = document.getElementById('kiosk-state-container');
  const waitingView = document.getElementById('kiosk-waiting-view');
  const activeView = document.getElementById('kiosk-active-view');
  const rfidSensorArea = document.getElementById('kiosk-rfid-sensor-area');
  const btnDone = document.getElementById('kiosk-btn-done');
  const heroBalancePlate = document.querySelector('.hero-balance-plate');
  const confettiCanvas = document.getElementById('kiosk-confetti-canvas');

  const balanceAmountEl = document.getElementById('kiosk-balance-amount');
  const userNameEl = document.getElementById('kiosk-user-name');

  const clockDateEl = document.getElementById('kiosk-live-date');
  const clockHoursEl = document.getElementById('kiosk-clock-hours');
  const clockMinutesEl = document.getElementById('kiosk-clock-minutes');
  const clockSecondsEl = document.getElementById('kiosk-clock-seconds');

  const timerSecondsEl = document.getElementById('kiosk-timer-seconds');
  const countdownProgressEl = document.getElementById('kiosk-countdown-progress');

  const devModal = document.getElementById('kiosk-dev-modal');
  const devModalClose = document.getElementById('modal-dev-close');
  const simBtnApply = document.getElementById('sim-btn-apply');
  const simBtnReset = document.getElementById('sim-btn-reset');
  const simBtnLookup = document.getElementById('sim-btn-lookup');

  const toastEl = document.getElementById('kiosk-toast');
  const toastTextEl = document.getElementById('kiosk-toast-text');
  const toastIconEl = document.getElementById('kiosk-toast-icon');
  let toastTimer = null;
  let toastHideAnimTimer = null;
  let currentToastMsg = '';
  let currentToastType = '';
  let isToastShowing = false;

  const COUNTDOWN_TOTAL_SECONDS = (CONFIG.timing && CONFIG.timing.autoCloseSeconds) || 5;
  let remainingSeconds = COUNTDOWN_TOTAL_SECONDS;
  let countdownTimer = null;
  let countdownTween = null;
  let isTransitioning = false;
  let stateTransitionTl = null;
  const counterState = { val: 0 };

  let confettiRafId = null;
  let confettiWaveTimer = null;
  let confettiParticles = [];

  function buildTriangularMosaic(svgId, shardClassPrefix, starClass, shardColors, starRadius, starInnerRadius) {
    const svg = document.getElementById(svgId);
    if (!svg) return;
    const ns = 'http://www.w3.org/2000/svg';
    const cols = 8;
    const rows = 6;
    const cellW = 1600 / cols;
    const cellH = 900 / rows;
    const pts = [];

    for (let r = 0; r <= rows; r++) {
      pts[r] = [];
      for (let c = 0; c <= cols; c++) {
        let x = c * cellW;
        let y = r * cellH;
        if (c > 0 && c < cols) {
          x += Math.sin(c * 17.3 + r * 31.7) * 56;
        }
        if (r > 0 && r < rows) {
          y += Math.cos(c * 23.1 + r * 13.9) * 42;
        }
        pts[r][c] = [Math.round(x), Math.round(y)];
      }
    }

    const frag = document.createDocumentFragment();
    let idx = 0;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const p00 = pts[r][c];
        const p10 = pts[r][c + 1];
        const p01 = pts[r + 1][c];
        const p11 = pts[r + 1][c + 1];

        const tris = (c + r) % 2 === 0
          ? [[p00, p10, p11], [p00, p11, p01]]
          : [[p00, p10, p01], [p10, p11, p01]];

        for (let t = 0; t < 2; t++) {
          const poly = document.createElementNS(ns, 'polygon');
          const tr = tris[t];
          poly.setAttribute('points', `${tr[0][0]},${tr[0][1]} ${tr[1][0]},${tr[1][1]} ${tr[2][0]},${tr[2][1]}`);
          const colorIdx = Math.abs(Math.floor(Math.sin(idx * 19.7 + c * 7.1) * shardColors.length)) % shardColors.length;
          poly.setAttribute('fill', shardColors[colorIdx]);
          const shortPrefix = shardClassPrefix === 'diamond-shard' ? 'ds' : (shardClassPrefix === 'glory-shard' ? 'gs' : shardClassPrefix.slice(0, 2));
          poly.setAttribute('class', `${shardClassPrefix} ${shortPrefix}-${(idx % 5) + 1} ${shardClassPrefix.slice(0, 2)}-${(idx % 5) + 1}`);
          poly.style.animationDelay = `${((idx * 0.23) % 2.4).toFixed(2)}s`;
          frag.appendChild(poly);
          idx++;
        }
      }
    }

    for (let r = 1; r < rows; r++) {
      for (let c = 1; c < cols; c++) {
        if ((r + c) % 2 !== 0) continue;
        const [vx, vy] = pts[r][c];
        const star = document.createElementNS(ns, 'polygon');
        const sr = starRadius;
        const ir = starInnerRadius;
        const sp = [
          `${vx},${vy - sr}`, `${vx + ir},${vy - ir}`,
          `${vx + sr},${vy}`, `${vx + ir},${vy + ir}`,
          `${vx},${vy + sr}`, `${vx - ir},${vy + ir}`,
          `${vx - sr},${vy}`, `${vx - ir},${vy - ir}`
        ].join(' ');
        star.setAttribute('points', sp);
        star.setAttribute('class', starClass);
        star.style.animationDelay = `${((r * 0.41 + c * 0.29) % 2.1).toFixed(2)}s`;
        frag.appendChild(star);
      }
    }

    svg.appendChild(frag);
  }

  const diamondShardColors = [
    'rgba(186, 230, 253, 0.035)', 'rgba(56, 189, 248, 0.025)', 'rgba(224, 242, 254, 0.03)',
    'rgba(255, 255, 255, 0.05)', 'rgba(147, 197, 253, 0.02)', 'rgba(199, 210, 254, 0.025)',
    'rgba(125, 211, 252, 0.03)', 'rgba(255, 255, 255, 0.04)'
  ];
  buildTriangularMosaic('kiosk-diamond-mosaic', 'diamond-shard', 'diamond-vertex-star', diamondShardColors, 5, 1.2);

  const gloryShardColors = [
    'rgba(250, 204, 21, 0.045)', 'rgba(234, 179, 8, 0.035)', 'rgba(254, 240, 138, 0.06)',
    'rgba(255, 255, 255, 0.07)', 'rgba(245, 158, 11, 0.035)', 'rgba(253, 224, 71, 0.045)',
    'rgba(217, 119, 6, 0.025)', 'rgba(254, 249, 195, 0.055)'
  ];
  buildTriangularMosaic('kiosk-glory-mosaic', 'glory-shard', 'glory-vertex-star', gloryShardColors, 5, 1.2);
  buildTriangularMosaic('kiosk-prismatic-mosaic', 'glory-shard', 'glory-vertex-star', gloryShardColors, 5, 1.2);

  function clearConfetti() {
    if (confettiWaveTimer) {
      clearTimeout(confettiWaveTimer);
      confettiWaveTimer = null;
    }
    if (confettiRafId) {
      cancelAnimationFrame(confettiRafId);
      confettiRafId = null;
    }
    confettiParticles = [];
    if (confettiCanvas) {
      const ctx = confettiCanvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    }
  }

  function spawnThreeCannonBurst(width, height, palette, tier, countPerCannon) {
    const isGoldTier = (tier === 'glory' || tier === 'prismatic' || tier === 'gold');
    const shapes = (tier === 'glory' || tier === 'prismatic' || tier === 'diamond')
      ? ['triangle_shard', 'crystal', 'sparkle', 'triangle_shard']
      : ['crystal', 'crystal', 'crystal', 'sparkle'];

    for (let i = 0; i < countPerCannon; i++) {
      confettiParticles.push({
        x: width * 0.06 + Math.random() * (width * 0.12),
        y: height + 10,
        vx: 3.8 + Math.random() * 6.5,
        vy: -(13.5 + Math.random() * 6.8),
        gravity: 0.34,
        drag: 0.986,
        wobble: Math.random() * Math.PI * 2,
        wobbleSpeed: 0.08 + Math.random() * 0.08,
        width: 9 + Math.random() * 7,
        height: 9 + Math.random() * 7,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.16,
        opacity: 1,
        shape: shapes[i % shapes.length],
        color: palette[Math.floor(Math.random() * palette.length)]
      });
    }
    for (let i = 0; i < countPerCannon; i++) {
      confettiParticles.push({
        x: width * 0.44 + Math.random() * (width * 0.12),
        y: height + 10,
        vx: (Math.random() - 0.5) * 6.8,
        vy: -(14.5 + Math.random() * 7.2),
        gravity: 0.34,
        drag: 0.986,
        wobble: Math.random() * Math.PI * 2,
        wobbleSpeed: 0.08 + Math.random() * 0.08,
        width: 9 + Math.random() * 7,
        height: 9 + Math.random() * 7,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.16,
        opacity: 1,
        shape: shapes[i % shapes.length],
        color: palette[Math.floor(Math.random() * palette.length)]
      });
    }
    for (let i = 0; i < countPerCannon; i++) {
      confettiParticles.push({
        x: width * 0.82 + Math.random() * (width * 0.12),
        y: height + 10,
        vx: -(3.8 + Math.random() * 6.5),
        vy: -(13.5 + Math.random() * 6.8),
        gravity: 0.34,
        drag: 0.986,
        wobble: Math.random() * Math.PI * 2,
        wobbleSpeed: 0.08 + Math.random() * 0.08,
        width: 9 + Math.random() * 7,
        height: 9 + Math.random() * 7,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.16,
        opacity: 1,
        shape: shapes[i % shapes.length],
        color: palette[Math.floor(Math.random() * palette.length)]
      });
    }
  }

  function triggerConfetti(tier) {
    if (!confettiCanvas) return;
    clearConfetti();

    const ctx = confettiCanvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = window.innerWidth;
    const height = window.innerHeight;

    confettiCanvas.width = width * dpr;
    confettiCanvas.height = height * dpr;
    confettiCanvas.style.width = width + 'px';
    confettiCanvas.style.height = height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const tierConfig = (CONFIG.tiers && CONFIG.tiers[tier]) || {};
    const palette = tierConfig.confettiColors || [
      '#FDE047', '#FACC15', '#F59E0B', '#D97706', '#FEF08A', '#FFFFFF'
    ];

    confettiParticles = [];

    if (tier === 'glory' || tier === 'prismatic' || tier === 'diamond') {
      spawnThreeCannonBurst(width, height, palette, tier, 26);
      confettiWaveTimer = setTimeout(() => {
        spawnThreeCannonBurst(width, height, palette, tier, 22);
      }, 620);
    } else if (tier === 'platinum') {
      spawnThreeCannonBurst(width, height, palette, 'platinum', 30);
    } else {
      const particleCount = 42;
      for (let i = 0; i < particleCount; i++) {
        confettiParticles.push({
          x: width * 0.15 + Math.random() * (width * 0.7),
          y: height + 10,
          vx: (Math.random() - 0.5) * 6,
          vy: -(9.5 + Math.random() * 7),
          gravity: 0.34,
          drag: 0.985,
          wobble: Math.random() * Math.PI * 2,
          wobbleSpeed: 0.08 + Math.random() * 0.08,
          width: 8 + Math.random() * 6,
          height: 6 + Math.random() * 6,
          rotation: Math.random() * Math.PI * 2,
          rotationSpeed: (Math.random() - 0.5) * 0.15,
          opacity: 1,
          shape: 'ribbon',
          color: palette[Math.floor(Math.random() * palette.length)]
        });
      }
    }

    function renderConfetti() {
      ctx.clearRect(0, 0, width, height);
      let aliveCount = 0;

      for (let i = 0; i < confettiParticles.length; i++) {
        const p = confettiParticles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += p.gravity;
        p.vx *= p.drag;
        p.wobble += p.wobbleSpeed;
        p.rotation += p.rotationSpeed;

        if (p.vy > 0) {
          p.opacity -= 0.016;
        }

        if (p.opacity > 0 && p.y < height + 40) {
          aliveCount++;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation);
          ctx.globalAlpha = Math.max(0, p.opacity);

          if (p.shape === 'triangle_shard') {
            ctx.scale(Math.cos(p.wobble) * 0.85 + 0.15, 1);
            const r = p.width * 1.1;
            ctx.beginPath();
            ctx.moveTo(0, -r);
            ctx.lineTo(r * 0.9, r * 0.75);
            ctx.lineTo(-r * 0.85, r * 0.55);
            ctx.closePath();
            ctx.fillStyle = p.color;
            ctx.fill();

            ctx.beginPath();
            ctx.moveTo(0, -r);
            ctx.lineTo(r * 0.9, r * 0.75);
            ctx.lineTo(0, r * 0.1);
            ctx.closePath();
            ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
            ctx.fill();
          } else if (p.shape === 'crystal') {
            ctx.scale(Math.cos(p.wobble) * 0.85 + 0.15, 1);
            const hw = p.width * 0.75;
            const hh = p.height * 1.15;
            ctx.beginPath();
            ctx.moveTo(0, -hh);
            ctx.lineTo(hw, 0);
            ctx.lineTo(0, hh);
            ctx.lineTo(-hw, 0);
            ctx.closePath();
            ctx.fillStyle = p.color;
            ctx.fill();

            ctx.beginPath();
            ctx.moveTo(0, -hh);
            ctx.lineTo(hw, 0);
            ctx.lineTo(0, hh * 0.15);
            ctx.lineTo(-hw * 0.35, 0);
            ctx.closePath();
            ctx.fillStyle = 'rgba(255, 255, 255, 0.82)';
            ctx.fill();
          } else if (p.shape === 'sparkle') {
            const pulse = 0.75 + Math.abs(Math.cos(p.wobble)) * 0.5;
            ctx.scale(pulse, pulse);
            const r = p.width * 0.98;
            const ir = r * 0.22;
            ctx.beginPath();
            for (let s = 0; s < 4; s++) {
              const ang = (s * Math.PI) / 2;
              const nextAng = ang + Math.PI / 4;
              ctx.lineTo(Math.cos(ang) * r, Math.sin(ang) * r);
              ctx.lineTo(Math.cos(nextAng) * ir, Math.sin(nextAng) * ir);
            }
            ctx.closePath();
            ctx.fillStyle = '#FFFFFF';
            ctx.fill();
          } else {
            ctx.scale(Math.cos(p.wobble), 1);
            ctx.fillStyle = p.color;
            ctx.fillRect(-p.width / 2, -p.height / 2, p.width, p.height);
          }

          ctx.restore();
        }
      }

      if (aliveCount > 0 || confettiWaveTimer) {
        confettiRafId = requestAnimationFrame(renderConfetti);
      } else {
        clearConfetti();
      }
    }

    confettiRafId = requestAnimationFrame(renderConfetti);
  }

  let gloryFogCanvas = null;
  let gloryFogCtx = null;
  let gloryFogRafId = null;
  let gloryFogParticles = [];
  let isGloryFogActive = false;

  function initGloryFog() {
    gloryFogCanvas = document.getElementById('kiosk-glory-fog-canvas');
    if (!gloryFogCanvas) return;
    gloryFogCtx = gloryFogCanvas.getContext('2d');
    resizeGloryFog();
  }

  function resizeGloryFog() {
    if (!gloryFogCanvas) return;
    const rect = gloryFogCanvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const w = Math.round((rect.width || 1200) * dpr);
    const h = Math.round((rect.height || 800) * dpr);
    if (gloryFogCanvas.width !== w || gloryFogCanvas.height !== h) {
      gloryFogCanvas.width = w;
      gloryFogCanvas.height = h;
    }
  }

  function createFogParticle(w, h, cx0, cy0, cx1, cy1, isInitial) {
    const edge = Math.floor(Math.random() * 4);
    let x = 0, y = 0, vx = 0, vy = 0;
    const offset = (Math.random() - 0.5) * 45;

    if (edge === 0) {
      x = cx0 + Math.random() * (cx1 - cx0);
      y = cy0 + offset;
      vx = (Math.random() - 0.5) * 0.45;
      vy = -(0.3 + Math.random() * 0.65);
    } else if (edge === 1) {
      x = cx1 + offset;
      y = cy0 + Math.random() * (cy1 - cy0);
      vx = (0.3 + Math.random() * 0.65);
      vy = (Math.random() - 0.5) * 0.45;
    } else if (edge === 2) {
      x = cx0 + Math.random() * (cx1 - cx0);
      y = cy1 + offset;
      vx = (Math.random() - 0.5) * 0.45;
      vy = (0.3 + Math.random() * 0.65);
    } else {
      x = cx0 + offset;
      y = cy0 + Math.random() * (cy1 - cy0);
      vx = -(0.3 + Math.random() * 0.65);
      vy = (Math.random() - 0.5) * 0.45;
    }

    const maxAge = 120 + Math.floor(Math.random() * 110);
    return {
      x, y, vx, vy,
      radius: 95 + Math.random() * 95,
      growRate: 0.22 + Math.random() * 0.32,
      baseAlpha: 0.20 + Math.random() * 0.16,
      age: isInitial ? Math.floor(Math.random() * maxAge) : 0,
      maxAge
    };
  }

  function startGloryFog() {
    if (!gloryFogCanvas) initGloryFog();
    if (!gloryFogCanvas || !gloryFogCtx) return;
    resizeGloryFog();
    isGloryFogActive = true;
    if (gloryFogRafId) cancelAnimationFrame(gloryFogRafId);

    const w = gloryFogCanvas.width;
    const h = gloryFogCanvas.height;
    const cw = w * 0.72;
    const ch = h * 0.70;
    const cx0 = (w - cw) / 2;
    const cy0 = (h - ch) / 2;
    const cx1 = cx0 + cw;
    const cy1 = cy0 + ch;

    gloryFogParticles = [];
    const count = 42;
    for (let i = 0; i < count; i++) {
      gloryFogParticles.push(createFogParticle(w, h, cx0, cy0, cx1, cy1, true));
    }

    function renderFog() {
      if (!isGloryFogActive) {
        gloryFogCtx.clearRect(0, 0, w, h);
        return;
      }

      gloryFogCtx.clearRect(0, 0, w, h);
      gloryFogCtx.globalCompositeOperation = 'lighter';

      for (let i = 0; i < gloryFogParticles.length; i++) {
        const p = gloryFogParticles[i];
        p.age++;
        p.x += p.vx;
        p.y += p.vy;
        p.radius += p.growRate;

        const progress = p.age / p.maxAge;
        const alpha = Math.sin(progress * Math.PI) * p.baseAlpha;

        if (alpha > 0.001) {
          const grad = gloryFogCtx.createRadialGradient(p.x, p.y, p.radius * 0.1, p.x, p.y, p.radius);
          grad.addColorStop(0, `rgba(254, 240, 138, ${alpha * 0.5})`);
          grad.addColorStop(0.35, `rgba(245, 158, 11, ${alpha * 0.3})`);
          grad.addColorStop(0.7, `rgba(217, 119, 6, ${alpha * 0.12})`);
          grad.addColorStop(1, 'rgba(180, 83, 9, 0)');

          gloryFogCtx.fillStyle = grad;
          gloryFogCtx.beginPath();
          gloryFogCtx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          gloryFogCtx.fill();
        }

        if (p.age >= p.maxAge) {
          gloryFogParticles[i] = createFogParticle(w, h, cx0, cy0, cx1, cy1, false);
        }
      }

      gloryFogCtx.globalCompositeOperation = 'source-over';
      gloryFogRafId = requestAnimationFrame(renderFog);
    }

    gloryFogRafId = requestAnimationFrame(renderFog);
  }

  function stopGloryFog() {
    isGloryFogActive = false;
    if (gloryFogRafId) {
      cancelAnimationFrame(gloryFogRafId);
      gloryFogRafId = null;
    }
    if (gloryFogCanvas && gloryFogCtx) {
      gloryFogCtx.clearRect(0, 0, gloryFogCanvas.width, gloryFogCanvas.height);
    }
    gloryFogParticles = [];
  }

  let glorySparklesCanvas = null;
  let glorySparklesCtx = null;
  let glorySparklesRafId = null;
  let glorySparkles = [];
  let isGlorySparklesActive = false;

  function initGlorySparkles() {
    glorySparklesCanvas = document.getElementById('kiosk-glory-sparkles-canvas');
    if (!glorySparklesCanvas) return;
    glorySparklesCtx = glorySparklesCanvas.getContext('2d');
    resizeGlorySparkles();
  }

  function resizeGlorySparkles() {
    if (!glorySparklesCanvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssW = window.innerWidth;
    const cssH = window.innerHeight;
    const targetW = Math.round(cssW * dpr);
    const targetH = Math.round(cssH * dpr);
    if (glorySparklesCanvas.width !== targetW || glorySparklesCanvas.height !== targetH) {
      glorySparklesCanvas.width = targetW;
      glorySparklesCanvas.height = targetH;
    }
  }

  function createGlorySparkle(w, h, cardRect, isInitial) {
    let x, y;
    const isNearCard = Math.random() < 0.45 && cardRect;

    if (isNearCard) {
      const paddingX = 160;
      const paddingY = 120;
      const minX = Math.max(15, cardRect.left - paddingX);
      const maxX = Math.min(w - 15, cardRect.right + paddingX);
      const minY = Math.max(15, cardRect.top - paddingY);
      const maxY = Math.min(h - 15, cardRect.bottom + paddingY);
      x = minX + Math.random() * (maxX - minX);
      y = minY + Math.random() * (maxY - minY);
    } else {
      x = Math.random() * w;
      y = isInitial ? Math.random() * h : (h + 10 + Math.random() * 40);
    }

    const vx = (Math.random() - 0.5) * 0.35;
    const vy = -(0.25 + Math.random() * 0.55);

    const sizeRand = Math.random();
    let size, isSuperGlint;
    if (sizeRand < 0.5) {
      size = 2.5 + Math.random() * 3.5;
      isSuperGlint = false;
    } else if (sizeRand < 0.88) {
      size = 6 + Math.random() * 5.5;
      isSuperGlint = Math.random() < 0.35;
    } else {
      size = 12 + Math.random() * 7;
      isSuperGlint = true;
    }

    const maxAge = 140 + Math.floor(Math.random() * 160);
    const phase = Math.random() * Math.PI * 2;
    const twinkleSpeed = 0.04 + Math.random() * 0.06;
    const rotation = Math.random() * Math.PI;
    const rotationSpeed = (Math.random() - 0.5) * 0.02;

    return {
      x, y, vx, vy,
      size,
      isSuperGlint,
      phase,
      twinkleSpeed,
      rotation,
      rotationSpeed,
      baseAlpha: 0.5 + Math.random() * 0.45,
      age: isInitial ? Math.floor(Math.random() * maxAge) : 0,
      maxAge
    };
  }

  function drawGloryStar(ctx, x, y, size, alpha, rotation, isSuperGlint) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);

    const auraRadius = size * (isSuperGlint ? 2.6 : 1.8);
    const auraGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, auraRadius);
    auraGrad.addColorStop(0, `rgba(255, 255, 255, ${alpha * 0.9})`);
    auraGrad.addColorStop(0.25, `rgba(254, 240, 138, ${alpha * 0.7})`);
    auraGrad.addColorStop(0.6, `rgba(245, 158, 11, ${alpha * 0.3})`);
    auraGrad.addColorStop(1, 'rgba(180, 83, 9, 0)');
    ctx.fillStyle = auraGrad;
    ctx.beginPath();
    ctx.arc(0, 0, auraRadius, 0, Math.PI * 2);
    ctx.fill();

    const rayLen = size * (isSuperGlint ? 2.2 : 1.6);
    const rayWidth = Math.max(0.8, size * 0.18);

    ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(1, alpha * 1.25)})`;

    ctx.beginPath();
    ctx.moveTo(0, -rayLen);
    ctx.quadraticCurveTo(rayWidth * 0.25, 0, rayWidth, 0);
    ctx.quadraticCurveTo(rayWidth * 0.25, 0, 0, rayLen);
    ctx.quadraticCurveTo(-rayWidth * 0.25, 0, -rayWidth, 0);
    ctx.quadraticCurveTo(-rayWidth * 0.25, 0, 0, -rayLen);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(-rayLen, 0);
    ctx.quadraticCurveTo(0, rayWidth * 0.25, 0, rayWidth);
    ctx.quadraticCurveTo(0, rayWidth * 0.25, rayLen, 0);
    ctx.quadraticCurveTo(0, -rayWidth * 0.25, 0, -rayWidth);
    ctx.quadraticCurveTo(0, -rayWidth * 0.25, -rayLen, 0);
    ctx.fill();

    if (isSuperGlint) {
      const diagLen = rayLen * 0.55;
      const diagWidth = rayWidth * 0.65;
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = `rgba(254, 240, 138, ${alpha * 0.85})`;

      ctx.beginPath();
      ctx.moveTo(-diagLen, 0);
      ctx.lineTo(0, diagWidth);
      ctx.lineTo(diagLen, 0);
      ctx.lineTo(0, -diagWidth);
      ctx.closePath();
      ctx.fill();
    }

    ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(1, alpha * 1.4)})`;
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(1.0, size * 0.22), 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function startGlorySparkles() {
    if (!glorySparklesCanvas) initGlorySparkles();
    if (!glorySparklesCanvas || !glorySparklesCtx) return;
    resizeGlorySparkles();
    isGlorySparklesActive = true;
    if (glorySparklesRafId) cancelAnimationFrame(glorySparklesRafId);

    const cssW = window.innerWidth;
    const cssH = window.innerHeight;
    const cardRect = stateContainer ? stateContainer.getBoundingClientRect() : null;

    glorySparkles = [];
    const count = 62;
    for (let i = 0; i < count; i++) {
      glorySparkles.push(createGlorySparkle(cssW, cssH, cardRect, true));
    }

    function renderSparkles() {
      if (!isGlorySparklesActive) {
        if (glorySparklesCtx && glorySparklesCanvas) {
          glorySparklesCtx.setTransform(1, 0, 0, 1, 0, 0);
          glorySparklesCtx.clearRect(0, 0, glorySparklesCanvas.width, glorySparklesCanvas.height);
        }
        return;
      }

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const curW = window.innerWidth;
      const curH = window.innerHeight;
      const curCardRect = stateContainer ? stateContainer.getBoundingClientRect() : null;

      glorySparklesCtx.setTransform(1, 0, 0, 1, 0, 0);
      glorySparklesCtx.clearRect(0, 0, glorySparklesCanvas.width, glorySparklesCanvas.height);
      glorySparklesCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      glorySparklesCtx.globalCompositeOperation = 'lighter';

      for (let i = 0; i < glorySparkles.length; i++) {
        const s = glorySparkles[i];
        s.age++;
        s.x += s.vx;
        s.y += s.vy;
        s.phase += s.twinkleSpeed;
        s.rotation += s.rotationSpeed;

        const lifeProgress = s.age / s.maxAge;
        const lifeFade = Math.sin(lifeProgress * Math.PI);
        const twinkleFactor = 0.25 + 0.75 * Math.pow(Math.sin(s.phase), 2);
        const alpha = Math.max(0, lifeFade * twinkleFactor * s.baseAlpha);

        if (alpha > 0.008) {
          drawGloryStar(glorySparklesCtx, s.x, s.y, s.size, alpha, s.rotation, s.isSuperGlint);
        }

        if (s.age >= s.maxAge || s.y < -40 || s.x < -40 || s.x > curW + 40) {
          glorySparkles[i] = createGlorySparkle(curW, curH, curCardRect, false);
        }
      }

      glorySparklesCtx.globalCompositeOperation = 'source-over';
      glorySparklesRafId = requestAnimationFrame(renderSparkles);
    }

    glorySparklesRafId = requestAnimationFrame(renderSparkles);
  }

  function stopGlorySparkles() {
    isGlorySparklesActive = false;
    if (glorySparklesRafId) {
      cancelAnimationFrame(glorySparklesRafId);
      glorySparklesRafId = null;
    }
    if (glorySparklesCanvas && glorySparklesCtx) {
      glorySparklesCtx.setTransform(1, 0, 0, 1, 0, 0);
      glorySparklesCtx.clearRect(0, 0, glorySparklesCanvas.width, glorySparklesCanvas.height);
    }
    glorySparkles = [];
  }

  function triggerShiningSweep() {
    if (!balanceAmountEl) return;
    balanceAmountEl.classList.remove('has-shining');
    void balanceAmountEl.offsetWidth;
    balanceAmountEl.classList.add('has-shining');
  }

  function applyBalanceTier(amount) {
    const tier = (CONFIG.tiers && typeof CONFIG.tiers.getTierKey === 'function')
      ? CONFIG.tiers.getTierKey(amount)
      : 'standard';

    if (heroBalancePlate) {
      heroBalancePlate.classList.remove('tier-glory', 'tier-prismatic', 'tier-diamond', 'tier-platinum', 'tier-gold', 'tier-silver', 'tier-standard');
      heroBalancePlate.classList.add(`tier-${tier}`);
      if (tier === 'glory') {
        heroBalancePlate.classList.add('tier-prismatic');
      }
    }

    document.body.classList.toggle('tier-silver', tier === 'silver');
    document.body.classList.toggle('tier-gold', tier === 'gold');
    document.body.classList.toggle('tier-platinum', tier === 'platinum');
    document.body.classList.toggle('tier-diamond', tier === 'diamond');
    document.body.classList.toggle('tier-glory', tier === 'glory' || tier === 'prismatic');
    document.body.classList.toggle('tier-prismatic', tier === 'glory' || tier === 'prismatic');

    triggerShiningSweep();

    if (tier === 'glory' || tier === 'prismatic') {
      startGloryFog();
      startGlorySparkles();
    } else {
      stopGloryFog();
      stopGlorySparkles();
    }

    if (tier !== 'standard') {
      triggerConfetti(tier);
    } else {
      clearConfetti();
    }
  }

  function resetBalanceTier() {
    clearConfetti();
    stopGloryFog();
    stopGlorySparkles();
    document.body.classList.remove('tier-silver', 'tier-gold', 'tier-platinum', 'tier-diamond', 'tier-glory', 'tier-prismatic');
    if (heroBalancePlate) {
      heroBalancePlate.classList.remove('tier-glory', 'tier-prismatic', 'tier-diamond', 'tier-platinum', 'tier-gold', 'tier-silver');
      heroBalancePlate.classList.add('tier-standard');
    }
    if (balanceAmountEl) {
      balanceAmountEl.classList.remove('has-shining');
    }
  }

  function updateKioskClock() {
    const now = new Date();
    const dateOptions = { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' };
    if (clockDateEl) clockDateEl.textContent = now.toLocaleDateString('id-ID', dateOptions);

    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    if (clockHoursEl) clockHoursEl.textContent = hours;
    if (clockMinutesEl) clockMinutesEl.textContent = minutes;
    if (clockSecondsEl) clockSecondsEl.textContent = seconds;
  }

  updateKioskClock();
  setInterval(updateKioskClock, 1000);

  function initDraggableClock() {
    const clockWidget = document.getElementById('kiosk-clock-widget');
    const dragHandle = document.getElementById('kiosk-clock-drag-handle');
    const minBtn = document.getElementById('kiosk-clock-min-btn');
    const minIcon = document.getElementById('kiosk-clock-min-icon');
    if (!clockWidget) return;

    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let initialLeft = 0;
    let initialTop = 0;

    function applyPosition(pos) {
      if (!pos || typeof pos.left !== 'number' || typeof pos.top !== 'number') return;
      const widgetWidth = clockWidget.offsetWidth || 300;
      const widgetHeight = clockWidget.offsetHeight || 60;
      const maxX = Math.max(10, window.innerWidth - widgetWidth - 10);
      const maxY = Math.max(10, window.innerHeight - widgetHeight - 10);
      const clampedX = Math.min(Math.max(10, pos.left), maxX);
      const clampedY = Math.min(Math.max(10, pos.top), maxY);

      clockWidget.style.position = 'fixed';
      clockWidget.style.left = `${clampedX}px`;
      clockWidget.style.top = `${clampedY}px`;
      clockWidget.style.zIndex = '999';
      clockWidget.style.margin = '0';
    }

    function resetPosition() {
      isDragging = false;
      clockWidget.classList.remove('is-dragging');
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);
      document.removeEventListener('pointercancel', onPointerUp);
      clockWidget.style.position = '';
      clockWidget.style.left = '';
      clockWidget.style.top = '';
      clockWidget.style.zIndex = '';
      clockWidget.style.margin = '';
      try {
        localStorage.removeItem('kiosk_clock_position');
      } catch (_) {}
      document.cookie = 'kiosk_clock_pos=; path=/; max-age=0';
    }

    function setMinimized(minimized) {
      clockWidget.classList.toggle('is-minimized', minimized);
      if (minIcon) {
        minIcon.className = minimized ? 'ri-expand-diagonal-line' : 'ri-subtract-line';
      }
      if (minBtn) {
        minBtn.title = minimized ? 'Perbesar jam (tampilkan tanggal & detik)' : 'Minimize jam (tampilkan hanya jam & menit)';
        minBtn.setAttribute('aria-label', minBtn.title);
      }
      try {
        localStorage.setItem('kiosk_clock_minimized', minimized ? '1' : '0');
      } catch (_) {}
      document.cookie = `kiosk_clock_min=${minimized ? '1' : '0'}; path=/; max-age=31536000`;
    }

    try {
      const savedMin = localStorage.getItem('kiosk_clock_minimized') === '1' || /kiosk_clock_min=1/.test(document.cookie);
      if (savedMin) setMinimized(true);

      const savedPosRaw = localStorage.getItem('kiosk_clock_position');
      if (savedPosRaw) {
        const savedPos = JSON.parse(savedPosRaw);
        applyPosition(savedPos);
      } else {
        const match = document.cookie.match(/kiosk_clock_pos=([0-9.]+),([0-9.]+)/);
        if (match) {
          applyPosition({ left: parseFloat(match[1]), top: parseFloat(match[2]) });
        }
      }
    } catch (_) {}

    if (minBtn) {
      minBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const nextMin = !clockWidget.classList.contains('is-minimized');
        setMinimized(nextMin);
        if (clockWidget.style.position === 'fixed') {
          const rect = clockWidget.getBoundingClientRect();
          applyPosition({ left: rect.left, top: rect.top });
        }
      });
    }

    function onPointerDown(e) {
      if (document.body.classList.contains('kiosk-locked') || (window.KioskSecurity && window.KioskSecurity.isLocked())) {
        return;
      }
      if (e.target.closest('#kiosk-clock-min-btn')) return;

      isDragging = true;
      clockWidget.classList.add('is-dragging');

      const rect = clockWidget.getBoundingClientRect();
      startX = e.clientX || 0;
      startY = e.clientY || 0;
      initialLeft = rect.left;
      initialTop = rect.top;

      clockWidget.style.position = 'fixed';
      clockWidget.style.left = `${initialLeft}px`;
      clockWidget.style.top = `${initialTop}px`;
      clockWidget.style.zIndex = '999';
      clockWidget.style.margin = '0';

      document.addEventListener('pointermove', onPointerMove);
      document.addEventListener('pointerup', onPointerUp);
      document.addEventListener('pointercancel', onPointerUp);
    }

    function onPointerMove(e) {
      if (!isDragging) return;
      e.preventDefault();
      const currentX = e.clientX || 0;
      const currentY = e.clientY || 0;
      const deltaX = currentX - startX;
      const deltaY = currentY - startY;

      applyPosition({ left: initialLeft + deltaX, top: initialTop + deltaY });
    }

    function onPointerUp() {
      if (!isDragging) return;
      isDragging = false;
      clockWidget.classList.remove('is-dragging');

      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);
      document.removeEventListener('pointercancel', onPointerUp);

      const rect = clockWidget.getBoundingClientRect();
      const pos = { left: Math.round(rect.left), top: Math.round(rect.top) };
      try {
        localStorage.setItem('kiosk_clock_position', JSON.stringify(pos));
      } catch (_) {}
      document.cookie = `kiosk_clock_pos=${pos.left},${pos.top}; path=/; max-age=31536000`;
    }

    clockWidget.addEventListener('pointerdown', onPointerDown);

    clockWidget.addEventListener('dblclick', (e) => {
      if (e.target.closest('#kiosk-clock-min-btn')) return;
      resetPosition();
    });

    window.addEventListener('resize', () => {
      if (clockWidget.style.position === 'fixed') {
        const rect = clockWidget.getBoundingClientRect();
        applyPosition({ left: rect.left, top: rect.top });
      }
      if (isGloryFogActive) resizeGloryFog();
      if (isGlorySparklesActive) resizeGlorySparkles();
    });
  }

  initDraggableClock();

  function animateBalanceNumber(targetAmount) {
    if (!balanceAmountEl) return;
    const finalFormatted = window.SantriKioskAPI.formatRupiah(targetAmount);

    if (!hasGsap) {
      balanceAmountEl.textContent = finalFormatted;
      triggerShiningSweep();
      return;
    }

    const tier = (CONFIG.tiers && typeof CONFIG.tiers.getTierKey === 'function')
      ? CONFIG.tiers.getTierKey(targetAmount)
      : 'standard';
    const isSpecial = tier === 'diamond' || tier === 'glory' || tier === 'prismatic';
    const counterSpeed = isSpecial ? 0.86 : ((CONFIG.animation && CONFIG.animation.counterSpeed) || 0.4);
    const counterEasing = isSpecial ? 'expo.out' : ((CONFIG.animation && CONFIG.animation.counterEasing) || 'power2.out');
    const bounceSpeed = (CONFIG.animation && CONFIG.animation.splitBounceSpeed) || 0.35;
    const bounceEasing = (CONFIG.animation && CONFIG.animation.splitBounceEasing) || 'back.out(2)';

    gsap.killTweensOf(counterState);
    gsap.killTweensOf(balanceAmountEl);
    counterState.val = 0;

    gsap.fromTo(
      balanceAmountEl,
      { y: isSpecial ? 12 : 8, opacity: 0.85 },
      { y: 0, opacity: 1, duration: counterSpeed, ease: isSpecial ? 'power3.out' : bounceEasing }
    );

    gsap.to(counterState, {
      val: targetAmount,
      duration: counterSpeed,
      ease: counterEasing,
      onUpdate: () => {
        balanceAmountEl.textContent = window.SantriKioskAPI.formatRupiah(counterState.val);
      },
      onComplete: () => {
        balanceAmountEl.textContent = finalFormatted;
        triggerShiningSweep();
      }
    });
  }

  function animateUserName(nameText) {
    if (!userNameEl) return;
    userNameEl.textContent = nameText;
    if (!hasGsap) return;

    gsap.killTweensOf(userNameEl);
    gsap.fromTo(
      userNameEl,
      { y: 8, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: (CONFIG.animation && CONFIG.animation.userNameRevealSpeed) || 0.25,
        ease: (CONFIG.animation && CONFIG.animation.userNameRevealEasing) || 'power2.out',
        delay: 0.04
      }
    );
  }

  function startPrivacyCountdown() {
    stopPrivacyCountdown();
    remainingSeconds = COUNTDOWN_TOTAL_SECONDS;
    if (timerSecondsEl) timerSecondsEl.textContent = remainingSeconds;

    if (countdownProgressEl) {
      if (hasGsap) {
        gsap.set(countdownProgressEl, { scaleX: 1 });
        countdownTween = gsap.to(countdownProgressEl, {
          scaleX: 0,
          duration: COUNTDOWN_TOTAL_SECONDS,
          ease: 'none'
        });
      } else {
        countdownProgressEl.style.transform = 'scaleX(0)';
      }
    }

    countdownTimer = setInterval(() => {
      remainingSeconds -= 1;
      if (timerSecondsEl) timerSecondsEl.textContent = Math.max(0, remainingSeconds);

      if (remainingSeconds <= 0) {
        stopPrivacyCountdown();
        switchToWaitingState();
      }
    }, 1000);
  }

  function stopPrivacyCountdown() {
    if (countdownTimer) {
      clearInterval(countdownTimer);
      countdownTimer = null;
    }
    if (countdownTween) {
      countdownTween.kill();
      countdownTween = null;
    }
  }

  function switchToActiveState(targetBalance, santriData) {
    stopPrivacyCountdown();
    if (stateTransitionTl) {
      stateTransitionTl.kill();
      stateTransitionTl = null;
    }
    isTransitioning = true;
    applyBalanceTier(targetBalance);

    const alreadyActive = stateContainer.classList.contains('state-active') && activeView.classList.contains('active');

    if (!hasGsap || alreadyActive) {
      waitingView.classList.remove('active');
      waitingView.setAttribute('aria-hidden', 'true');
      if (hasGsap) {
        gsap.set(waitingView, { opacity: 0 });
        gsap.set(activeView, { opacity: 1 });
      }
      activeView.classList.add('active');
      activeView.setAttribute('aria-hidden', 'false');
      stateContainer.classList.remove('state-waiting');
      stateContainer.classList.add('state-active');
      isTransitioning = false;
      animateBalanceNumber(targetBalance);
      if (santriData && santriData.name) animateUserName(santriData.name);
      startPrivacyCountdown();
      return;
    }

    activeView.classList.add('active');
    activeView.setAttribute('aria-hidden', 'false');

    const fadeSpeed = (CONFIG.animation && CONFIG.animation.stateCrossFadeSpeed) || 0.18;
    stateTransitionTl = gsap.timeline({
      onComplete: () => {
        waitingView.classList.remove('active');
        waitingView.setAttribute('aria-hidden', 'true');
        stateContainer.classList.remove('state-waiting');
        stateContainer.classList.add('state-active');
        isTransitioning = false;
        stateTransitionTl = null;
        startPrivacyCountdown();
      }
    });

    stateTransitionTl.to(waitingView, { opacity: 0, duration: fadeSpeed, ease: 'power1.in' });
    stateTransitionTl.fromTo(activeView, { opacity: 0 }, { opacity: 1, duration: fadeSpeed * 1.2, ease: 'power2.out' }, '-=0.06');

    animateBalanceNumber(targetBalance);
    if (santriData && santriData.name) animateUserName(santriData.name);
  }

  function switchToWaitingState() {
    stopPrivacyCountdown();
    if (stateTransitionTl) {
      stateTransitionTl.kill();
      stateTransitionTl = null;
    }
    isTransitioning = true;
    document.body.classList.remove('tier-silver', 'tier-gold', 'tier-platinum', 'tier-diamond', 'tier-glory', 'tier-prismatic');

    if (!hasGsap) {
      activeView.classList.remove('active');
      activeView.setAttribute('aria-hidden', 'true');
      waitingView.classList.add('active');
      waitingView.setAttribute('aria-hidden', 'false');
      stateContainer.classList.remove('state-active');
      stateContainer.classList.add('state-waiting');
      resetBalanceTier();
      isTransitioning = false;
      return;
    }

    waitingView.classList.add('active');
    waitingView.setAttribute('aria-hidden', 'false');

    const fadeSpeed = (CONFIG.animation && CONFIG.animation.stateCrossFadeSpeed) || 0.18;
    stateTransitionTl = gsap.timeline({
      onComplete: () => {
        activeView.classList.remove('active');
        activeView.setAttribute('aria-hidden', 'true');
        stateContainer.classList.remove('state-active');
        stateContainer.classList.add('state-waiting');
        resetBalanceTier();
        isTransitioning = false;
        stateTransitionTl = null;
      }
    });

    stateTransitionTl.to(activeView, { opacity: 0, duration: fadeSpeed, ease: 'power1.in' });
    stateTransitionTl.fromTo(waitingView, { opacity: 0 }, { opacity: 1, duration: fadeSpeed * 1.2, ease: 'power2.out' }, '-=0.06');
  }

  if (rfidSensorArea) {
    rfidSensorArea.addEventListener('click', () => {
      if (window.KioskSecurity && window.KioskSecurity.isLocked()) return;
      const promptMsg = (CONFIG.messages && CONFIG.messages.touchPrompt) || 'Tempelkan kartu pada reader RFID.';
      showToast(promptMsg, 'info', 2400);
    });
  }

  if (btnDone) {
    btnDone.addEventListener('click', () => {
      window.SantriKioskAPI.reset();
    });
  }

  function hideToast() {
    if (toastTimer) {
      clearTimeout(toastTimer);
      toastTimer = null;
    }
    if (toastHideAnimTimer) {
      clearTimeout(toastHideAnimTimer);
      toastHideAnimTimer = null;
    }
    if (!toastEl || !isToastShowing) return;

    isToastShowing = false;
    currentToastMsg = '';
    currentToastType = '';
    toastEl.classList.remove('is-visible');

    toastHideAnimTimer = setTimeout(() => {
      if (!isToastShowing && toastEl) toastEl.hidden = true;
    }, 210);
  }

  function showToast(message, type, duration) {
    if (!toastEl) return;
    const cleanMsg = String(message || '').trim();
    const resolvedType = type || 'info';
    if (!cleanMsg) return;

    if (toastTimer) {
      clearTimeout(toastTimer);
      toastTimer = null;
    }
    if (toastHideAnimTimer) {
      clearTimeout(toastHideAnimTimer);
      toastHideAnimTimer = null;
    }

    if (isToastShowing && currentToastMsg === cleanMsg && currentToastType === resolvedType) {
      if (duration && duration > 0) toastTimer = setTimeout(hideToast, duration);
      return;
    }

    currentToastMsg = cleanMsg;
    currentToastType = resolvedType;

    if (toastTextEl) toastTextEl.textContent = cleanMsg;
    toastEl.setAttribute('data-type', resolvedType);

    if (toastIconEl) {
      toastIconEl.className = resolvedType === 'error'
        ? 'ri-error-warning-line'
        : (resolvedType === 'info' ? 'ri-information-line' : 'ri-check-line');
    }

    if (!isToastShowing) {
      toastEl.hidden = false;
      isToastShowing = true;
      requestAnimationFrame(() => {
        if (toastEl && isToastShowing) toastEl.classList.add('is-visible');
      });
    } else {
      toastEl.hidden = false;
      toastEl.classList.add('is-visible');
    }

    if (duration && duration > 0) {
      toastTimer = setTimeout(hideToast, duration);
    }
  }

  window.addEventListener('kiosk:toast', (event) => {
    const detail = event.detail || {};
    showToast(detail.message, detail.type, detail.duration);
  });
  window.addEventListener('kiosk:toast-hide', hideToast);
  window.addEventListener('kiosk:error', (event) => {
    const detail = event.detail || {};
    const errMsg = detail.message || (CONFIG.messages && CONFIG.messages.generalError) || 'Terjadi kesalahan. Silakan hubungi tim IT.';
    showToast(errMsg, 'error', 3500);
  });

  window.addEventListener('keydown', (e) => {
    if (e.altKey && (e.key === 's' || e.key === 'S' || e.code === 'KeyS')) {
      e.preventDefault();
      if (window.KioskSecurity && window.KioskSecurity.isLocked()) return;
      if (e.repeat) return;

      if (devModal) {
        if (devModal.open) {
          devModal.close();
        } else {
          devModal.showModal();
        }
      }
    }
  });

  if (devModalClose && devModal) {
    devModalClose.addEventListener('click', () => {
      devModal.close();
    });
  }

  if (simBtnLookup) {
    simBtnLookup.addEventListener('click', () => {
      const cardUid = document.getElementById('sim-input-card-uid').value;
      if (devModal) devModal.close();
      window.SantriKioskAPI.tapCard(cardUid);
    });
  }

  if (simBtnApply) {
    simBtnApply.addEventListener('click', () => {
      const cardUid = document.getElementById('sim-input-card-uid').value;
      const name = document.getElementById('sim-input-name').value;
      const balance = Number(document.getElementById('sim-input-balance').value) || 0;
      const nis = document.getElementById('sim-input-nis').value;
      const className = document.getElementById('sim-input-class').value;

      const dailyLimitInput = document.getElementById('sim-input-daily-limit');
      const monthlyLimitInput = document.getElementById('sim-input-monthly-limit');

      const dailyLimitVal = dailyLimitInput ? Number(dailyLimitInput.value) || 100000 : 100000;
      const monthlyLimitVal = monthlyLimitInput ? Number(monthlyLimitInput.value) || 500000 : 500000;

      window.SantriKioskAPI.setSantriData({
        cardUid,
        name,
        balance,
        nis,
        className,
        limitHarian: dailyLimitVal,
        limitBulanan: monthlyLimitVal,
        dailyLimit: dailyLimitVal,
        monthlyLimit: monthlyLimitVal,
        status: (CONFIG.messages && CONFIG.messages.cardActive) || 'Kartu Aktif',
        accountType: (CONFIG.messages && CONFIG.messages.walletFallbackType) || 'Saldo Wallet'
      });

      if (devModal) devModal.close();
    });
  }

  if (simBtnReset) {
    simBtnReset.addEventListener('click', () => {
      window.SantriKioskAPI.reset();
      if (devModal) devModal.close();
    });
  }

  document.querySelectorAll('.dev-preset-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const bal = btn.getAttribute('data-balance');
      const balInput = document.getElementById('sim-input-balance');
      if (balInput && bal) {
        balInput.value = bal;
        if (simBtnApply) simBtnApply.click();
      }
    });
  });

  window.addEventListener('kiosk:show-balance', (event) => {
    const { targetBalance, santri } = event.detail;
    switchToActiveState(targetBalance, santri);
  });

  window.addEventListener('kiosk:reset-state', () => {
    switchToWaitingState();
  });

});
