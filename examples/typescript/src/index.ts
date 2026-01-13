// Legacy element references (kept for compatibility)
const baudrates = document.getElementById("baudrates") as HTMLInputElement;
const consoleBaudrates = document.getElementById("consoleBaudrates") as HTMLInputElement;
const reconnectDelay = document.getElementById("reconnectDelay") as HTMLInputElement;
const maxRetriesInput = document.getElementById("maxRetries") as HTMLInputElement;
const connectButton = document.getElementById("connectButton") as HTMLButtonElement;
const traceButton = document.getElementById("copyTraceButton") as HTMLButtonElement;
const disconnectButton = document.getElementById("disconnectButton") as HTMLButtonElement;
const resetButton = document.getElementById("resetButton") as HTMLButtonElement;
const consoleStartButton = document.getElementById("consoleStartButton") as HTMLButtonElement;
const consoleStopButton = document.getElementById("consoleStopButton") as HTMLButtonElement;
const eraseButton = document.getElementById("eraseButton") as HTMLButtonElement;
const addFileButton = document.getElementById("addFile") as HTMLButtonElement;
const programButton = document.getElementById("programButton") as HTMLButtonElement;
const filesDiv = document.getElementById("files");
const terminal = document.getElementById("terminal");
const programDiv = document.getElementById("program");
const consoleDiv = document.getElementById("console");
const lblBaudrate = document.getElementById("lblBaudrate");
const lblConsoleBaudrate = document.getElementById("lblConsoleBaudrate");
const lblConsoleFor = document.getElementById("lblConsoleFor");
const lblConnTo = document.getElementById("lblConnTo");
const table = document.getElementById("fileTable") as HTMLTableElement;
const alertDiv = document.getElementById("alertDiv");
const flashMode = document.getElementById("flashMode") as HTMLInputElement;
const flashFreq = document.getElementById("flashFreq") as HTMLInputElement;
const flashSize = document.getElementById("flashSize") as HTMLInputElement;
const lblFlashMode = document.getElementById("lblFlashMode");
const lblFlashFreq = document.getElementById("lblFlashFreq");
const lblFlashSize = document.getElementById("lblFlashSize");
const debugLogging = document.getElementById("debugLogging") as HTMLInputElement;

// New simplified UI elements
const connectSection = document.getElementById("connectSection");
const programSection = document.getElementById("programSection");
const terminalContainer = document.getElementById("terminalContainer");
const firmwareFile = document.getElementById("firmwareFile") as HTMLInputElement;
const mainProgress = document.getElementById("mainProgress") as HTMLProgressElement;
const progressContainer = document.getElementById("progressContainer");
const copyConsoleButton = document.getElementById("copyConsoleButton") as HTMLButtonElement;

// Store console log for copy functionality
let consoleLog = "";

// This is a frontend example of Esptool-JS using local bundle file
// To optimize use a CDN hosted version like
// https://unpkg.com/esptool-js@0.5.0/bundle.js
import {
  ESPLoader,
  FlashOptions,
  LoaderOptions,
  Transport,
} from "../../../lib";
import { serial } from "web-serial-polyfill";

const serialLib = !navigator.serial && navigator.usb ? serial : navigator.serial;

declare let Terminal; // Terminal is imported in HTML script
declare let CryptoJS; // CryptoJS is imported in HTML script

const term = new Terminal({ cols: 120, rows: 40 });
term.open(terminal);

let device = null;
let deviceInfo = null;
let transport: Transport;
let chip: string = null;
let esploader: ESPLoader;
let firmwareData: Uint8Array = null;

const espLoaderTerminal = {
  clean() {
    term.clear();
    consoleLog = "";
  },
  writeLine(data) {
    term.writeln(data);
    consoleLog += data + "\n";
  },
  write(data) {
    term.write(data);
    consoleLog += data;
  },
};

// Copy console log to clipboard
copyConsoleButton.onclick = async () => {
  try {
    await navigator.clipboard.writeText(consoleLog);
    // Visual feedback
    const originalText = copyConsoleButton.textContent;
    copyConsoleButton.textContent = "Copied!";
    copyConsoleButton.classList.add("btn-copied");
    setTimeout(() => {
      copyConsoleButton.textContent = originalText;
      copyConsoleButton.classList.remove("btn-copied");
    }, 2000);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Failed to copy:", err);
  }
};

// Handle firmware file selection
firmwareFile.addEventListener("change", (evt: Event) => {
  const target = evt.target as HTMLInputElement;
  const file = target.files?.[0];

  if (!file) {
    firmwareData = null;
    return;
  }

  const reader = new FileReader();
  reader.onload = (ev: ProgressEvent<FileReader>) => {
    if (ev.target?.result instanceof ArrayBuffer) {
      firmwareData = new Uint8Array(ev.target.result);
    }
  };
  reader.readAsArrayBuffer(file);
});

connectButton.onclick = async () => {
  try {
    if (device === null) {
      device = await serialLib.requestPort({});
      deviceInfo = device.getInfo();
      transport = new Transport(device, true);
    }

    const flashOptions = {
      transport,
      baudrate: parseInt(baudrates.value),
      terminal: espLoaderTerminal,
      debugLogging: debugLogging.checked,
    } as LoaderOptions;

    esploader = new ESPLoader(flashOptions);
    chip = await esploader.main();

    // eslint-disable-next-line no-console
    console.log("Settings done for: " + chip);

    // Update UI to show programming section
    connectSection.style.display = "none";
    programSection.style.display = "block";
    terminalContainer.style.display = "block";
    lblConnTo.innerHTML = chip;

  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(e);
    term.writeln(`Error: ${e.message}`);
  }
};

