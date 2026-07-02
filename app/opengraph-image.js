import { ImageResponse } from "next/og";

// the card that shows up when the link is shared, in the same dark colors as the app
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
          backgroundColor: "#0f1115",
          color: "#e8e8e8",
        }}
      >
        <div style={{ fontSize: 96, fontWeight: 700 }}>CarVerdict</div>
        <div style={{ fontSize: 40, color: "#9aa0a6", marginTop: 20 }}>
          What owners actually complain about, from real NHTSA records.
        </div>
      </div>
    ),
    { ...size }
  );
}
