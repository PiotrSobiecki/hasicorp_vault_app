const { app, BrowserWindow, shell, Menu, nativeImage } = require("electron");
const { spawn, execSync } = require("child_process");
const path = require("path");
const waitOn = require("wait-on");

const PORT = 3333;

let mainWindow = null;
let nextProcess = null;
let splashWin = null;

// ── Helpers: status na splash ──────────────────────────────
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

// ── Zabij proces nasłuchujący na porcie 3333 (Windows) ─────
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
    console.log(`[electron] Zabito proces PID ${pid} na porcie ${port}`);
    return true;
  } catch {
    console.warn("[electron] Nie udało się zabić procesu na porcie", port);
    return false;
  }
}

// ── Uruchom serwer Next.js na porcie 3333 ──────────────────
function startNextServer(port) {
  return new Promise((resolve, reject) => {
    // npx next dev -p <port> – działa na Windows i Linux/Mac
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

// ── Główne okno aplikacji ──────────────────────────────────
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

// ── Lifecycle ──────────────────────────────────────────────
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
    await setStatus("Sprawdzanie portu...");

    const killed = killProcessOnPort(PORT);
    if (killed) {
      await setStatus("Zwolniono port– uruchamianie aplikacji…");
      await new Promise((r) => setTimeout(r, 1000));
    } else {
      await setStatus("Port wygląda na wolny – uruchamianie aplikacji…");
    }

    let elapsed = 0;
    const ticker = setInterval(() => {
      elapsed++;
      setStatus(`Uruchamianie aplikacji... ${elapsed}s`);
    }, 1000);

    try {
      await startNextServer(PORT);
    } finally {
      clearInterval(ticker);
    }

    await setStatus("Gotowe!");
    await new Promise((r) => setTimeout(r, 300));
    splashWin.close();
    createWindow();
  } catch (err) {
    console.error("[electron] Błąd uruchamiania:", err);
    const msg = err?.message || String(err);
    await showSplashError(
      "Błąd uruchamiania",
      msg.includes("timeout") || msg.includes("Timeout")
        ? "Serwer nie uruchomił się w 120 sekund.\nSprawdź czy Node.js jest zainstalowany\ni uruchom: npm install"
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
