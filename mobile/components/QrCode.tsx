import { useMemo } from "react";
import Svg, { Path, Rect } from "react-native-svg";
import QRCode from "qrcode";

// A QR code drawn as one SVG path. Always dark on white: phone cameras read
// that most reliably, whatever the app theme.
export default function QrCode({ value, size }: { value: string; size: number }) {
  const { path, total } = useMemo(() => {
    const { modules } = QRCode.create(value, { errorCorrectionLevel: "M" });
    const quiet = 2; // blank border scanners need around the code
    let d = "";
    for (let y = 0; y < modules.size; y++) {
      for (let x = 0; x < modules.size; x++) {
        if (modules.get(x, y)) d += `M${x + quiet} ${y + quiet}h1v1h-1z`;
      }
    }
    return { path: d, total: modules.size + quiet * 2 };
  }, [value]);

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${total} ${total}`}>
      <Rect width={total} height={total} fill="#FFFFFF" />
      <Path d={path} fill="#000000" />
    </Svg>
  );
}
