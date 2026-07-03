import { ImageResponse } from "next/og";

// the card that shows up when the link is shared, in the same navy as the app header
export const alt = "CarVerdict";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          backgroundColor: "#1e3a5f",
          color: "#fff",
        }}
      >
        <div style={{ width: 90, height: 6, backgroundColor: "#c8890f", marginBottom: 28 }} />
        <div style={{ fontSize: 96, fontWeight: 700 }}>CarVerdict</div>
        <div style={{ fontSize: 40, color: "rgba(255,255,255,0.85)", marginTop: 20 }}>
          What owners actually complain about, from real NHTSA records.
        </div>
      </div>
    ),
    { ...size }
  );
}
