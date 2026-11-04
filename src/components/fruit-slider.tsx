"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { products, type Product } from "@/data/products";

/* ============================================================
   FruitSlider v6.10 — Nature Stage + 悬停 Discover 标签
   · v6.9 全部保留：分层并行加载 / 渐进入场 / DRACO 预热 / preconnect /
     响应式三果恒定 3 件 / useRouter 跳转 / 植物 cover 映射 / 防闪现
   · 新增：鼠标悬停水果 → 水果外侧浮现「◆ DISCOVER THE PRODUCT」胶囊，
     随水果实时跟随、近右缘自动翻左、触屏不显示（帧循环内直写 inline，
     不经 React state，零重渲染开销）
============================================================ */

const SHOW_PLANT_LAYERS = true;

const PX2W = 1 / 100;
const FOV = 35;
const WHEEL_SPEED = 1.2, DRAG_SPEED = 1.6, FLING_SPEED = 200, FLING_CLAMP = 3.0;
const HOVER_BOOST = 1.025;
const ENTER_DELAY = 150;
const LIFT_PX = 46;
const FIRST_SCREEN_COUNT = 3;

const REV_MS = 4200;
const SPIN_DPS = 360 / (REV_MS / 1000);
const TOUCH_SPIN_DEG = 0.45;
const SPIN_SPRING_STIFF = 60, REST_SNAP_K = 6;

const TRIO_BY_BP = {
  xs: { n: 0.44, left: 0.06, fadeLo: -0.04, fadeHi: 0.0 },
  sm: { n: 0.36, left: 0.14, fadeLo: 0.02, fadeHi: 0.06 },
  md: { n: 0.262, left: 0.26, fadeLo: 0.18, fadeHi: 0.24 },
};
let bp = TRIO_BY_BP.md;

const SIZE_BY_SLUG: Record<string, number> = {
  durian: 1.05, dragonfruit: 0.95, papaya: 1.15, hamimelon: 1.0, potato: 0.85, passionfruit: 0.82,
};
const POSE_BY_SLUG: Record<string, number> = {
  durian: 0.05, dragonfruit: -0.10, papaya: 0.20, hamimelon: 0.06, potato: 0.10, passionfruit: -0.06,
};

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

const STAGE_SPAN_X: [number, number] = [0.18, 0.82];
const STAGE_FY_EDGE = 0.70;
const STAGE_FY_CENTER = 0.74;
const GROUND_SINK = 0.035;
const BG_POS_Y_DESKTOP = 0.62;
const BG_POS_Y_MOBILE = 0.70;
const MOBILE_BP = 768;

const PLANT_LEFT = { fx: -0.020, fy: -0.024, fw: 0.393 };
const PLANT_RIGHT = { fx: 0.760, fy: 0.192, fw: 0.300 };
const PNG_RIGHT_ASPECT = 0.825;
const PNG_RIGHT_PLANTS_FRAC = 0.654;

const SH_SOFT = { dx: 0.10, dy: 0.05, sw: 1.35, sh: 0.42, op: 0.85 };
const SH_CORE = { dx: 0.06, dy: 0.015, sw: 0.66, sh: 0.18, op: 0.95 };

const depthScale = (x: number) => 0.92 + 0.14 * Math.sin(Math.PI * clamp01(x));
const edgeFade = (x: number) =>
  Math.min(
    THREE.MathUtils.smoothstep(x, bp.fadeLo, bp.fadeHi),
    THREE.MathUtils.smoothstep(1 - x, bp.fadeLo, bp.fadeHi),
  );

type Spring = { value: number; velocity: number };
const newSpring = (): Spring => ({ value: 0, velocity: 0 });
const SPRING_DAMP = 9;
const stepSpring = (s: Spring, target: number, stiff: number, dt: number) => {
  s.velocity += ((target - s.value) * stiff - s.velocity * SPRING_DAMP) * dt;
  s.value += s.velocity * dt;
  if (Math.abs(s.velocity) < 0.001 && Math.abs(target - s.value) < 0.001) { s.value = target; s.velocity = 0; }
};
const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

