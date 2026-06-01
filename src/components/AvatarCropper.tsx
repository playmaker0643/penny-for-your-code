import { useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface Props {
  src: string;
  onCancel: () => void;
  onConfirm: (blob: Blob) => void;
}

const SIZE = 280;

const AvatarCropper = ({ src, onCancel, onConfirm }: Props) => {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [imgDim, setImgDim] = useState({ w: 0, h: 0 });
  const dragRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = src;
    img.onload = () => {
      const ratio = SIZE / Math.min(img.width, img.height);
      setImgDim({ w: img.width * ratio, h: img.height * ratio });
      setScale(1);
      setPos({ x: 0, y: 0 });
      imgRef.current = img;
    };
  }, [src]);

  const confirm = () => {
    const img = imgRef.current;
    if (!img) return;
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d")!;
    const scaledW = imgDim.w * scale;
    const scaledH = imgDim.h * scale;
    const dx = (SIZE - scaledW) / 2 + pos.x;
    const dy = (SIZE - scaledH) / 2 + pos.y;
    // Source crop relative to original image
    const srcScale = img.width / imgDim.w / scale;
    const sx = -dx * srcScale;
    const sy = -dy * srcScale;
    const sSize = SIZE * srcScale;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, 512, 512);
    ctx.drawImage(img, sx, sy, sSize, sSize, 0, 0, 512, 512);
    canvas.toBlob((blob) => { if (blob) onConfirm(blob); }, "image/jpeg", 0.92);
  };

  return (
    <div className="fixed inset-0 z-[200] bg-background flex flex-col">
      <header className="h-14 bg-card border-b border-border/50 flex items-center justify-between px-4">
        <button onClick={onCancel} className="text-muted-foreground"><X className="h-5 w-5" /></button>
        <p className="text-sm font-bold font-display">Crop 1:1</p>
        <Button size="sm" onClick={confirm} className="bg-primary text-primary-foreground">Done</Button>
      </header>
      <div className="flex-1 flex items-center justify-center p-4">
        <div
          className="relative bg-black overflow-hidden"
          style={{ width: SIZE, height: SIZE, borderRadius: "50%" }}
          onTouchStart={(e) => { dragRef.current = { x: e.touches[0].clientX - pos.x, y: e.touches[0].clientY - pos.y }; }}
          onTouchMove={(e) => {
            if (!dragRef.current) return;
            setPos({ x: e.touches[0].clientX - dragRef.current.x, y: e.touches[0].clientY - dragRef.current.y });
          }}
          onTouchEnd={() => { dragRef.current = null; }}
          onMouseDown={(e) => { dragRef.current = { x: e.clientX - pos.x, y: e.clientY - pos.y }; }}
          onMouseMove={(e) => {
            if (!dragRef.current) return;
            setPos({ x: e.clientX - dragRef.current.x, y: e.clientY - dragRef.current.y });
          }}
          onMouseUp={() => { dragRef.current = null; }}
          onMouseLeave={() => { dragRef.current = null; }}
        >
          <img
            src={src}
            alt="crop"
            draggable={false}
            style={{
              width: imgDim.w * scale,
              height: imgDim.h * scale,
              position: "absolute",
              left: (SIZE - imgDim.w * scale) / 2 + pos.x,
              top: (SIZE - imgDim.h * scale) / 2 + pos.y,
              userSelect: "none",
            }}
          />
        </div>
      </div>
      <div className="p-4 bg-card border-t border-border/50">
        <label className="text-xs text-muted-foreground font-mono block mb-1">Zoom</label>
        <input type="range" min="1" max="3" step="0.05" value={scale} onChange={(e) => setScale(Number(e.target.value))} className="w-full" />
        <p className="text-[10px] text-muted-foreground text-center mt-2">Drag to position • Pinch unsupported, use zoom slider</p>
      </div>
    </div>
  );
};

export default AvatarCropper;
