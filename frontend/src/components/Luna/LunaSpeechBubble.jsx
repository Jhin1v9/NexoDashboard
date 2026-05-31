/**
 * 🌙 Luna Mascot — Balão de Fala
 * Estilo HQ, posicionado absoluto acima da Luna
 */

import React, { useEffect, useState } from "react";
import { useLunaStore } from "../../stores/lunaStore";

export default function LunaSpeechBubble() {
  const message = useLunaStore((s) => s.message);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (message) {
      setVisible(true);
    } else {
      setVisible(false);
    }
  }, [message]);

  if (!visible || !message) return null;

  return (
    <div
      className="luna-speech-bubble"
      style={{
        position: "absolute",
        bottom: "100%",
        left: "50%",
        transform: "translateX(-50%)",
        marginBottom: "12px",
        background: "linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)",
        color: "#fff",
        padding: "10px 16px",
        borderRadius: "16px",
        borderBottomLeftRadius: "4px",
        fontSize: "13px",
        fontWeight: 500,
        maxWidth: "220px",
        minWidth: "120px",
        textAlign: "center",
        lineHeight: 1.4,
        boxShadow: "0 4px 20px rgba(124, 58, 237, 0.35), 0 2px 8px rgba(0,0,0,0.15)",
        pointerEvents: "none",
        zIndex: 9999,
        animation: "lunaBubbleIn 0.3s ease-out",
        wordWrap: "break-word",
        fontFamily: "'Segoe UI', system-ui, sans-serif",
        letterSpacing: "0.2px",
      }}
      aria-live="polite"
      aria-atomic="true"
    >
      {message}
      {/* Pontinha do balão */}
      <span
        style={{
          position: "absolute",
          bottom: "-6px",
          left: "16px",
          width: 0,
          height: 0,
          borderLeft: "6px solid transparent",
          borderRight: "6px solid transparent",
          borderTop: "8px solid #a855f7",
        }}
      />
    </div>
  );
}
