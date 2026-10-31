import * as THREE from "three";

export type GizmoMode = "all" | "translate" | "rotate" | "scale" | "select";

export type GizmoHandle =
  | "translate-x"
  | "translate-y"
  | "translate-z"
  | "translate-xy"
  | "translate-xz"
  | "translate-yz"
  | "rotate-x"
  | "rotate-y"
  | "rotate-z"
  | "scale-x"
  | "scale-y"
  | "scale-z"
  | "scale-xyz";

export interface DragBadgeInfo {
  type: string;
  text: string;
  x: number;
  y: number;
}

export interface UniversalGizmoOptions {
  mode: GizmoMode;
  snapEnabled: boolean;
  gridSnapUnit: number;
  rotationSnapStep: number;
  isShiftHeld: boolean;
  isCtrlHeld: boolean;
  onDragStart?: (handle: GizmoHandle) => void;
  onDragMove?: (badge: DragBadgeInfo) => void;
  onDragEnd?: () => void;
  onObjectChange?: () => void;
}

export class UniversalGizmo {
  public group: THREE.Group;
  private targetObject: THREE.Object3D | null = null;
  private camera: THREE.Camera;
  private domElement: HTMLElement;
  private options: UniversalGizmoOptions;

  // Visual Groups
  private translateGroup: THREE.Group;
  private rotateGroup: THREE.Group;
  private scaleGroup: THREE.Group;
  private planesGroup: THREE.Group;
  private scaleShaftsGroup: THREE.Group;

  // Scale Handle Meshes for Dynamic Repositioning
  private xScaleMesh: THREE.Mesh | null = null;
  private yScaleMesh: THREE.Mesh | null = null;
  private zScaleMesh: THREE.Mesh | null = null;
  private xScaleHitbox: THREE.Mesh | null = null;
  private yScaleHitbox: THREE.Mesh | null = null;
  private zScaleHitbox: THREE.Mesh | null = null;

  // Meshes & Colliders
  private colliders: THREE.Mesh[] = [];
  private visualHandles: Map<GizmoHandle, THREE.Object3D> = new Map();
  private originalMaterials: Map<THREE.Mesh, THREE.Material> = new Map();

  // Active Drag State
  public isDragging: boolean = false;
  private activeHandle: GizmoHandle | null = null;
  private hoveredHandle: GizmoHandle | null = null;
  private dragStartMouse: THREE.Vector2 = new THREE.Vector2();
  private dragPlane: THREE.Plane = new THREE.Plane();
  private dragPlaneIntersect: THREE.Vector3 = new THREE.Vector3();
  private initialObjectPosition: THREE.Vector3 = new THREE.Vector3();
  private initialObjectRotation: THREE.Euler = new THREE.Euler();
  private initialObjectScale: THREE.Vector3 = new THREE.Vector3();
  private dragStartHitPoint: THREE.Vector3 = new THREE.Vector3();
  private dragStartAngle: number = 0;

  // Highlight Material
  private highlightMaterial: THREE.MeshBasicMaterial;

  constructor(camera: THREE.Camera, domElement: HTMLElement, options: UniversalGizmoOptions) {
    this.camera = camera;
    this.domElement = domElement;
    this.options = options;

    this.group = new THREE.Group();
    this.group.name = "UniversalGizmo";
    this.group.visible = false;

    this.translateGroup = new THREE.Group();
    this.rotateGroup = new THREE.Group();
    this.scaleGroup = new THREE.Group();
    this.planesGroup = new THREE.Group();
    this.scaleShaftsGroup = new THREE.Group();

    this.group.add(this.translateGroup);
    this.group.add(this.rotateGroup);
    this.group.add(this.scaleGroup);
    this.group.add(this.planesGroup);
    this.scaleGroup.add(this.scaleShaftsGroup);

    this.highlightMaterial = new THREE.MeshBasicMaterial({
      color: 0xfacc15,
      depthTest: false,
      depthWrite: false,
      transparent: true,
      opacity: 0.95,
      side: THREE.DoubleSide,
    });

    this.buildGeometry();
    this.updateVisibility();
  }

  public setOptions(opts: Partial<UniversalGizmoOptions>) {
    Object.assign(this.options, opts);
    this.updateVisibility();
  }

  public setCamera(cam: THREE.Camera) {
    this.camera = cam;
  }

  public attach(obj: THREE.Object3D | null) {
    this.targetObject = obj;
    if (obj && this.options.mode !== "select") {
      this.group.visible = true;
      this.updatePosition();
    } else {
      this.group.visible = false;
      this.isDragging = false;
      this.activeHandle = null;
    }
  }