traceButton.onclick = async () => {
  if (transport) {
    transport.returnTrace();
  }
};

resetButton.onclick = async () => {
  if (transport) {
    await transport.setDTR(false);
    await new Promise((resolve) => setTimeout(resolve, 100));
    await transport.setDTR(true);
  }
};

eraseButton.onclick = async () => {
  eraseButton.disabled = true;
  try {
    await esploader.eraseFlash();
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(e);
    term.writeln(`Error: ${e.message}`);
  } finally {
    eraseButton.disabled = false;
  }
};

/**
 * Clean devices variables on chip disconnect. Remove stale references if any.
 */
function cleanUp() {
  device = null;
  deviceInfo = null;
  transport = null;
  chip = null;
  firmwareData = null;
}

disconnectButton.onclick = async () => {
  if (transport) await transport.disconnect();

  term.reset();
  consoleLog = "";

  // Reset UI to initial state
  connectSection.style.display = "block";
  programSection.style.display = "none";
  terminalContainer.style.display = "none";
  progressContainer.style.display = "none";
  mainProgress.value = 0;
  firmwareFile.value = "";
  alertDiv.style.display = "none";

  cleanUp();
};

programButton.onclick = async () => {
  const alertMsg = document.getElementById("alertmsg");

  // Validate firmware file is selected
  if (!firmwareData) {
    alertMsg.innerHTML = "<strong>Please select a firmware file first!</strong>";
    alertDiv.style.display = "flex";
    return;
  }

  // Hide error message
  alertDiv.style.display = "none";

  // Show progress bar
  progressContainer.style.display = "block";
  mainProgress.value = 0;

  try {
    const flashOptions: FlashOptions = {
      fileArray: [{ data: firmwareData, address: 0x0 }],
      flashSize: "keep",
      flashMode: "keep",
      flashFreq: "keep",
      eraseAll: false,
      compress: true,
      reportProgress: (fileIndex, written, total) => {
        mainProgress.value = (written / total) * 100;
      },
      calculateMD5Hash: (image: Uint8Array) => {
        const latin1String = Array.from(image, (byte) => String.fromCharCode(byte)).join("");
        return CryptoJS.MD5(CryptoJS.enc.Latin1.parse(latin1String)).toString();
      },
    };
    await esploader.writeFlash(flashOptions);
    await esploader.after();
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(e);
    term.writeln(`Error: ${e.message}`);
  } finally {
    // Keep progress bar visible to show completion
  }
};

// Legacy handlers for backwards compatibility (unused in simplified UI)
let isConsoleClosed = false;
let isReconnecting = false;

const sleep = async (ms: number) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

consoleStartButton.onclick = async () => {
  if (device === null) {
    device = await serialLib.requestPort({});
    transport = new Transport(device, true);
    deviceInfo = device.getInfo();

    transport.setDeviceLostCallback(async () => {
      if (!isConsoleClosed && !isReconnecting) {
        term.writeln("\n[DEVICE LOST] Device disconnected. Trying to reconnect...");
        await sleep(parseInt(reconnectDelay.value));
        isReconnecting = true;

        const maxRetries = parseInt(maxRetriesInput.value);
        let retryCount = 0;

        while (retryCount < maxRetries && !isConsoleClosed) {
          retryCount++;
          term.writeln(`\n[RECONNECT] Attempt ${retryCount}/${maxRetries}...`);

          if (serialLib && serialLib.getPorts) {
            const ports = await serialLib.getPorts();
            if (ports.length > 0) {
              const newDevice = ports.find(
                (port) =>
                  port.getInfo().usbVendorId === deviceInfo.usbVendorId &&
                  port.getInfo().usbProductId === deviceInfo.usbProductId,
              );

              if (newDevice) {
                device = newDevice;
                transport.updateDevice(device);
                term.writeln("[RECONNECT] Found previously authorized device, connecting...");
                await transport.connect(parseInt(consoleBaudrates.value));
                term.writeln("[RECONNECT] Successfully reconnected!");
                isReconnecting = false;
                startConsoleReading();
                return;
              }
            }
          }

          if (retryCount < maxRetries) {
            term.writeln(`[RECONNECT] Device not found, retrying in ${parseInt(reconnectDelay.value)}ms...`);
            await sleep(parseInt(reconnectDelay.value));
          }
        }

        if (retryCount >= maxRetries) {
          term.writeln("\n[RECONNECT] Failed to reconnect after 5 attempts. Please manually reconnect.");
          isReconnecting = false;
        }
      }
    });
  }

  await transport.connect(parseInt(consoleBaudrates.value));
  isConsoleClosed = false;
  isReconnecting = false;

  startConsoleReading();
};

async function startConsoleReading() {
  if (isConsoleClosed || !transport) return;

  try {
    const readLoop = transport.rawRead();

    while (true && !isConsoleClosed) {
      const { value, done } = await readLoop.next();

      if (done || !value) {
        break;
      }

      if (value) {
        term.write(value);
      }
    }
  } catch (error) {
    if (!isConsoleClosed) {
      term.writeln(`\n[CONSOLE ERROR] ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (!isConsoleClosed) {
    term.writeln("\n[CONSOLE] Connection lost, waiting for reconnection...");
  }
}

consoleStopButton.onclick = async () => {
  isConsoleClosed = true;
  isReconnecting = false;
  if (transport) {
    await transport.disconnect();
    await transport.waitForUnlock(1500);
  }
  term.reset();
  consoleLog = "";
  cleanUp();
};
