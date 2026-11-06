import { connectGanCube, type GanCubeEvent } from "gan-web-bluetooth";
import { recallMac, rememberMac } from "../mac";
import { Emitter, type CubeDriver, type SmartCube } from "./types";

/**
 * GAN Gen2/Gen3/Gen4 cubes via the `gan-web-bluetooth` library.
 *
 * Verified against a GAN i4 (firmware 2.0) on 2026-11-07: it speaks Gen4 and the stock library
 * handles it unmodified. The library's device list predates the i4, so this is worth recording —
 * if a future model fails, the smartkube repo has a raw GATT probe for diagnosing it.
 */

const GAN_SERVICES = [
  "6e400001-b5a3-f393-e0a9-e50e24dc4179", // Gen2
  "8653000a-43e6-47b7-9cb0-5fc21d4ae340", // Gen3
  "00000010-0000-fff7-fff6-fff5fff4fff0", // Gen4
];

/** GAN cubes advertise under any of these company IDs; the MAC hides in the payload. */
const GAN_CIC_LIST = Array.from({ length: 256 }, (_v, i) => (i << 8) | 0x01);

/**
 * `connectGanCube()` opens its *own* device chooser. We want one chooser covering every brand, so
 * for the duration of that single call we hand the library the device the user already picked.
 */
async function withChosenDevice<T>(device: BluetoothDevice, fn: () => Promise<T>): Promise<T> {
  const bluetooth = navigator.bluetooth;
  const original = bluetooth.requestDevice;
  bluetooth.requestDevice = async () => device;
  try {
    return await fn();
  } finally {
    bluetooth.requestDevice = original;
  }
}

export const ganDriver: CubeDriver = {
  brand: "GAN",
  namePrefixes: ["GAN", "MG", "AiCube"],
  optionalServices: GAN_SERVICES,
  optionalManufacturerData: GAN_CIC_LIST,

  async connect(device, ctx) {
    const connection = await withChosenDevice(device, () =>
      connectGanCube(async (d, isFallbackCall) => (isFallbackCall ? ctx.askMac(d) : recallMac(d)))
    );
    rememberMac(connection.deviceName, connection.deviceMAC);

    const emitter = new Emitter();
    // The i4 reports gyroSupported:false yet still streams orientation, so trust the events
    // rather than the flag.
    let sawGyro = false;

    connection.events$.subscribe((event: GanCubeEvent) => {
      const localTs = performance.now();
      switch (event.type) {
        case "MOVE":
          emitter.emit({
            type: "move",
            move: event.move,
            cubeTs: event.cubeTimestamp,
            localTs: event.localTimestamp ?? localTs,
          });
          break;
        case "FACELETS":
          emitter.emit({ type: "facelets", facelets: event.facelets, localTs });
          break;
        case "GYRO":
          sawGyro = true;
          emitter.emit({ type: "gyro", quaternion: event.quaternion, localTs });
          break;
        case "BATTERY":
          emitter.emit({ type: "battery", level: event.batteryLevel, localTs });
          break;
        case "HARDWARE":
          emitter.emit({
            type: "hardware",
            info: {
              hardwareName: event.hardwareName,
              softwareVersion: event.softwareVersion,
              hardwareVersion: event.hardwareVersion,
              productDate: event.productDate,
              gyroSupported: event.gyroSupported,
            },
            localTs,
          });
          break;
        case "DISCONNECT":
          emitter.emit({ type: "disconnect", localTs });
          break;
      }
    });

    const cube: SmartCube = {
      brand: "GAN",
      name: connection.deviceName,
      get capabilities() {
        return { facelets: true, gyro: sawGyro, battery: true, markSolved: true };
      },
      on: (listener) => emitter.on(listener),
      requestState: () => connection.sendCubeCommand({ type: "REQUEST_FACELETS" }),
      requestBattery: () => connection.sendCubeCommand({ type: "REQUEST_BATTERY" }),
      markSolved: async () => {
        await connection.sendCubeCommand({ type: "REQUEST_RESET" });
        await connection.sendCubeCommand({ type: "REQUEST_FACELETS" });
      },
      disconnect: () => connection.disconnect(),
    };

    // Ask for hardware/state/battery on the next macrotask, so the caller's `await connect()`
    // continuation has had a chance to subscribe before the replies arrive.
    setTimeout(() => {
      void (async () => {
        try {
          await connection.sendCubeCommand({ type: "REQUEST_HARDWARE" });
          await connection.sendCubeCommand({ type: "REQUEST_FACELETS" });
          await connection.sendCubeCommand({ type: "REQUEST_BATTERY" });
        } catch {
          // The cube may have gone away between connecting and this tick; the disconnect event
          // handles that path.
        }
      })();
    }, 0);

    return cube;
  },
};