  public getTarget(): THREE.Object3D | null {
    return this.targetObject;
  }

  public updateVisibility() {
    if (!this.targetObject || this.options.mode === "select") {
      this.group.visible = false;
      return;
    }
    this.group.visible = true;

    const m = this.options.mode;
    this.translateGroup.visible = m === "all" || m === "translate";
    this.planesGroup.visible = m === "all" || m === "translate";
    this.rotateGroup.visible = m === "all" || m === "rotate";
    this.scaleGroup.visible = m === "all" || m === "scale";

    // Dynamic Positioning for Scale Cubes:
    // In "all" mode, cubes sit cleanly at 0.65 along axes (inside rotation rings at 0.85).
    // In standalone "scale" mode, cubes extend to 1.15 with dedicated full connecting shafts.
    const isAll = m === "all";
    const scalePos = isAll ? 0.65 : 1.15;

    if (this.xScaleMesh) this.xScaleMesh.position.set(scalePos, 0, 0);
    if (this.xScaleHitbox) this.xScaleHitbox.position.set(scalePos, 0, 0);
    if (this.yScaleMesh) this.yScaleMesh.position.set(0, scalePos, 0);
    if (this.yScaleHitbox) this.yScaleHitbox.position.set(0, scalePos, 0);
    if (this.zScaleMesh) this.zScaleMesh.position.set(0, 0, scalePos);
    if (this.zScaleHitbox) this.zScaleHitbox.position.set(0, 0, scalePos);

    this.scaleShaftsGroup.visible = m === "scale";
  }

