import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/**
 * iOS apple-touch-icon. iOS clips touch icons to a rounded square automatically,
 * so the design needs to fill more of the canvas than the Android variant
 * (Android adds its own circular mask via maskable_purpose, which we treat
 * conservatively here).
 */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background:
            "radial-gradient(circle at 28% 22%, #fff7e6 0%, #f3efe5 38%, #ddd2bd 100%)",
        }}
      >
        <div
          style={{
            width: 102,
            height: 102,
            borderRadius: "50%",
            background:
              "radial-gradient(circle at 32% 30%, #a5b4fc 0%, #6366f1 50%, #4338ca 100%)",
            boxShadow: "0 0 0 7px rgba(99, 102, 241, 0.18)",
          }}
        />
      </div>
    ),
    { ...size },
  );
}
