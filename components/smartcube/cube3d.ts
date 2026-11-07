import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { FACE_COLORS } from "@/lib/scrambleCube";
import {
  SOLVED,
  STICKERS,
  axisQuarterTurns,
  parseMove,
  type FaceLetter,
} from "@/lib/smartcube/facelets";

/**
 * Facelet-driven 3D cube.
 *
 * The view owns no cube logic. It paints a 54-character facelet string, and for each move animates
 * the layer turning and then repaints with the state the app computed. Cubies snap back to their
 * home transforms after every animation, so rounding errors can never accumulate.
 *
 * Deliberately a plain class rather than a React component: moves arrive faster than React should
 * re-render, so `Cube3DView` drives this imperatively.
 */

/** Uses the app's own sticker palette, so the 3D cube matches the 2D scramble preview exactly. */
const STICKER_COLORS: Record<FaceLetter, number> = {
  U: parseInt(FACE_COLORS.U.slice(1), 16),
  R: parseInt(FACE_COLORS.R.slice(1), 16),
  F: parseInt(FACE_COLORS.F.slice(1), 16),
  D: parseInt(FACE_COLORS.D.slice(1), 16),
  L: parseInt(FACE_COLORS.L.slice(1), 16),
  B: parseInt(FACE_COLORS.B.slice(1), 16),
};

const SPACING = 1.02;
/**
 * How quickly the drawn cube catches up with the gyro: the time constant of an exponential approach.
 * Packets arrive every 20–50 ms; following each one exactly looks like jitter, while much over
 * ~80 ms feels as if the cube is dragging behind your hand.
 */
const FOLLOW_MS = 55;
/** Duration of one quarter turn when nothing is queued behind it. */
const BASE_MS = 140;
const MIN_MS = 35;

type Anim = {
  axis: 0 | 1 | 2;
  layer: number;
  angle: number;
  after: string;
  duration: number;
  start?: number;
};

export class Cube3D {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  private controls: OrbitControls;
  private cubeRoot = new THREE.Group();
  private pivot = new THREE.Group();
  /** Cubie meshes keyed by home coordinate "x,y,z". */
  private cubies = new Map<string, THREE.Object3D>();
  private stickerMats: THREE.MeshStandardMaterial[] = [];
  private queue: Anim[] = [];
  private current: Anim | null = null;
  private shown = SOLVED;
  private raf = 0;
  private running = true;
  /** Where the gyro says the cube is; the drawn cube eases towards it every frame. */
  private targetOrientation = new THREE.Quaternion();
  private lastFrame = 0;
  private resizeObserver: ResizeObserver;
  private onVisibility = () => {
    // A hidden tab shouldn't burn battery spinning a render loop.
    this.running = document.visibilityState === "visible";
    if (this.running && !this.raf) this.raf = requestAnimationFrame(this.loop);
  };

  constructor(private container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    // The canvas draws at up to 2× the container's pixels for sharpness (`setSize(..., false)`
    // below sets only its drawing buffer), so its *displayed* size must be pinned to the container
    // here. Without this a phone at 2-3× density showed the canvas at its buffer size — twice the
    // frame, anchored top-left — and the cube spilled off the card. The prototype had this in a
    // stylesheet that didn't survive the port, which is why it lives in the renderer now.
    Object.assign(this.renderer.domElement.style, {
      position: "absolute",
      inset: "0",
      width: "100%",
      height: "100%",
      display: "block",
    });
    container.appendChild(this.renderer.domElement);

    this.scene.add(new THREE.AmbientLight(0xffffff, 1.6));
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(5, 8, 6);
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.6);
    fill.position.set(-6, -3, -4);
    this.scene.add(fill);

    this.scene.add(this.cubeRoot);
    this.cubeRoot.add(this.pivot);
    this.build();

    this.camera.position.set(5.2, 5.6, 8.2);
    this.camera.lookAt(0, 0, 0);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enablePan = false;
    this.controls.enableDamping = true;
    this.controls.minDistance = 7;
    this.controls.maxDistance = 20;

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    this.paint(SOLVED);