  // Build the rich all-in-one geometry with thick invisible hitboxes
  private buildGeometry() {
    const colX = 0xef4444; // Red
    const colY = 0x22c55e; // Green
    const colZ = 0x3b82f6; // Blue

    const createMat = (color: number, opacity = 0.9, doubleSide = false) =>
      new THREE.MeshBasicMaterial({
        color,
        depthTest: false,
        depthWrite: false,
        transparent: true,
        opacity,
        side: doubleSide ? THREE.DoubleSide : THREE.FrontSide,
      });

    const createColliderMat = () =>
      new THREE.MeshBasicMaterial({
        visible: false,
        depthTest: false,
        depthWrite: false,
      });

    const addEdges = (mesh: THREE.Mesh, edgeColor: number, opacity = 0.95) => {
      const edges = new THREE.EdgesGeometry(mesh.geometry);
      const line = new THREE.LineSegments(
        edges,
        new THREE.LineBasicMaterial({
          color: edgeColor,
          depthTest: false,
          depthWrite: false,
          transparent: true,
          opacity,
        })
      );
      mesh.add(line);
    };

    // -------------------------------------------------------------
    // 1. Translation Arrows (X, Y, Z)
    // -------------------------------------------------------------
    const arrowShaftGeo = new THREE.CylinderGeometry(0.015, 0.015, 1.0, 12);
    const arrowConeGeo = new THREE.ConeGeometry(0.065, 0.22, 16);
    // Generous hitbox (radius 0.16)
    const shaftHitboxGeo = new THREE.CylinderGeometry(0.16, 0.16, 1.15, 8);

    // X Arrow
    const xArrowGroup = new THREE.Group();
    const xShaft = new THREE.Mesh(arrowShaftGeo, createMat(colX));
    xShaft.position.set(0.5, 0, 0);
    xShaft.rotation.z = -Math.PI / 2;
    const xCone = new THREE.Mesh(arrowConeGeo, createMat(colX));
    xCone.position.set(1.1, 0, 0);
    xCone.rotation.z = -Math.PI / 2;
    addEdges(xCone, 0xffffff, 0.8);
    xArrowGroup.add(xShaft, xCone);
    this.translateGroup.add(xArrowGroup);
    this.visualHandles.set("translate-x", xArrowGroup);
    this.recordMaterials(xArrowGroup);

    const xHitbox = new THREE.Mesh(shaftHitboxGeo, createColliderMat());
    xHitbox.position.set(0.6, 0, 0);
    xHitbox.rotation.z = -Math.PI / 2;
    xHitbox.userData = { handle: "translate-x" };
    this.translateGroup.add(xHitbox);
    this.colliders.push(xHitbox);

    // Y Arrow
    const yArrowGroup = new THREE.Group();
    const yShaft = new THREE.Mesh(arrowShaftGeo, createMat(colY));
    yShaft.position.set(0, 0.5, 0);
    const yCone = new THREE.Mesh(arrowConeGeo, createMat(colY));
    yCone.position.set(0, 1.1, 0);
    addEdges(yCone, 0xffffff, 0.8);
    yArrowGroup.add(yShaft, yCone);
    this.translateGroup.add(yArrowGroup);
    this.visualHandles.set("translate-y", yArrowGroup);
    this.recordMaterials(yArrowGroup);

    const yHitbox = new THREE.Mesh(shaftHitboxGeo, createColliderMat());
    yHitbox.position.set(0, 0.6, 0);
    yHitbox.userData = { handle: "translate-y" };
    this.translateGroup.add(yHitbox);
    this.colliders.push(yHitbox);

    // Z Arrow
    const zArrowGroup = new THREE.Group();
    const zShaft = new THREE.Mesh(arrowShaftGeo, createMat(colZ));
    zShaft.position.set(0, 0, 0.5);
    zShaft.rotation.x = Math.PI / 2;
    const zCone = new THREE.Mesh(arrowConeGeo, createMat(colZ));
    zCone.position.set(0, 0, 1.1);
    zCone.rotation.x = Math.PI / 2;
    addEdges(zCone, 0xffffff, 0.8);
    zArrowGroup.add(zShaft, zCone);
    this.translateGroup.add(zArrowGroup);
    this.visualHandles.set("translate-z", zArrowGroup);
    this.recordMaterials(zArrowGroup);

    const zHitbox = new THREE.Mesh(shaftHitboxGeo, createColliderMat());
    zHitbox.position.set(0, 0, 0.6);
    zHitbox.rotation.x = Math.PI / 2;
    zHitbox.userData = { handle: "translate-z" };
    this.translateGroup.add(zHitbox);
    this.colliders.push(zHitbox);

    // -------------------------------------------------------------
    // 2. Planar Drag Squares (XY, XZ, YZ) - Double-sided with crisp edges
    // -------------------------------------------------------------
    const planeGeo = new THREE.PlaneGeometry(0.22, 0.22);
    const planeHitboxGeo = new THREE.BoxGeometry(0.35, 0.35, 0.12);

    // XY Plane (Amber / Yellow)
    const xyPlane = new THREE.Mesh(planeGeo, createMat(0xf59e0b, 0.5, true));
    xyPlane.position.set(0.26, 0.26, 0);
    addEdges(xyPlane, 0xfbbf24, 0.95);
    this.planesGroup.add(xyPlane);
    this.visualHandles.set("translate-xy", xyPlane);
    this.recordMaterials(xyPlane);

    const xyHitbox = new THREE.Mesh(planeHitboxGeo, createColliderMat());
    xyHitbox.position.set(0.26, 0.26, 0);
    xyHitbox.userData = { handle: "translate-xy" };
    this.planesGroup.add(xyHitbox);
    this.colliders.push(xyHitbox);

    // XZ Plane (Cyan)
    const xzPlane = new THREE.Mesh(planeGeo, createMat(0x06b6d4, 0.5, true));
    xzPlane.position.set(0.26, 0, 0.26);
    xzPlane.rotation.x = -Math.PI / 2;
    addEdges(xzPlane, 0x38bdf8, 0.95);
    this.planesGroup.add(xzPlane);
    this.visualHandles.set("translate-xz", xzPlane);
    this.recordMaterials(xzPlane);

    const xzHitbox = new THREE.Mesh(planeHitboxGeo, createColliderMat());
    xzHitbox.position.set(0.26, 0, 0.26);
    xzHitbox.rotation.x = -Math.PI / 2;
    xzHitbox.userData = { handle: "translate-xz" };
    this.planesGroup.add(xzHitbox);
    this.colliders.push(xzHitbox);

    // YZ Plane (Purple)
    const yzPlane = new THREE.Mesh(planeGeo, createMat(0xa855f7, 0.5, true));
    yzPlane.position.set(0, 0.26, 0.26);
    yzPlane.rotation.y = Math.PI / 2;
    addEdges(yzPlane, 0xc084fc, 0.95);
    this.planesGroup.add(yzPlane);
    this.visualHandles.set("translate-yz", yzPlane);
    this.recordMaterials(yzPlane);

    const yzHitbox = new THREE.Mesh(planeHitboxGeo, createColliderMat());
    yzHitbox.position.set(0, 0.26, 0.26);
    yzHitbox.rotation.y = Math.PI / 2;
    yzHitbox.userData = { handle: "translate-yz" };
    this.planesGroup.add(yzHitbox);
    this.colliders.push(yzHitbox);

    // -------------------------------------------------------------
    // 3. Rotation Arc Rings (X, Y, Z)
    // -------------------------------------------------------------
    const ringGeo = new THREE.TorusGeometry(0.85, 0.016, 16, 64);
    // Generous torus hitbox (tube 0.14)
    const ringHitboxGeo = new THREE.TorusGeometry(0.85, 0.14, 8, 32);

    // X Ring
    const xRing = new THREE.Mesh(ringGeo, createMat(colX, 0.85));
    xRing.rotation.y = Math.PI / 2;
    this.rotateGroup.add(xRing);
    this.visualHandles.set("rotate-x", xRing);
    this.recordMaterials(xRing);

    const xRingHitbox = new THREE.Mesh(ringHitboxGeo, createColliderMat());
    xRingHitbox.rotation.y = Math.PI / 2;
    xRingHitbox.userData = { handle: "rotate-x" };
    this.rotateGroup.add(xRingHitbox);
    this.colliders.push(xRingHitbox);

    // Y Ring
    const yRing = new THREE.Mesh(ringGeo, createMat(colY, 0.85));
    yRing.rotation.x = Math.PI / 2;
    this.rotateGroup.add(yRing);
    this.visualHandles.set("rotate-y", yRing);
    this.recordMaterials(yRing);

    const yRingHitbox = new THREE.Mesh(ringHitboxGeo, createColliderMat());
    yRingHitbox.rotation.x = Math.PI / 2;
    yRingHitbox.userData = { handle: "rotate-y" };
    this.rotateGroup.add(yRingHitbox);
    this.colliders.push(yRingHitbox);

    // Z Ring
    const zRing = new THREE.Mesh(ringGeo, createMat(colZ, 0.85));
    this.rotateGroup.add(zRing);
    this.visualHandles.set("rotate-z", zRing);
    this.recordMaterials(zRing);

    const zRingHitbox = new THREE.Mesh(ringHitboxGeo, createColliderMat());
    zRingHitbox.userData = { handle: "rotate-z" };
    this.rotateGroup.add(zRingHitbox);
    this.colliders.push(zRingHitbox);

    // -------------------------------------------------------------
    // 4. Scale Handles (Scale Shafts, Axis Cubes & Uniform Center)
    // -------------------------------------------------------------
    const scaleShaftGeo = new THREE.CylinderGeometry(0.015, 0.015, 1.05, 8);
    const xShaftScale = new THREE.Mesh(scaleShaftGeo, createMat(colX));
    xShaftScale.position.set(0.525, 0, 0);
    xShaftScale.rotation.z = -Math.PI / 2;
    this.scaleShaftsGroup.add(xShaftScale);

    const yShaftScale = new THREE.Mesh(scaleShaftGeo, createMat(colY));
    yShaftScale.position.set(0, 0.525, 0);
    this.scaleShaftsGroup.add(yShaftScale);

    const zShaftScale = new THREE.Mesh(scaleShaftGeo, createMat(colZ));
    zShaftScale.position.set(0, 0, 0.525);
    zShaftScale.rotation.x = Math.PI / 2;
    this.scaleShaftsGroup.add(zShaftScale);

    const scaleCubeGeo = new THREE.BoxGeometry(0.12, 0.12, 0.12);
    const scaleHitboxGeo = new THREE.BoxGeometry(0.28, 0.28, 0.28);
    const initPos = 0.65;

    // X Scale Cube
    const xScale = new THREE.Mesh(scaleCubeGeo, createMat(colX, 0.95));
    xScale.position.set(initPos, 0, 0);
    addEdges(xScale, 0xffffff, 0.9);
    this.scaleGroup.add(xScale);
    this.visualHandles.set("scale-x", xScale);
    this.recordMaterials(xScale);
    this.xScaleMesh = xScale;

    const xScaleHitbox = new THREE.Mesh(scaleHitboxGeo, createColliderMat());
    xScaleHitbox.position.set(initPos, 0, 0);
    xScaleHitbox.userData = { handle: "scale-x" };
    this.scaleGroup.add(xScaleHitbox);
    this.colliders.push(xScaleHitbox);
    this.xScaleHitbox = xScaleHitbox;

    // Y Scale Cube
    const yScale = new THREE.Mesh(scaleCubeGeo, createMat(colY, 0.95));
    yScale.position.set(0, initPos, 0);
    addEdges(yScale, 0xffffff, 0.9);
    this.scaleGroup.add(yScale);
    this.visualHandles.set("scale-y", yScale);
    this.recordMaterials(yScale);
    this.yScaleMesh = yScale;

    const yScaleHitbox = new THREE.Mesh(scaleHitboxGeo, createColliderMat());
    yScaleHitbox.position.set(0, initPos, 0);
    yScaleHitbox.userData = { handle: "scale-y" };
    this.scaleGroup.add(yScaleHitbox);
    this.colliders.push(yScaleHitbox);
    this.yScaleHitbox = yScaleHitbox;

    // Z Scale Cube
    const zScale = new THREE.Mesh(scaleCubeGeo, createMat(colZ, 0.95));
    zScale.position.set(0, 0, initPos);
    addEdges(zScale, 0xffffff, 0.9);
    this.scaleGroup.add(zScale);
    this.visualHandles.set("scale-z", zScale);
    this.recordMaterials(zScale);
    this.zScaleMesh = zScale;

    const zScaleHitbox = new THREE.Mesh(scaleHitboxGeo, createColliderMat());
    zScaleHitbox.position.set(0, 0, initPos);
    zScaleHitbox.userData = { handle: "scale-z" };
    this.scaleGroup.add(zScaleHitbox);
    this.colliders.push(zScaleHitbox);
    this.zScaleHitbox = zScaleHitbox;

    // Uniform Center Octahedron Handle (Faceted diamond with Kosh orange edges)
    const centerGeo = new THREE.OctahedronGeometry(0.12, 0);
    const centerHitboxGeo = new THREE.BoxGeometry(0.32, 0.32, 0.32);
    const centerCube = new THREE.Mesh(centerGeo, createMat(0xf4f4f5, 0.85, true));
    addEdges(centerCube, 0xea580c, 0.95);
    this.scaleGroup.add(centerCube);
    this.visualHandles.set("scale-xyz", centerCube);
    this.recordMaterials(centerCube);

    const centerHitbox = new THREE.Mesh(centerHitboxGeo, createColliderMat());
    centerHitbox.userData = { handle: "scale-xyz" };
    this.scaleGroup.add(centerHitbox);
    this.colliders.push(centerHitbox);
  }

