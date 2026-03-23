const { app, BrowserWindow, shell, Menu, nativeImage } = require("electron");
const { spawn, execSync } = require("child_process");
const path = require("path");
const waitOn = require("wait-on");

const PORT = 3333;

let mainWindow = null;
let nextProcess = null;
let splashWin = null;

// ── Helpers: splash status text ────────────────────────────
async function setStatus(text) {
  try {
    if (splashWin && !splashWin.isDestroyed()) {
      await splashWin.webContents.executeJavaScript(
        `setStatus(${JSON.stringify(text)})`,
      );
    }
  } catch {}
}

async function showSplashError(title, message) {
  try {
    if (splashWin && !splashWin.isDestroyed()) {
      await splashWin.webContents.executeJavaScript(
        `showError(${JSON.stringify(title)}, ${JSON.stringify(message)})`,
      );
    }
  } catch {}
  await new Promise((r) => setTimeout(r, 5500));
}

// ── Kill process listening on port (Windows) ──────────────
function killProcessOnPort(port) {
  if (process.platform !== "win32") return false;
  try {
    const out = execSync(
      `netstat -ano | findstr :${port} | findstr LISTENING`,
      { encoding: "utf8", stdio: "pipe" },
    );
    const lines = out
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (!lines.length) return false;
    const m = lines[0].match(/(\d+)\s*$/);
    if (!m) return false;
    const pid = m[1];
    execSync(`taskkill /PID ${pid} /F /T`, { stdio: "pipe" });
    console.log(`[electron] Killed process PID ${pid} on port ${port}`);
    return true;
  } catch {
    console.warn("[electron] Could not kill process on port", port);
    return false;
  }
}

// ── Start Next.js dev server on fixed port ────────────────
function startNextServer(port) {
  return new Promise((resolve, reject) => {
    // npx next dev -p <port> works on Windows, Linux, and macOS
    nextProcess = spawn("npx", ["next", "dev", "-p", String(port)], {
      cwd: path.join(__dirname, ".."),
      shell: true,
      stdio: "pipe",
      env: { ...process.env, FORCE_COLOR: "0", PORT: String(port) },
    });

    nextProcess.stdout?.on("data", (d) => process.stdout.write(d));
    nextProcess.stderr?.on("data", (d) => process.stderr.write(d));
    nextProcess.on("error", reject);

    waitOn({ resources: [`http-get://localhost:${port}`], timeout: 120000 })
      .then(resolve)
      .catch(reject);
  });
}

// ── Main application window ───────────────────────────────
function createWindow() {
  const icon = nativeImage.createFromPath(
    path.join(__dirname, "../public/favicon.png"),
  );

  mainWindow = new BrowserWindow({
    width: 760,
    height: 680,
    minWidth: 520,
    minHeight: 500,
    title: "Vault Manager",
    icon,
    backgroundColor: "#0a0c10",
    center: true,
    frame: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  Menu.setApplicationMenu(null);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(`http://localhost:${PORT}`)) {
      shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });

  mainWindow.loadURL(`http://localhost:${PORT}`);
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// ── Lifecycle ─────────────────────────────────────────────
app.whenReady().then(async () => {
  splashWin = new BrowserWindow({
    width: 360,
    height: 300,
    frame: false,
    center: true,
    resizable: false,
    backgroundColor: "#0d1117",
    webPreferences: { nodeIntegration: false },
  });

  await splashWin.loadFile(path.join(__dirname, "splash.html"));

  try {
    await setStatus("Checking port...");

    const killed = killProcessOnPort(PORT);
    if (killed) {
      await setStatus("Freed the port — starting the app...");
      await new Promise((r) => setTimeout(r, 1000));
    } else {
      await setStatus("Port looks free — starting the app...");
    }

    let elapsed = 0;
    const ticker = setInterval(() => {
      elapsed++;
      setStatus(`Starting the app... ${elapsed}s`);
    }, 1000);

    try {
      await startNextServer(PORT);
    } finally {
      clearInterval(ticker);
    }

    await setStatus("Ready!");
    await new Promise((r) => setTimeout(r, 300));
    splashWin.close();
    createWindow();
  } catch (err) {
    console.error("[electron] Startup error:", err);
    const msg = err?.message || String(err);
    await showSplashError(
      "Startup failed",
      msg.includes("timeout") || msg.includes("Timeout")
        ? "The app did not start within 120 seconds.\nCheck that Node.js is installed\nand run: npm install"
        : msg.slice(0, 160),
    );
    app.quit();
  }
});

// ── Cleanup ────────────────────────────────────────────────
function cleanup() {
  if (nextProcess) {
    if (process.platform === "win32") {
      spawn("taskkill", ["/pid", nextProcess.pid, "/f", "/t"], { shell: true });
    } else {
      nextProcess.kill("SIGTERM");
    }
    nextProcess = null;
  }
}

app.on("window-all-closed", () => {
  cleanup();
  app.quit();
});
app.on("before-quit", cleanup);
process.on("uncaughtException", (err) => {
  console.error("[electron] uncaughtException:", err);
});
