import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ImagePlus, Loader2, X } from 'lucide-react';

const MAX_FILES = 5;
const MAX_BYTES = 1024 * 1024;

/** Shrinks a photo (longest side 1280 px, JPEG) so it fits in on-device storage. */
function shrink(f: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(f);
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, 1280 / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('bad image')); };
    img.src = url;
  });
}

/** Up to 5 optional photos, each under 1 MB. The first one is the cover. */
export function ImagePicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [errs, setErrs] = useState<string[]>([]);
  const [view, setView] = useState<string | null>(null);
  const take = async (files: FileList | null) => {
    if (!files?.length) return;
    const e: string[] = [];
    const out = [...value];
    setBusy(true);
    for (const f of Array.from(files)) {
      if (out.length >= MAX_FILES) { e.push(`Only ${MAX_FILES} photos allowed — “${f.name}” and later ones were skipped`); break; }
      if (!f.type.startsWith('image/')) { e.push(`“${f.name}” is not a photo`); continue; }
      if (f.size > MAX_BYTES) { e.push(`“${f.name}” is ${(f.size / MAX_BYTES).toFixed(1)} MB — each photo must be under 1 MB`); continue; }
      try { out.push(await shrink(f)); } catch { e.push(`“${f.name}” could not be read`); }
    }
    setBusy(false);
    setErrs(e);
    onChange(out);
  };
  return (
    <div className="stack-sm">
      <div className="photo-grid">
        {value.map((src, i) => (
          <div key={i} className="photo-th">
            <button type="button" className="photo-img" aria-label={`View photo ${i + 1}`} onClick={() => setView(src)}><img src={src} alt={`Photo ${i + 1}`} /></button>
            {i === 0 && <span className="photo-cover">Cover</span>}
            <button type="button" className="photo-x" aria-label={`Remove photo ${i + 1}`} onClick={() => onChange(value.filter((_, j) => j !== i))}><X size={13} /></button>
          </div>
        ))}
        {value.length < MAX_FILES && (
          <button type="button" className="photo-add" onClick={() => input.current?.click()} disabled={busy}>
            {busy ? <Loader2 size={20} className="spinner" /> : <ImagePlus size={20} />}<span className="xs">{busy ? 'Adding…' : 'Add photo'}</span>
          </button>
        )}
      </div>
      <span className="xs muted">{value.length} of {MAX_FILES} · each under 1 MB · first photo is the cover</span>
      {errs.map((x) => <span key={x} className="field-error" role="alert">{x}</span>)}
      <input ref={input} type="file" accept="image/*" multiple hidden aria-label="Choose photos" onChange={(e) => { take(e.target.files); e.target.value = ''; }} />
      {view && createPortal(<div className="photo-view" onClick={() => setView(null)} role="dialog" aria-label="Photo"><img src={view} alt="" /><button type="button" className="photo-x lg" aria-label="Close photo"><X size={18} /></button></div>, document.getElementById('app-frame') ?? document.body)}
    </div>
  );
}

/** Read-only strip of an asset's photos (tap to enlarge). */
export function PhotoStrip({ photos }: { photos: string[] }) {
  const [view, setView] = useState<string | null>(null);
  return (
    <>
      <div className="photo-strip">{photos.map((src, i) => <button key={i} type="button" className="photo-img" aria-label={`Open photo ${i + 1}`} onClick={() => setView(src)}><img src={src} alt={`Photo ${i + 1}`} /></button>)}</div>
      {view && createPortal(<div className="photo-view" onClick={() => setView(null)} role="dialog" aria-label="Photo"><img src={view} alt="" /><button type="button" className="photo-x lg" aria-label="Close photo"><X size={18} /></button></div>, document.getElementById('app-frame') ?? document.body)}
    </>
  );
}
