import { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import {
  BOAT_MAX_SPEED,
  BOAT_ACCELERATION,
  BOAT_DECELERATION,
  BOAT_TURN_SPEED,
  BOAT_LENGTH,
  BOAT_WIDTH,
  WATER_LEVEL,
  COLORS,
  MAX_PASSENGERS,
} from "../utils/constants";
import { hexToColor3, clamp } from "../utils/helpers";
import { WaterSystem } from "../world/WaterSystem";

export class LanchaColectiva {
  public rootNode: TransformNode;
  public position: Vector3;
  public rotation = 0; // Y-axis rotation
  public speed = 0;
  public throttle = 0; // -1 to 1
  public steering = 0; // -1 to 1
  public passengers = 0;
  public wakeIntensity = 0;

  private scene: Scene;
  private meshes: Mesh[] = [];
  private time = 0;
  private bobPhase = 0;

  constructor(scene: Scene, startX: number, startZ: number) {
    this.scene = scene;
    this.position = new Vector3(startX, WATER_LEVEL + 0.3, startZ);
    this.rootNode = new TransformNode("lancha", scene);
    this.rootNode.position = this.position.clone();
    this.buildBoat();
  }

  private createMat(name: string, color: string): StandardMaterial {
    const mat = new StandardMaterial(name, this.scene);
    mat.diffuseColor = hexToColor3(color);
    mat.specularColor = new Color3(0.1, 0.1, 0.1);
    return mat;
  }

  private buildBoat(): void {
    // Hull - main body (wooden, classic lancha shape)
    const hull = MeshBuilder.CreateBox(
      "hull",
      { width: BOAT_WIDTH + 0.4, height: 0.8, depth: BOAT_LENGTH },
      this.scene
    );
    hull.material = this.createMat("hullMat", COLORS.boatHull);
    hull.parent = this.rootNode;
    hull.position.y = 0;
    this.meshes.push(hull);

    // Hull sides (raised gunwales)
    const sideL = MeshBuilder.CreateBox(
      "sideL",
      { width: 0.2, height: 0.6, depth: BOAT_LENGTH - 0.5 },
      this.scene
    );
    sideL.material = this.createMat("sideLMat", COLORS.woodDark);
    sideL.parent = this.rootNode;
    sideL.position.set(-BOAT_WIDTH / 2 - 0.1, 0.5, 0);
    this.meshes.push(sideL);

    const sideR = sideL.clone("sideR");
    sideR.position.x = BOAT_WIDTH / 2 + 0.1;
    sideR.parent = this.rootNode;
    this.meshes.push(sideR);

    // Deck
    const deck = MeshBuilder.CreateBox(
      "deck",
      { width: BOAT_WIDTH + 0.2, height: 0.1, depth: BOAT_LENGTH - 0.4 },
      this.scene
    );
    deck.material = this.createMat("deckMat", COLORS.boatDeck);
    deck.parent = this.rootNode;
    deck.position.y = 0.45;
    this.meshes.push(deck);

    // Cabin (the covered passenger area)
    const cabinLength = BOAT_LENGTH * 0.5;
    const cabin = MeshBuilder.CreateBox(
      "cabin",
      { width: BOAT_WIDTH - 0.2, height: 1.2, depth: cabinLength },
      this.scene
    );
    cabin.material = this.createMat("cabinMat", COLORS.boatCabin);
    cabin.parent = this.rootNode;
    cabin.position.set(0, 1.1, -0.3);
    this.meshes.push(cabin);

    // Cabin windows (as lighter colored strips)
    for (let side = -1; side <= 1; side += 2) {
      for (let i = 0; i < 5; i++) {
        const window = MeshBuilder.CreateBox(
          `window_${side}_${i}`,
          { width: 0.05, height: 0.5, depth: 0.4 },
          this.scene
        );
        const winMat = this.createMat(`winMat_${side}_${i}`, COLORS.boatTrim);
        winMat.alpha = 0.7;
        window.material = winMat;
        window.parent = this.rootNode;
        window.position.set(
          (side * (BOAT_WIDTH - 0.2)) / 2 + side * 0.03,
          1.15,
          -0.3 + (i - 2) * 0.55
        );
        this.meshes.push(window);
      }
    }

    // Roof over cabin
    const roof = MeshBuilder.CreateBox(
      "roof",
      { width: BOAT_WIDTH + 0.3, height: 0.15, depth: cabinLength + 0.6 },
      this.scene
    );
    roof.material = this.createMat("roofMat", COLORS.boatRoof);
    roof.parent = this.rootNode;
    roof.position.set(0, 1.8, -0.3);
    this.meshes.push(roof);

    // Roof trim (colored stripe like real lanchas)
    const trim = MeshBuilder.CreateBox(
      "trim",
      { width: BOAT_WIDTH + 0.35, height: 0.08, depth: cabinLength + 0.65 },
      this.scene
    );
    trim.material = this.createMat("trimMat", COLORS.boatTrim);
    trim.parent = this.rootNode;
    trim.position.set(0, 1.88, -0.3);
    this.meshes.push(trim);

    // Bow (front pointed section)
    const bow = MeshBuilder.CreateBox(
      "bow",
      { width: BOAT_WIDTH * 0.6, height: 0.6, depth: 1.2 },
      this.scene
    );
    bow.material = this.createMat("bowMat", COLORS.boatHull);
    bow.parent = this.rootNode;
    bow.position.set(0, 0.1, BOAT_LENGTH / 2 - 0.3);
    this.meshes.push(bow);

    // Bow tip
    const bowTip = MeshBuilder.CreateBox(
      "bowTip",
      { width: BOAT_WIDTH * 0.3, height: 0.4, depth: 0.6 },
      this.scene
    );
    bowTip.material = this.createMat("bowTipMat", COLORS.woodDark);
    bowTip.parent = this.rootNode;
    bowTip.position.set(0, 0.15, BOAT_LENGTH / 2 + 0.3);
    this.meshes.push(bowTip);

    // Stern platform
    const stern = MeshBuilder.CreateBox(
      "stern",
      { width: BOAT_WIDTH + 0.2, height: 0.3, depth: 1.0 },
      this.scene
    );
    stern.material = this.createMat("sternMat", COLORS.woodLight);
    stern.parent = this.rootNode;
    stern.position.set(0, 0.55, -BOAT_LENGTH / 2 + 0.4);
    this.meshes.push(stern);

    // Pilot house (small front cabin)
    const pilotHouse = MeshBuilder.CreateBox(
      "pilotHouse",
      { width: BOAT_WIDTH - 0.4, height: 1.0, depth: 1.2 },
      this.scene
    );
    pilotHouse.material = this.createMat("pilotMat", COLORS.woodLight);
    pilotHouse.parent = this.rootNode;
    pilotHouse.position.set(0, 1.0, BOAT_LENGTH / 2 - 1.2);
    this.meshes.push(pilotHouse);

    // Pilot house windshield
    const windshield = MeshBuilder.CreateBox(
      "windshield",
      { width: BOAT_WIDTH - 0.5, height: 0.5, depth: 0.05 },
      this.scene
    );
    const wsMat = this.createMat("wsMat", "#aaddff");
    wsMat.alpha = 0.5;
    windshield.material = wsMat;
    windshield.parent = this.rootNode;
    windshield.position.set(0, 1.2, BOAT_LENGTH / 2 - 0.6);
    this.meshes.push(windshield);

    // Argentine flag on a small pole
    const flagPole = MeshBuilder.CreateBox(
      "flagPole",
      { width: 0.05, height: 1.0, depth: 0.05 },
      this.scene
    );
    flagPole.material = this.createMat("poleMat", "#888888");
    flagPole.parent = this.rootNode;
    flagPole.position.set(0, 2.3, -BOAT_LENGTH / 2 + 0.3);
    this.meshes.push(flagPole);

    const flag = MeshBuilder.CreateBox(
      "flag",
      { width: 0.5, height: 0.3, depth: 0.02 },
      this.scene
    );
    flag.material = this.createMat("flagMat", COLORS.flag);
    flag.parent = this.rootNode;
    flag.position.set(0.25, 2.7, -BOAT_LENGTH / 2 + 0.3);
    this.meshes.push(flag);

    // White stripe on flag
    const flagWhite = MeshBuilder.CreateBox(
      "flagWhite",
      { width: 0.5, height: 0.1, depth: 0.025 },
      this.scene
    );
    flagWhite.material = this.createMat("flagWhiteMat", COLORS.white);
    flagWhite.parent = this.rootNode;
    flagWhite.position.set(0.25, 2.7, -BOAT_LENGTH / 2 + 0.3);
    this.meshes.push(flagWhite);
  }

  public update(
    deltaTime: number,
    waterSystem: WaterSystem,
    gyroSteering: number | null
  ): void {
    this.time += deltaTime;

    // Apply gyro steering if available
    const effectiveSteering =
      gyroSteering !== null ? gyroSteering : this.steering;

    // Acceleration / deceleration
    if (this.throttle !== 0) {
      this.speed += this.throttle * BOAT_ACCELERATION;
    } else {
      // Natural deceleration
      if (Math.abs(this.speed) > 0.001) {
        this.speed -= Math.sign(this.speed) * BOAT_DECELERATION;
      } else {
        this.speed = 0;
      }
    }
    this.speed = clamp(this.speed, -BOAT_MAX_SPEED * 0.3, BOAT_MAX_SPEED);

    // Turning (more responsive at higher speed)
    const turnFactor = Math.min(1, Math.abs(this.speed) / (BOAT_MAX_SPEED * 0.3));
    this.rotation += effectiveSteering * BOAT_TURN_SPEED * turnFactor;

    // Move forward in direction of rotation
    const dx = Math.sin(this.rotation) * this.speed;
    const dz = Math.cos(this.rotation) * this.speed;

    const newX = this.position.x + dx;
    const newZ = this.position.z + dz;

    // Check if new position is on water
    if (waterSystem.isWater(newX, newZ)) {
      this.position.x = newX;
      this.position.z = newZ;
    } else {
      // Hit land - bounce back and slow down
      this.speed *= -0.3;
      // Try to slide along the bank
      if (waterSystem.isWater(newX, this.position.z)) {
        this.position.x = newX;
        this.speed *= 0.5;
      } else if (waterSystem.isWater(this.position.x, newZ)) {
        this.position.z = newZ;
        this.speed *= 0.5;
      }
    }

    // Wave bobbing
    this.bobPhase += deltaTime * 2;
    const waveH = waterSystem.getWaveHeight(
      this.position.x,
      this.position.z,
      this.time
    );
    this.position.y = WATER_LEVEL + 0.3 + waveH;

    // Wake intensity based on speed
    this.wakeIntensity = Math.abs(this.speed) / BOAT_MAX_SPEED;

    // Update transform
    this.rootNode.position.copyFrom(this.position);
    this.rootNode.rotation.y = this.rotation;
    // Roll based on turning
    this.rootNode.rotation.z =
      -effectiveSteering * turnFactor * 0.08 +
      Math.sin(this.bobPhase * 0.7) * 0.02;
    // Pitch based on speed
    this.rootNode.rotation.x =
      -this.speed * 0.15 + Math.sin(this.bobPhase) * 0.015;
  }

  public canPickup(): boolean {
    return this.passengers < MAX_PASSENGERS;
  }

  public addPassengers(count: number): number {
    const space = MAX_PASSENGERS - this.passengers;
    const actual = Math.min(count, space);
    this.passengers += actual;
    return actual;
  }

  public dropPassengers(): number {
    const dropped = this.passengers;
    this.passengers = 0;
    return dropped;
  }
}