  private recordMaterials(obj: THREE.Object3D) {
    obj.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.renderOrder = 99999;
        if (child.material) {
          this.originalMaterials.set(child, child.material);
        }
      }
    });
  }

  // -------------------------------------------------------------
  // Frame Update (Screen-Space Auto-Scaling & Camera Dimming)
  // -------------------------------------------------------------
  public update() {
    if (!this.targetObject || !this.group.visible) return;

    this.updatePosition();

    // Constant Visual Size on Screen
    const worldPos = this.group.position;
    const dist = this.camera.position.distanceTo(worldPos);
    const isOrtho = (this.camera as THREE.OrthographicCamera).isOrthographicCamera;
    const factor = isOrtho ? 0.32 : Math.max(0.08, dist * 0.18);
    this.group.scale.set(factor, factor, factor);

    // Auto-dim axes pointing directly toward the camera (prevents misclicks)
    const camDir = this.camera.position.clone().sub(worldPos).normalize();
    const dotX = Math.abs(camDir.x);
    const dotY = Math.abs(camDir.y);
    const dotZ = Math.abs(camDir.z);

    this.setHandleDimmed("translate-x", dotX > 0.92);
    this.setHandleDimmed("scale-x", dotX > 0.92);
    this.setHandleDimmed("translate-y", dotY > 0.92);
    this.setHandleDimmed("scale-y", dotY > 0.92);
    this.setHandleDimmed("translate-z", dotZ > 0.92);
    this.setHandleDimmed("scale-z", dotZ > 0.92);
  }

  private updatePosition() {
    if (!this.targetObject) return;
    const worldPos = new THREE.Vector3();
    this.targetObject.getWorldPosition(worldPos);
    this.group.position.copy(worldPos);
  }

  private setHandleDimmed(handle: GizmoHandle, dimmed: boolean) {
    if (this.hoveredHandle === handle || this.activeHandle === handle) return;
    const obj = this.visualHandles.get(handle);
    if (!obj) return;
    obj.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material) {
        const mat = child.material as THREE.MeshBasicMaterial;
        mat.opacity = dimmed ? 0.2 : 0.85;
      }
    });
  }

  // -------------------------------------------------------------
  // Hover & Raycasting
  // -------------------------------------------------------------
  public onPointerMove(e: PointerEvent, raycaster: THREE.Raycaster): boolean {
    if (this.isDragging) {
      this.handleDrag(e, raycaster);
      return true;
    }

    if (!this.group.visible || this.options.mode === "select") {
      this.clearHover();
      return false;
    }

    // Only test against colliders that are in visible groups
    const activeColliders = this.colliders.filter((c) => c.parent && c.parent.visible);
    const intersects = raycaster.intersectObjects(activeColliders, false);

    if (intersects.length > 0) {
      const hit = intersects[0];
      const handle = hit.object.userData.handle as GizmoHandle;
      if (handle) {
        this.setHover(handle);
        return true;
      }
    }

    this.clearHover();
    return false;
  }

  private setHover(handle: GizmoHandle) {
    if (this.hoveredHandle === handle) return;
    this.clearHover();
    this.hoveredHandle = handle;

    const visual = this.visualHandles.get(handle);
    if (visual) {
      visual.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.material = this.highlightMaterial;
        }
      });
    }
    this.domElement.style.cursor = "pointer";
  }

  public clearHover() {
    if (!this.hoveredHandle) return;
    const visual = this.visualHandles.get(this.hoveredHandle);
    if (visual) {
      visual.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          const orig = this.originalMaterials.get(child);
          if (orig) child.material = orig;
        }
      });
    }
    this.hoveredHandle = null;
    this.domElement.style.cursor = "default";
  }

  // -------------------------------------------------------------
  // Pointer Down: Initiate Drag
  // -------------------------------------------------------------
  public onPointerDown(e: PointerEvent, raycaster: THREE.Raycaster): boolean {
    if (!this.group.visible || this.options.mode === "select" || !this.targetObject) return false;

    const activeColliders = this.colliders.filter((c) => c.parent && c.parent.visible);
    const intersects = raycaster.intersectObjects(activeColliders, false);

    if (intersects.length === 0) return false;

    const hit = intersects[0];
    const handle = hit.object.userData.handle as GizmoHandle;
    if (!handle) return false;

    this.isDragging = true;
    this.activeHandle = handle;
    this.dragStartMouse.set(e.clientX, e.clientY);

    // Snapshot target pose
    this.initialObjectPosition.copy(this.targetObject.position);
    this.initialObjectRotation.copy(this.targetObject.rotation);
    this.initialObjectScale.copy(this.targetObject.scale);

    // Setup intersection drag plane
    const center = this.group.position;
    const camDir = this.camera.position.clone().sub(center).normalize();

    if (handle === "translate-x" || handle === "scale-x") {
      const axis = new THREE.Vector3(1, 0, 0);
      const normal = new THREE.Vector3().crossVectors(axis, camDir).cross(axis).normalize();
      this.dragPlane.setFromNormalAndCoplanarPoint(normal, center);
    } else if (handle === "translate-y" || handle === "scale-y") {
      const axis = new THREE.Vector3(0, 1, 0);
      const normal = new THREE.Vector3().crossVectors(axis, camDir).cross(axis).normalize();
      this.dragPlane.setFromNormalAndCoplanarPoint(normal, center);
    } else if (handle === "translate-z" || handle === "scale-z") {
      const axis = new THREE.Vector3(0, 0, 1);
      const normal = new THREE.Vector3().crossVectors(axis, camDir).cross(axis).normalize();
      this.dragPlane.setFromNormalAndCoplanarPoint(normal, center);
    } else if (handle === "translate-xy") {
      this.dragPlane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 0, 1), center);
    } else if (handle === "translate-xz") {
      this.dragPlane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 1, 0), center);
    } else if (handle === "translate-yz") {
      this.dragPlane.setFromNormalAndCoplanarPoint(new THREE.Vector3(1, 0, 0), center);
    } else if (handle === "rotate-x") {
      this.dragPlane.setFromNormalAndCoplanarPoint(new THREE.Vector3(1, 0, 0), center);
    } else if (handle === "rotate-y") {
      this.dragPlane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 1, 0), center);
    } else if (handle === "rotate-z") {
      this.dragPlane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 0, 1), center);
    } else {
      // Uniform scale or camera aligned
      this.dragPlane.setFromNormalAndCoplanarPoint(camDir, center);
    }

    if (raycaster.ray.intersectPlane(this.dragPlane, this.dragPlaneIntersect)) {
      this.dragStartHitPoint.copy(this.dragPlaneIntersect);
      const local = this.dragStartHitPoint.clone().sub(center);
      if (handle === "rotate-x") this.dragStartAngle = Math.atan2(local.z, local.y);
      if (handle === "rotate-y") this.dragStartAngle = Math.atan2(local.x, local.z);
      if (handle === "rotate-z") this.dragStartAngle = Math.atan2(local.y, local.x);
    }

    this.options.onDragStart?.(handle);
    this.domElement.style.cursor = "grabbing";
    return true;
  }

  // -------------------------------------------------------------
  // Pointer Move: Active Drag Calculation & Live Snapping
  // -------------------------------------------------------------
  private handleDrag(e: PointerEvent, raycaster: THREE.Raycaster) {
    if (!this.isDragging || !this.activeHandle || !this.targetObject) return;

    if (!raycaster.ray.intersectPlane(this.dragPlane, this.dragPlaneIntersect)) return;

    const center = this.group.position;
    const delta = this.dragPlaneIntersect.clone().sub(this.dragStartHitPoint);

    // Snapping inversion logic: Holding Ctrl inverts current snapEnabled setting
    const effectiveSnap =
      (this.options.snapEnabled && !this.options.isCtrlHeld) ||
      (!this.options.snapEnabled && this.options.isCtrlHeld);

    let badgeType = "MOVE";
    let badgeText = "";

    // 1. Translations
    if (this.activeHandle.startsWith("translate-")) {
      badgeType = "MOVE";
      const newPos = this.initialObjectPosition.clone();

      if (this.activeHandle === "translate-x") {
        let dist = delta.x;
        if (effectiveSnap) dist = Math.round(dist / this.options.gridSnapUnit) * this.options.gridSnapUnit;
        newPos.x += dist;
        badgeText = `${dist >= 0 ? "+" : ""}${dist.toFixed(2)} m`;
      } else if (this.activeHandle === "translate-y") {
        let dist = delta.y;
        if (effectiveSnap) dist = Math.round(dist / this.options.gridSnapUnit) * this.options.gridSnapUnit;
        newPos.y += dist;
        badgeText = `${dist >= 0 ? "+" : ""}${dist.toFixed(2)} m`;
      } else if (this.activeHandle === "translate-z") {
        let dist = delta.z;
        if (effectiveSnap) dist = Math.round(dist / this.options.gridSnapUnit) * this.options.gridSnapUnit;
        newPos.z += dist;
        badgeText = `${dist >= 0 ? "+" : ""}${dist.toFixed(2)} m`;
      } else if (this.activeHandle === "translate-xy") {
        let dx = delta.x;
        let dy = delta.y;
        if (effectiveSnap) {
          dx = Math.round(dx / this.options.gridSnapUnit) * this.options.gridSnapUnit;
          dy = Math.round(dy / this.options.gridSnapUnit) * this.options.gridSnapUnit;
        }
        newPos.x += dx;
        newPos.y += dy;
        badgeText = `XY: ${dx >= 0 ? "+" : ""}${dx.toFixed(2)}, ${dy >= 0 ? "+" : ""}${dy.toFixed(2)} m`;
      } else if (this.activeHandle === "translate-xz") {
        let dx = delta.x;
        let dz = delta.z;
        if (effectiveSnap) {
          dx = Math.round(dx / this.options.gridSnapUnit) * this.options.gridSnapUnit;
          dz = Math.round(dz / this.options.gridSnapUnit) * this.options.gridSnapUnit;
        }
        newPos.x += dx;
        newPos.z += dz;
        badgeText = `XZ: ${dx >= 0 ? "+" : ""}${dx.toFixed(2)}, ${dz >= 0 ? "+" : ""}${dz.toFixed(2)} m`;
      } else if (this.activeHandle === "translate-yz") {
        let dy = delta.y;
        let dz = delta.z;
        if (effectiveSnap) {
          dy = Math.round(dy / this.options.gridSnapUnit) * this.options.gridSnapUnit;
          dz = Math.round(dz / this.options.gridSnapUnit) * this.options.gridSnapUnit;
        }
        newPos.y += dy;
        newPos.z += dz;
        badgeText = `YZ: ${dy >= 0 ? "+" : ""}${dy.toFixed(2)}, ${dz >= 0 ? "+" : ""}${dz.toFixed(2)} m`;
      }

      // Drag & Drop Snapping on Surface (Shift Held)
      if (this.options.isShiftHeld) {
        const bbox = new THREE.Box3().setFromObject(this.targetObject);
        const bottomOffset = this.targetObject.position.y - bbox.min.y;
        newPos.y = bottomOffset; // Snaps bottom flush with floor grid (Y = 0)
        badgeText += " [FLOOR SNAPPED]";
      }

      this.targetObject.position.copy(newPos);
    }

    // 2. Rotations
    else if (this.activeHandle.startsWith("rotate-")) {
      badgeType = "ROTATE";
      const local = this.dragPlaneIntersect.clone().sub(center);
      let angle = 0;

      if (this.activeHandle === "rotate-x") {
        angle = Math.atan2(local.z, local.y) - this.dragStartAngle;
        if (effectiveSnap) {
          const stepRad = THREE.MathUtils.degToRad(this.options.rotationSnapStep);
          angle = Math.round(angle / stepRad) * stepRad;
        }
        this.targetObject.rotation.x = this.initialObjectRotation.x + angle;
      } else if (this.activeHandle === "rotate-y") {
        angle = Math.atan2(local.x, local.z) - this.dragStartAngle;
        if (effectiveSnap) {
          const stepRad = THREE.MathUtils.degToRad(this.options.rotationSnapStep);
          angle = Math.round(angle / stepRad) * stepRad;
        }
        this.targetObject.rotation.y = this.initialObjectRotation.y + angle;
      } else if (this.activeHandle === "rotate-z") {
        angle = Math.atan2(local.y, local.x) - this.dragStartAngle;
        if (effectiveSnap) {
          const stepRad = THREE.MathUtils.degToRad(this.options.rotationSnapStep);
          angle = Math.round(angle / stepRad) * stepRad;
        }
        this.targetObject.rotation.z = this.initialObjectRotation.z + angle;
      }

      const deg = THREE.MathUtils.radToDeg(angle);
      badgeText = `${deg >= 0 ? "+" : ""}${deg.toFixed(1)}°`;
    }

    // 3. Scaling
    else if (this.activeHandle.startsWith("scale-")) {
      badgeType = "SCALE";
      const newScale = this.initialObjectScale.clone();

      if (this.activeHandle === "scale-xyz") {
        const dragDist = (e.clientX - this.dragStartMouse.x) - (e.clientY - this.dragStartMouse.y);
        let factor = Math.max(0.05, 1.0 + dragDist * 0.01);
        if (effectiveSnap) factor = Math.max(0.1, Math.round(factor * 10) / 10);
        newScale.multiplyScalar(factor);
        badgeText = `${factor.toFixed(2)}x`;
      } else if (this.activeHandle === "scale-x") {
        let factor = Math.max(0.05, 1.0 + delta.x * 0.8);
        if (effectiveSnap) factor = Math.max(0.1, Math.round(factor * 10) / 10);
        newScale.x = this.initialObjectScale.x * factor;
        badgeText = `X: ${factor.toFixed(2)}x`;
      } else if (this.activeHandle === "scale-y") {
        let factor = Math.max(0.05, 1.0 + delta.y * 0.8);
        if (effectiveSnap) factor = Math.max(0.1, Math.round(factor * 10) / 10);
        newScale.y = this.initialObjectScale.y * factor;
        badgeText = `Y: ${factor.toFixed(2)}x`;
      } else if (this.activeHandle === "scale-z") {
        let factor = Math.max(0.05, 1.0 + delta.z * 0.8);
        if (effectiveSnap) factor = Math.max(0.1, Math.round(factor * 10) / 10);
        newScale.z = this.initialObjectScale.z * factor;
        badgeText = `Z: ${factor.toFixed(2)}x`;
      }

      this.targetObject.scale.copy(newScale);
    }

    this.options.onDragMove?.({
      type: badgeType,
      text: badgeText,
      x: e.clientX,
      y: e.clientY,
    });

    this.options.onObjectChange?.();
  }

  // -------------------------------------------------------------
  // Pointer Up: Commit Drag
  // -------------------------------------------------------------
  public onPointerUp(): boolean {
    if (!this.isDragging) return false;
    this.isDragging = false;
    this.activeHandle = null;
    this.domElement.style.cursor = "default";
    this.options.onDragEnd?.();
    return true;
  }

  // -------------------------------------------------------------
  // 1-Click Transform Reset Actions
  // -------------------------------------------------------------
  public placeOnFloor() {
    if (!this.targetObject) return;
    const bbox = new THREE.Box3().setFromObject(this.targetObject);
    const bottomOffset = this.targetObject.position.y - bbox.min.y;
    this.targetObject.position.y = bottomOffset;
    this.options.onObjectChange?.();
  }

  public centerToOrigin() {
    if (!this.targetObject) return;
    this.targetObject.position.set(0, this.targetObject.position.y, 0);
    this.options.onObjectChange?.();
  }

  public resetRotation() {
    if (!this.targetObject) return;
    this.targetObject.rotation.set(0, 0, 0);
    this.options.onObjectChange?.();
  }

  public resetScale() {
    if (!this.targetObject) return;
    this.targetObject.scale.set(1, 1, 1);
    this.options.onObjectChange?.();
  }

  public dispose() {
    this.colliders.forEach((c) => {
      c.geometry.dispose();
      (c.material as THREE.Material).dispose();
    });
    this.highlightMaterial.dispose();
    if (this.group.parent) {
      this.group.parent.remove(this.group);
    }
  }
}
