import React from "react";

export function SimulationBadge() {
  return (
    <div style={{
      position: "fixed",
      top: 16,
      right: 16,
      padding: "8px 16px",
      background: "#ff4d4d",
      color: "white",
      borderRadius: "6px",
      fontSize: "12px",
      fontWeight: "bold",
      boxShadow: "0 4px 12px rgba(0, 0, 0, 0.4)",
      border: "1px solid rgba(255, 255, 255, 0.2)",
      zIndex: 9999,
      pointerEvents: "none",
      display: "flex",
      alignItems: "center",
      gap: "6px"
    }}>
      <span>⚠️</span>
      <span>SIMULATED DATA (Demo Mode)</span>
    </div>
  );
}
