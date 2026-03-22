"use client";

import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { XMarkIcon, CameraIcon } from "@heroicons/react/24/outline";

interface QrScannerProps {
  onScan: (secret: string) => void;
  onClose: () => void;
}

export default function QrScanner({ onScan, onClose }: QrScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 640 }, height: { ideal: 480 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setScanning(true);
        rafRef.current = requestAnimationFrame(scanFrame);
      }
    } catch {
      setError("Camera access denied. Check your browser permissions.");
    }
  }

  function stopCamera() {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  function scanFrame() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < video.HAVE_ENOUGH_DATA) {
      rafRef.current = requestAnimationFrame(scanFrame);
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: "dontInvert",
    });

    if (code?.data) {
      const secret = parseOtpAuth(code.data);
      if (secret) {
        stopCamera();
        onScan(secret);
        return;
      }
    }

    rafRef.current = requestAnimationFrame(scanFrame);
  }

  /** Parses otpauth://totp/Label?secret=BASE32&issuer=Name */
  function parseOtpAuth(data: string): string | null {
    try {
      const url = new URL(data);
      if (url.protocol !== "otpauth:") return null;
      const secret = url.searchParams.get("secret");
      return secret ?? null;
    } catch {
      return null;
    }
  }

  return (
    <div className="pm-qr-overlay">
      <div className="pm-qr-modal">
        <div className="pm-qr-header">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <CameraIcon style={{ width: 16, height: 16, color: "var(--accent)" }} />
            <span style={{ fontWeight: 600, fontSize: 14 }}>Scan QR code (2FA)</span>
          </div>
          <button className="pm-icon-btn" onClick={onClose} title="Close">
            <XMarkIcon style={{ width: 16, height: 16 }} />
          </button>
        </div>

        <div className="pm-qr-viewport">
          {error ? (
            <div className="pm-qr-error">{error}</div>
          ) : (
            <>
              <video
                ref={videoRef}
                muted
                playsInline
                style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "var(--r-sm)" }}
              />
              {scanning && (
                <div className="pm-qr-frame">
                  <div className="pm-qr-corner tl" />
                  <div className="pm-qr-corner tr" />
                  <div className="pm-qr-corner bl" />
                  <div className="pm-qr-corner br" />
                </div>
              )}
            </>
          )}
          <canvas ref={canvasRef} style={{ display: "none" }} />
        </div>

        <p style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center", padding: "0 16px 16px" }}>
          Point the camera at the QR code from your 2FA app (Google Authenticator, Authy, etc.)
        </p>
      </div>
    </div>
  );
}