    document.addEventListener("visibilitychange", this.onVisibility);
    this.raf = requestAnimationFrame(this.loop);
  }

  private loop = (t: number) => {
    this.raf = 0;
    this.tick(t);
    this.follow(t);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    if (this.running) this.raf = requestAnimationFrame(this.loop);
  };

  private build() {
    const body = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.6 });
    const boxGeo = new RoundedBoxGeometry(0.98, 0.98, 0.98, 3, 0.1);
    const stickerGeo = roundedSquare(0.82, 0.12);

    for (let x = -1; x <= 1; x++) {
      for (let y = -1; y <= 1; y++) {
        for (let z = -1; z <= 1; z++) {
          if (!x && !y && !z) continue;
          const cubie = new THREE.Group();
          cubie.add(new THREE.Mesh(boxGeo, body));
          cubie.position.set(x * SPACING, y * SPACING, z * SPACING);
          cubie.userData.home = cubie.position.clone();
          this.cubies.set(`${x},${y},${z}`, cubie);
          this.cubeRoot.add(cubie);
        }
      }
    }

    for (const sticker of STICKERS) {
      const material = new THREE.MeshStandardMaterial({
        color: STICKER_COLORS[sticker.face],
        roughness: 0.35,
      });
      this.stickerMats[sticker.index] = material;
      const mesh = new THREE.Mesh(stickerGeo, material);
      const normal = new THREE.Vector3(...sticker.normal);
      mesh.position.copy(normal.clone().multiplyScalar(0.495));
      mesh.lookAt(normal.clone().multiplyScalar(2));
      this.cubies.get(sticker.pos.join(","))!.add(mesh);
    }
  }

  private paint(facelets: string) {
    for (let i = 0; i < 54; i++) {
      this.stickerMats[i].color.setHex(STICKER_COLORS[facelets[i] as FaceLetter] ?? 0x555555);
    }
    this.shown = facelets;
  }

  /** Animate `move`, then show `after` — the state the app computed for after that move. */
  queueMove(move: string, after: string): void {
    const parsed = parseMove(move);
    this.queue.push({
      axis: parsed.axis,
      layer: parsed.layer,
      angle: (axisQuarterTurns(parsed) * Math.PI) / 2,
      after,
      duration: BASE_MS,
    });
  }

  /** Show a state at once, dropping anything pending. Used for sync and reset. */
  setFacelets(facelets: string): void {
    this.queue = [];
    if (this.current) this.finish(this.current);
    this.paint(facelets);
  }

  get busy(): boolean {
    return Boolean(this.current) || this.queue.length > 0;
  }

  get displayed(): string {
    return this.shown;
  }

  /**
   * Draw the whole cube at this orientation, from the gyro. [x, y, z, w] in the app's axes.
   *
   * It rotates the cube rather than the camera, so face turns — animated inside the cube — keep
   * turning about the cube's own axes however it is being held.
   */
  setOrientation([x, y, z, w]: readonly [number, number, number, number]): void {
    this.targetOrientation.set(x, y, z, w);
  }

  /**
   * While the gyro is steering, dragging the view would fight it, and a dragged camera would also
   * survive Recalibrate and leave the cube looking wrong. So following the cube switches drag off
   * and puts the camera back where calibration assumes it is.
   */
  setFollowing(following: boolean): void {
    this.controls.enableRotate = !following;
    if (following) this.resetView();
  }

  private follow(now: number) {
    const dt = this.lastFrame ? Math.min(100, now - this.lastFrame) : 16;
    this.lastFrame = now;
    // Frame-rate independent: the same feel at 60 Hz and 120 Hz.
    const alpha = 1 - Math.exp(-dt / FOLLOW_MS);
    this.cubeRoot.quaternion.slerp(this.targetOrientation, alpha);
  }

  resetView(): void {
    this.controls.reset();
    this.camera.position.set(5.2, 5.6, 8.2);
    this.camera.lookAt(0, 0, 0);
  }

  private tick(now: number) {
    if (!this.current) {
      const next = this.queue.shift();
      if (!next) return;
      // Catch up when the cuber turns faster than the animation runs.
      next.duration = Math.max(MIN_MS, BASE_MS / (1 + this.queue.length));
      if (Math.abs(next.angle) > Math.PI / 2 + 0.01) next.duration *= 1.4;
      next.start = now;
      this.current = next;
      for (const [key, cubie] of this.cubies) {
        if (Number(key.split(",")[next.axis]) === next.layer) this.pivot.attach(cubie);
      }
    }
    const anim = this.current;
    const progress = Math.min(1, (now - anim.start!) / anim.duration);
    const eased = 1 - (1 - progress) ** 3;
    this.pivot.rotation.set(0, 0, 0);
    this.pivot.rotation[(["x", "y", "z"] as const)[anim.axis]] = anim.angle * eased;
    if (progress >= 1) this.finish(anim);
  }

  private finish(anim: Anim) {
    for (const cubie of [...this.pivot.children]) {
      this.cubeRoot.attach(cubie);
      cubie.position.copy(cubie.userData.home);
      cubie.rotation.set(0, 0, 0);
    }
    this.pivot.rotation.set(0, 0, 0);
    this.paint(anim.after);
    this.current = null;
  }

  private resize() {
    const { clientWidth: w, clientHeight: h } = this.container;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  dispose(): void {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.resizeObserver.disconnect();
    this.controls.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

function roundedSquare(size: number, r: number): THREE.ShapeGeometry {
  const s = size / 2;
  const shape = new THREE.Shape();
  shape.moveTo(-s + r, -s);
  shape.lineTo(s - r, -s);
  shape.quadraticCurveTo(s, -s, s, -s + r);
  shape.lineTo(s, s - r);
  shape.quadraticCurveTo(s, s, s - r, s);
  shape.lineTo(-s + r, s);
  shape.quadraticCurveTo(-s, s, -s, s - r);
  shape.lineTo(-s, -s + r);
  shape.quadraticCurveTo(-s, -s, -s + r, -s);
  return new THREE.ShapeGeometry(shape, 4);
}