export function FruitSlider() {
  const rootRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const softRefs = useRef<(HTMLDivElement | null)[]>([]);
  const coreRefs = useRef<(HTMLDivElement | null)[]>([]);
  const discoverRef = useRef<HTMLDivElement>(null);   // v6.10：悬停标签
  const [hovered, setHovered] = useState<Product | null>(null);
  const router = useRouter();

  useEffect(() => {
    const root = rootRef.current, canvas = canvasRef.current;
    if (!root || !canvas) return;
    // Keep a narrowed reference for use inside nested closures.
    const rootEl: HTMLElement = root;

    if (typeof document !== "undefined" && !document.querySelector('link[data-preconnect-gstatic]')) {
      const l = document.createElement("link");
      l.rel = "preconnect";
      l.href = "https://www.gstatic.com";
      l.crossOrigin = "";
      l.setAttribute("data-preconnect-gstatic", "1");
      document.head.appendChild(l);
    }

    const wrap = root.querySelector<HTMLElement>("[data-fruit-slider-wrap]");
    if (!wrap) return;
    const plantLEl = root.querySelector<HTMLElement>(".fruit-slider__plant-left");
    const plantREl = root.querySelector<HTMLElement>(".fruit-slider__plant-right");
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
    const D = products.length;
    root.classList.add("is-hydrated", "is-boot");

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "high-performance" });
    } catch {
      root.classList.remove("is-boot", "is-hydrated");
      return;
    }
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 400);
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

    const hemi = new THREE.HemisphereLight(0xfff8ee, 0xcdb99c, 0.6);
    const key = new THREE.DirectionalLight(0xfff1de, 2.2); key.position.set(2.5, 4, 3);
    const fill = new THREE.DirectionalLight(0xffe9d2, 0.55); fill.position.set(-3, 1.5, 2);
    scene.add(hemi, key, fill);

    type Fruit = {
      group: THREE.Group; pivot: THREE.Group;
      appear: Spring; lift: Spring;
      spin: number; speed: Spring;
      dwellStart: number; enterTime: number;
      loaded: boolean; revealAt: number;
      rect: { x: number; y: number; w: number; h: number };
      hovered: boolean;
      hBase: number; pose: number;
    };

    const fruits: Fruit[] = products.map((p) => {
      const group = new THREE.Group();
      const pivot = new THREE.Group();
      group.add(pivot);
      scene.add(group);
      return {
        group, pivot,
        appear: newSpring(), lift: newSpring(),
        spin: 0, speed: newSpring(),
        dwellStart: -1, enterTime: -1,
        loaded: false, revealAt: -1,
        rect: { x: 0, y: 0, w: 0, h: 0 },
        hovered: false,
        hBase: SIZE_BY_SLUG[p.slug] ?? 1,
        pose: POSE_BY_SLUG[p.slug] ?? 0,
      };
    });
    fruits.forEach((f) => { f.lift.value = LIFT_PX; });

    let vw = 0, rootH = 0, N = 0, F = 0, j = 0, u = 0, h0 = 0;
    let imgW = 0, imgH = 0, dispW = 0, dispH = 0, offX = 0, offY = 0;
    let interacted = false;
    let target = 0, H = 0, vel = 0, lastInteract = -1;

    const computeBg = () => {
      if (!imgW || !imgH || !vw || !rootH) return;
      const s = Math.max(vw / imgW, rootH / imgH);
      dispW = imgW * s; dispH = imgH * s;
      offX = (vw - dispW) * 0.5;
      offY = (rootH - dispH) * (vw < MOBILE_BP ? BG_POS_Y_MOBILE : BG_POS_Y_DESKTOP);
      layoutPlants();
    };

    function layoutPlants() {
      if (!dispW || !dispH) return;
      if (plantLEl) {
        plantLEl.style.left = `${(PLANT_LEFT.fx * dispW + offX).toFixed(1)}px`;
        plantLEl.style.top = `${(PLANT_LEFT.fy * dispH + offY).toFixed(1)}px`;
        plantLEl.style.width = `${(PLANT_LEFT.fw * dispW).toFixed(1)}px`;
        plantLEl.style.maxWidth = "none";
      }
      if (plantREl) {
        const fhPlants = PNG_RIGHT_PLANTS_FRAC * PNG_RIGHT_ASPECT * (dispW / dispH) * PLANT_RIGHT.fw;
        plantREl.style.left = `${(PLANT_RIGHT.fx * dispW + offX).toFixed(1)}px`;
        plantREl.style.top = `${(PLANT_RIGHT.fy * dispH + offY).toFixed(1)}px`;
        plantREl.style.width = `${(PLANT_RIGHT.fw * dispW).toFixed(1)}px`;
        plantREl.style.height = `${(fhPlants * dispH).toFixed(1)}px`;
        plantREl.style.maxWidth = "none";
      }
      if (!rootEl.classList.contains("is-plants-ready")) rootEl.classList.add("is-plants-ready");
    }

    const bgImg = new Image();
    bgImg.onload = () => { imgW = bgImg.naturalWidth; imgH = bgImg.naturalHeight; computeBg(); };
    bgImg.onerror = () => { imgW = 1600; imgH = 1000; computeBg(); };
    bgImg.src = "/assets/agrumea/hero-nature-bg.jpg";

    const stageY = (xScreenFrac: number) => {
      if (!dispH) return (0.70 + 0.04 * Math.pow(Math.sin(Math.PI * clamp01(xScreenFrac)), 1.2)) * rootH;
      const fx = (xScreenFrac * vw - offX) / dispW;
      const t = clamp01((fx - STAGE_SPAN_X[0]) / (STAGE_SPAN_X[1] - STAGE_SPAN_X[0]));
      const fy = STAGE_FY_EDGE + (STAGE_FY_CENTER - STAGE_FY_EDGE) * Math.pow(Math.sin(Math.PI * t), 1.2);
      return fy * dispH + offY;
    };

    const measure = () => {
      vw = window.innerWidth; rootH = root.getBoundingClientRect().height;
      const xs = vw <= 480, sm = !xs && vw <= 1024;
      bp = xs ? TRIO_BY_BP.xs : sm ? TRIO_BY_BP.sm : TRIO_BY_BP.md;
      N = vw * bp.n;
      u = N * 0.42;
      F = D * N; j = 2 * N;
      h0 = 2 * N + bp.left * vw - u / 2;
      renderer.setSize(vw, rootH, false);
      camera.aspect = vw / rootH;
      const dist = (vw * PX2W) / (2 * Math.tan((FOV / 2) * (Math.PI / 180)) * camera.aspect);
      camera.position.set(0, 0, dist);
      camera.lookAt(0, 0, 0);
      camera.updateProjectionMatrix();
      computeBg();
      if (!interacted) { target = H = h0; }
    };
    measure();

    const snapToTrio = () => {
      if (dragging) return;
      target = h0 + Math.round((target - h0) / N) * N;
    };

    const worldX = (xpx: number) => (xpx - vw / 2) * PX2W;
    const worldY = (ypx: number) => (rootH / 2 - ypx) * PX2W;
    const posOf = (i: number, r: number) => { let c = (i * N + u / 2 + r) % F; if (c < 0) c += F; return c - j; };

    const draco = new DRACOLoader();
    draco.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.7/");
    draco.preload();
    const loader = new GLTFLoader();
    loader.setDRACOLoader(draco);

    let destroyed = false, loadedCount = 0;

    const loadModel = async (idx: number) => {
      const gltf = await loader.loadAsync(products[idx].model);
      if (destroyed) return;
      const obj = gltf.scene;
      const box = new THREE.Box3().setFromObject(obj);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      obj.position.set(-center.x, -box.min.y, -center.z);
      const norm = new THREE.Group();
      norm.scale.setScalar(1 / Math.max(size.y, 1e-6));
      norm.add(obj);
      fruits[idx].pivot.add(norm);
      obj.traverse((ch) => {
        const m = ch as THREE.Mesh;
        if (m.isMesh) {
          m.castShadow = false;
          const mats = Array.isArray(m.material) ? m.material : [m.material];
          mats.forEach((mm) => { const sm = mm as THREE.MeshStandardMaterial; if (sm.envMapIntensity !== undefined) sm.envMapIntensity = 0.9; });
        }
      });
      fruits[idx].loaded = true;
      fruits[idx].revealAt = performance.now() + ENTER_DELAY;
      if (++loadedCount === D) root.classList.add("is-webgl");
    };

    (async () => {
      const first = Math.min(FIRST_SCREEN_COUNT, D);
      await Promise.allSettled(products.slice(0, first).map((_, i) => loadModel(i)));
      if (destroyed) return;
      Promise.allSettled(products.slice(first).map((_, i) => loadModel(i + first)));
    })();

    let dragging = false, dragId = -1, movedFar = false;
    let dragX = 0, downX = 0, dragVel = 0, dragTime = 0;
    let spinIdx = -1, spinLastX = 0, spinVel = 0;
    let downHitIdx = -1;
    let pointerInside = false, mouseX = 0, mouseY = 0, hoverIdx = -1;
    let lastHoverSlug = "";
    let wheelTimer: ReturnType<typeof setTimeout> | undefined;

    const hitTest = (cx: number, cy: number) => {
      const r = root.getBoundingClientRect();
      const x = cx - r.left, y = cy - r.top;
      for (let i = 0; i < D; i++) {
        if (!fruits[i].loaded) continue;
        const b = fruits[i].rect;
        if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return i;
      }
      return -1;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      interacted = true;
      const d = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      target -= d * WHEEL_SPEED;
      clearTimeout(wheelTimer);
      wheelTimer = setTimeout(snapToTrio, 160);
    };

    const onDown = (e: PointerEvent) => {
      movedFar = false; dragId = e.pointerId;
      downX = e.clientX; dragX = e.clientX; dragVel = 0; spinVel = 0;
      dragTime = e.timeStamp || performance.now();
      downHitIdx = hitTest(e.clientX, e.clientY);
      if (e.pointerType !== "mouse") {
        if (downHitIdx >= 0) { spinIdx = downHitIdx; spinLastX = e.clientX; dragging = false; return; }
      }
      dragging = true;
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerId !== dragId) return;
      const now = e.timeStamp || performance.now();
      if (spinIdx >= 0) {
        const dx = e.clientX - spinLastX; spinLastX = e.clientX;
        if (Math.abs(e.clientX - downX) > 6) movedFar = true;
        const a = fruits[spinIdx];
        a.spin += dx * TOUCH_SPIN_DEG;
        a.speed.value = 0; a.speed.velocity = 0;
        spinVel = spinVel * 0.7 + (dx / Math.max(1, now - dragTime)) * 0.3 * TOUCH_SPIN_DEG * 1000;
        dragTime = now; lastInteract = now;
        return;
      }
      if (!dragging) return;
      if (!movedFar) {
        if (Math.abs(e.clientX - downX) <= 6) return;
        try { wrap.setPointerCapture(e.pointerId); } catch { return; }
        movedFar = true; interacted = true;
        dragX = e.clientX; dragTime = now;
        return;
      }
      const dx = e.clientX - dragX;
      dragVel = dragVel * 0.72 + (dx / Math.max(1, now - dragTime)) * 0.28;
      dragX = e.clientX; dragTime = now;
      target += dx * DRAG_SPEED;
    };

    const onUp = (e: PointerEvent) => {
      if (dragId === -1 || e.pointerId !== dragId) return;
      const clickedIdx = downHitIdx;
      const didMoveFar = movedFar;
      if (spinIdx >= 0) {
        const a = fruits[spinIdx];
        a.speed.value = clamp(spinVel, -240, 240); a.speed.velocity = 0;
        spinIdx = -1; spinVel = 0; dragId = -1; movedFar = false;
        if (!didMoveFar && clickedIdx >= 0) router.push(`/dispensa/${products[clickedIdx].slug}`);
        return;
      }
      if (didMoveFar) {
        try { wrap.releasePointerCapture(e.pointerId); } catch { /* noop */ }
        target += clamp(dragVel, -FLING_CLAMP, FLING_CLAMP) * DRAG_SPEED * FLING_SPEED;
        snapToTrio();
      } else if (clickedIdx >= 0 && fine.matches) {
        router.push(`/dispensa/${products[clickedIdx].slug}`);
      }
      dragVel = 0; dragging = false; dragId = -1; movedFar = false;
    };

    const onClick = (e: MouseEvent) => { e.preventDefault(); e.stopPropagation(); };

    const onRootMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      pointerInside = true;
      const r = root.getBoundingClientRect();
      mouseX = e.clientX - r.left; mouseY = e.clientY - r.top;
    };
    const onRootLeave = () => {
      pointerInside = false; hoverIdx = -1;
      fruits.forEach((f) => (f.hovered = false));
      if (lastHoverSlug !== "") { lastHoverSlug = ""; setHovered(null); }
    };

    wrap.addEventListener("wheel", onWheel, { passive: false });
    wrap.addEventListener("pointerdown", onDown);
    wrap.addEventListener("pointermove", onMove);
    wrap.addEventListener("pointerup", onUp);
    wrap.addEventListener("pointercancel", onUp);
    wrap.addEventListener("click", onClick, true);
    root.addEventListener("pointermove", onRootMove, { passive: true });
    root.addEventListener("pointerleave", onRootLeave);
    window.addEventListener("resize", measure);

    let raf = 0, prev = performance.now();
    const frame = (now: number) => {
      if (destroyed) return;
      const dt = Math.min(1 / 30, Math.max(0, (now - prev) / 1000));
      prev = now;

      const oldH = H;
      H += (target - H) * (1 - Math.exp(-(dragging ? 11 : 2.3) * dt));
      if (Math.abs(target - H) < 0.05) H = target;
      vel = dt > 0 ? (H - oldH) / dt : 0;
      const speedAbs = Math.abs(vel);
      if (dragging || spinIdx >= 0 || speedAbs > 6) lastInteract = now;
      const idleZone = !dragging && spinIdx < 0 && speedAbs <= N * 1.4;

      hoverIdx = -1;
      if (pointerInside && !dragging && fine.matches) {
        for (let i = 0; i < D; i++) {
          if (!fruits[i].loaded) continue;
          const r = fruits[i].rect;
          if (mouseX >= r.x && mouseX <= r.x + r.w && mouseY >= r.y && mouseY <= r.y + r.h) { hoverIdx = i; break; }
        }
      }
      wrap.style.cursor = dragging || spinIdx >= 0 ? "grabbing" : hoverIdx >= 0 ? "pointer" : "grab";

      const slug = hoverIdx >= 0 ? products[hoverIdx].slug : "";
      if (slug !== lastHoverSlug) {
        lastHoverSlug = slug;
        setHovered(hoverIdx >= 0 ? products[hoverIdx] : null);
      }

      const hBase = rootH * (vw <= 480 ? 0.26 : 0.32);
      /* v6.10：收集当前悬停水果的屏幕矩形，用于定位 Discover 标签 */
      let hx = 0, hy = 0, hw = 0, hh = 0, hasHover = false;

      fruits.forEach((a, i) => {
        a.hovered = hoverIdx === i;

        const dwellOk = idleZone && a.hovered;
        if (!dwellOk) a.dwellStart = -1;
        else if (a.dwellStart < 0) a.dwellStart = now;
        const wantSpin = fine.matches && a.loaded && a.hovered && spinIdx < 0 && a.dwellStart >= 0 &&
          (a.enterTime > lastInteract || now - a.dwellStart >= 260);
        if (spinIdx !== i) stepSpring(a.speed, wantSpin ? SPIN_DPS : 0, SPIN_SPRING_STIFF, dt);
        a.spin += a.speed.value * dt;
        if (Math.abs(a.speed.value) < 1.5 && Math.abs(a.speed.velocity) < 2 && spinIdx !== i) {
          const nearest = Math.round(a.spin / 22.5) * 22.5;
          a.spin += (nearest - a.spin) * (1 - Math.exp(-REST_SNAP_K * dt));
        }

        stepSpring(a.appear, a.loaded && now >= a.revealAt ? 1 : 0, 80, dt);

        const q = posOf(i, H) / vw;
        const xFrac = clamp01(q);
        const gx = q * vw;
        const h = hBase * a.hBase * depthScale(xFrac) * (a.hovered ? HOVER_BOOST : 1);
        const gy = stageY(xFrac) + h * GROUND_SINK;
        const w = h * 0.72;

        a.rect = { x: gx - w / 2, y: gy - h, w, h };
        const fade = edgeFade(q < 0 || q > 1 ? -1 : xFrac) * (q >= -0.15 && q <= 1.15 ? 1 : 0);
        const onStage = fade > 0.3 && a.loaded;
        stepSpring(a.lift, onStage ? 0 : LIFT_PX, 100, dt);

        if (i === hoverIdx && onStage) { hx = a.rect.x; hy = a.rect.y; hw = a.rect.w; hh = a.rect.h; hasHover = true; }

        const g = a.group;
        g.visible = fade > 0.01 && a.loaded;

        const ap = clamp(a.appear.value, 0, 1);
        const pop = 0.7 + 0.3 * easeOutCubic(ap);
        const yOff = (a.lift.value + (1 - easeOutCubic(ap)) * LIFT_PX) * PX2W;
        g.position.set(worldX(gx), worldY(gy) + yOff, 0);
        g.scale.set(h * PX2W * pop * fade, h * PX2W * pop * fade, h * PX2W * pop * fade);
        g.rotation.z = a.pose;
        a.pivot.rotation.y = THREE.MathUtils.degToRad(a.spin);
        a.pivot.visible = a.appear.value > 0.02;

        const land = 1 - clamp01((a.lift.value + (1 - ap) * LIFT_PX) / LIFT_PX);
        const shOp = fade * ap * land;
        const softEl = softRefs.current[i];
        const coreEl = coreRefs.current[i];
        if (softEl) {
          softEl.style.opacity = (SH_SOFT.op * shOp).toFixed(3);
          softEl.style.transform =
            `translate3d(${(gx + w * SH_SOFT.dx).toFixed(1)}px, ${(gy + w * SH_SOFT.dy).toFixed(1)}px, 0) ` +
            `scale(${((w * SH_SOFT.sw) / 200 * pop).toFixed(3)}, ${((w * SH_SOFT.sh) / 60 * pop).toFixed(3)})`;
        }
        if (coreEl) {
          coreEl.style.opacity = (SH_CORE.op * shOp).toFixed(3);
          coreEl.style.transform =
            `translate3d(${(gx + w * SH_CORE.dx).toFixed(1)}px, ${(gy + w * SH_CORE.dy).toFixed(1)}px, 0) ` +
            `scale(${((w * SH_CORE.sw) / 120 * pop).toFixed(3)}, ${((w * SH_CORE.sh) / 30 * pop).toFixed(3)})`;
        }
      });

      /* v6.10：把 Discover 标签贴到悬停水果外侧；近右缘翻到左侧；触屏/无悬停隐藏 */
      const dk = discoverRef.current;
      if (dk) {
        if (hasHover && fine.matches) {
          const flip = (hx + hw) > vw * 0.66;
          const ax = flip ? hx - 10 : hx + hw + 10;
          const ay = hy + hh * 0.42;
          dk.style.transform =
            `translate3d(${ax.toFixed(1)}px, ${ay.toFixed(1)}px, 0) translateY(-50%)` +
            (flip ? " translateX(-100%)" : "");
          dk.style.opacity = "1";
        } else {
          dk.style.opacity = "0";
        }
      }

      renderer.render(scene, camera);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    const hitWatch = setInterval(() => {
      fruits.forEach((a) => {
        if (a.hovered && a.enterTime < 0) a.enterTime = performance.now();
        if (!a.hovered) a.enterTime = -1;
      });
    }, 120);

    return () => {
      destroyed = true;
      clearInterval(hitWatch);
      clearTimeout(wheelTimer);
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", measure);
      wrap.removeEventListener("wheel", onWheel);
      wrap.removeEventListener("pointerdown", onDown);
      wrap.removeEventListener("pointermove", onMove);
      wrap.removeEventListener("pointerup", onUp);
      wrap.removeEventListener("pointercancel", onUp);
      wrap.removeEventListener("click", onClick, true);
      root.removeEventListener("pointermove", onRootMove);
      root.removeEventListener("pointerleave", onRootLeave);
      fruits.forEach((f) => {
        f.pivot.traverse((ch) => {
          const m = ch as THREE.Mesh;
          if (m.isMesh) {
            m.geometry?.dispose();
            const mats = Array.isArray(m.material) ? m.material : [m.material];
            mats.forEach((mm) => {
              const sm = mm as THREE.MeshStandardMaterial;
              Object.values(sm).forEach((v) => { if (v && (v as THREE.Texture).isTexture) (v as THREE.Texture).dispose(); });
              sm.dispose();
            });
          }
        });
      });
      draco.dispose(); pmrem.dispose(); renderer.dispose();
    };
  }, [router]);

  const origin = hovered ? (hovered as Product & { origin?: string }).origin : undefined;

  return (
    <section
      className={`fruit-slider fruit-slider--nature${SHOW_PLANT_LAYERS ? "" : " no-plant-layers"}`}
      ref={rootRef}
      data-fruit-slider
      data-anim="hero"
    >
      <div className="fruit-slider__bg" aria-hidden="true" />
      <div className="fruit-slider__palm-shadow" aria-hidden="true" />
      <img className="fruit-slider__plant-left" src="/assets/agrumea/plant-left.png" alt="" aria-hidden="true" />
      <img className="fruit-slider__plant-right" src="/assets/agrumea/plant-right.png" alt="" aria-hidden="true" />
      <img
        className="fruit-slider__brand"
        src="/assets/agrumea/brand-wordmark.svg"
        alt="AGRUMEA Farm — Pure fruits, natural goodness, from our farm"
      />
      <div className="fruit-slider__shadows" aria-hidden="true">
        {products.map((p, i) => (
          <div key={`shadow-soft-${p.slug}`} className="fruit-shadow" ref={(el) => { softRefs.current[i] = el; }} />
        ))}
        {products.map((p, i) => (
          <div key={`shadow-core-${p.slug}`} className="fruit-shadow fruit-shadow--core" ref={(el) => { coreRefs.current[i] = el; }} />
        ))}
      </div>
      <canvas ref={canvasRef} className="fruit-slider__canvas" aria-hidden="true" />
      {/* v6.10：悬停 Discover 标签（位置由帧循环 inline 写入） */}
      <div className="fruit-discover" ref={discoverRef} aria-hidden="true">Discover the product</div>
      <div className={`fruit-info-card${hovered ? " is-visible" : ""}`} aria-live="polite">
        {hovered && (
          <>
            <h2 className="fruit-info-card__name">{hovered.name}</h2>
            {origin ? <p className="fruit-info-card__origin">{origin}</p> : null}
            <p className="fruit-info-card__desc">{hovered.description}</p>
          </>
        )}
      </div>
      <p className="fruit-slider__prompt">Scroll to discover</p>
      <div className="fruit-slider__wrapper" data-fruit-slider-wrap>
        <div className="fruit-slider__marquee">
          <div className="fruit-slider__track" data-fruit-slider-track>
            {products.map((p, i) => (
              <a
                key={p.slug}
                className="fruit-slider__item"
                href={`/dispensa/${p.slug}`}
                aria-label={`${p.fruit} — ${p.name}`}
                data-fruit-slider-item
                data-fruit={p.image}
                tabIndex={-1}
                onClick={(e) => e.preventDefault()}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  className="fruit-slider__base"
                  src={p.turns[0]}
                  alt={p.fruit}
                  width={900}
                  height={1440}
                  loading={i < 3 ? "eager" : "lazy"}
                  decoding="async"
                />
              </a>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}