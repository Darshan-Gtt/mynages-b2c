import qrcode from 'qrcode-generator';
import { useMemo } from 'react';

/** Real, scannable QR code (asset ID / asset URL). */
export function QrCode({ value, size = 120, label }: { value: string; size?: number; label?: string }) {
  const { path, n } = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(value);
    qr.make();
    const count = qr.getModuleCount();
    let p = '';
    for (let r = 0; r < count; r++) for (let c = 0; c < count; c++) if (qr.isDark(r, c)) p += `M${c},${r}h1v1h-1z`;
    return { path: p, n: count };
  }, [value]);
  return (
    <svg width={size} height={size} viewBox={`-2 -2 ${n + 4} ${n + 4}`} role="img" aria-label={label ?? `QR code for ${value}`} style={{ background: '#fff', borderRadius: 4 }} shapeRendering="crispEdges">
      <path d={path} fill="#0F2D3D" />
    </svg>
  );
}

/** Code-128-style barcode look for labels (visual; the QR carries the scannable data). */
export function Barcode({ value, height = 34 }: { value: string; height?: number }) {
  const bars = useMemo(() => {
    let h = 7;
    const out: number[] = [];
    for (const ch of value + value.split('').reverse().join('')) {
      h = (h * 31 + ch.charCodeAt(0)) % 997;
      out.push(1 + (h % 3), 1 + ((h >> 2) % 2));
    }
    return out;
  }, [value]);
  let x = 0;
  const rects: JSX.Element[] = [];
  bars.forEach((w, i) => { if (i % 2 === 0) rects.push(<rect key={i} x={x} y={0} width={w} height={height} />); x += w; });
  return <svg viewBox={`0 0 ${x} ${height}`} width="100%" height={height} preserveAspectRatio="none" aria-hidden="true"><g fill="#0F2D3D">{rects}</g></svg>;
}
