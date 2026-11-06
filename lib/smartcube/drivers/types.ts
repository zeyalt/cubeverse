/**
 * Brand-agnostic smart cube interface.
 *
 * Each brand driver translates its own BLE protocol into these events; nothing outside
 * `lib/smartcube/drivers/` knows about any specific brand. Adding MoYu, QiYi, GoCube or Giiker
 * later means writing one more driver, not touching the tab, the timer or the analysis.
 */

export type Quaternion = { x: number; y: number; z: number; w: number };

export type CubeEvent =
  /** A face turn in standard notation (U R F D L B, with ' or 2). */
  | { type: "move"; move: string; /** Cube's own clock in ms; null when unavailable. */ cubeTs: number | null; localTs: number }
  /** Full state as a 54-char Kociemba facelet string (see `lib/smartcube/facelets.ts`). */
  | { type: "facelets"; facelets: string; localTs: number }
  | { type: "gyro"; quaternion: Quaternion; localTs: number }
  | { type: "battery"; level: number; localTs: number }
  | { type: "hardware"; info: CubeHardwareInfo; localTs: number }
  | { type: "disconnect"; localTs: number };

export type CubeHardwareInfo = {
  hardwareName?: string;
  softwareVersion?: string;
  hardwareVersion?: string;
  productDate?: string;
  gyroSupported?: boolean;
};

export type CubeCapabilities = {
  /** Driver can report full state; otherwise the app tracks state from moves alone. */
  facelets: boolean;
  gyro: boolean;
  battery: boolean;
  /** Cube accepts a "treat your current state as solved" command. */
  markSolved: boolean;
};

export interface SmartCube {
  readonly brand: string;
  readonly name: string;
  readonly capabilities: CubeCapabilities;
  /** Subscribe to events; returns an unsubscribe function. */
  on(listener: (e: CubeEvent) => void): () => void;
  requestState(): Promise<void>;
  requestBattery(): Promise<void>;
  markSolved(): Promise<void>;
  disconnect(): Promise<void>;
}

/** What a driver contributes to the shared device chooser, and how it connects once picked. */
export interface CubeDriver {
  readonly brand: string;
  /** BLE advertisement name prefixes this driver handles. */
  readonly namePrefixes: readonly string[];
  /** GATT services the driver needs; Chrome requires them declared up front. */
  readonly optionalServices: readonly string[];
  /** Manufacturer-data company IDs to expose — some brands hide the MAC there. */
  readonly optionalManufacturerData?: readonly number[];
  connect(device: BluetoothDevice, ctx: ConnectContext): Promise<SmartCube>;
}

export type ConnectContext = {
  /**
   * Ask the user for the cube's MAC address. Some protocols derive their encryption key from it,
   * and macOS hides it from the browser, so this is a real user-facing flow, not a fallback.
   */
  askMac(device: BluetoothDevice): Promise<string | null>;
};

/** Minimal event emitter shared by drivers. */
export class Emitter {
  private listeners = new Set<(e: CubeEvent) => void>();

  on(listener: (e: CubeEvent) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  emit(event: CubeEvent): void {
    for (const listener of [...this.listeners]) listener(event);
  }
}
