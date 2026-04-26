import { ImageResponse } from "next/og";

export const size = { width: 192, height: 192 };
export const contentType = "image/png";

export default function Icon() {
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
            width: 92,
            height: 92,
            borderRadius: "50%",
            background:
              "radial-gradient(circle at 32% 30%, #a5b4fc 0%, #6366f1 50%, #4338ca 100%)",
            boxShadow: "0 0 0 6px rgba(99, 102, 241, 0.18)",
          }}
        />
      </div>
    ),
    { ...size },
  );
}
