import { useState, useRef, useEffect } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const EMOJI_CATEGORIES: Record<string, string[]> = {
  "😀 Smileys": ["😀","😁","😂","🤣","😃","😄","😅","😆","😉","😊","😋","😎","😍","🥰","😘","🙂","🤗","🤩","🤔","😐","😏","😒","😔","😢","😭","😡","🤬","🥺","😇","🥳","🥱","😈","💀","🤡","👻","👽","🤖"],
  "👋 Gestures": ["👋","🤚","✋","🖖","👌","✌️","🤞","🤟","🤘","🤙","👈","👉","👆","👇","☝️","👍","👎","✊","👊","👏","🙌","🙏","💪"],
  "❤️ Hearts": ["❤️","🧡","💛","💚","💙","💜","🖤","🤍","💔","❣️","💕","💞","💓","💖","💘","💝"],
  "🐱 Animals": ["🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼","🐨","🐯","🦁","🐮","🐷","🐸","🐵","🐔","🐧","🦅","🦉","🐺","🦄","🐝","🦋","🐢","🐍","🦖","🐳","🦈","🐊"],
  "🍕 Food": ["🍏","🍎","🍌","🍉","🍇","🍓","🍒","🍑","🥭","🍍","🥑","🌶️","🌽","🥕","🍄","🥨","🍞","🧀","🥚","🍔","🍟","🍕","🌭","🌮","🌯","🥗","🍣","🍜","🍦","🍩","🍪","🎂","☕"],
  "⚽ Activities": ["⚽","🏀","🏈","⚾","🎾","🏐","🏉","🎱","🏓","🏸","🥊","🎮","🎲","🎯","🎳","🏆","🥇","🎉","🎁","🎈"],
  "💻 Tech": ["💻","🖥️","⌨️","🖱️","💾","💿","📱","☎️","📺","📷","🎥","🎙️","💡","🔋","🔑","🔐","📡","🛰️","🚀"],
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelectEmoji: (emoji: string) => void;
  onSelectSticker: (stickerUrl: string) => void;
}

const DEFAULT_STICKERS = [
  "https://twemoji.maxcdn.com/v/14.0.2/72x72/1f680.png",
  "https://twemoji.maxcdn.com/v/14.0.2/72x72/1f389.png",
  "https://twemoji.maxcdn.com/v/14.0.2/72x72/1f525.png",
  "https://twemoji.maxcdn.com/v/14.0.2/72x72/1f4af.png",
  "https://twemoji.maxcdn.com/v/14.0.2/72x72/1f44d.png",
  "https://twemoji.maxcdn.com/v/14.0.2/72x72/1f44f.png",
  "https://twemoji.maxcdn.com/v/14.0.2/72x72/1f60d.png",
  "https://twemoji.maxcdn.com/v/14.0.2/72x72/1f923.png",
  "https://twemoji.maxcdn.com/v/14.0.2/72x72/1f64f.png",
  "https://twemoji.maxcdn.com/v/14.0.2/72x72/1f4aa.png",
  "https://twemoji.maxcdn.com/v/14.0.2/72x72/1f9e0.png",
  "https://twemoji.maxcdn.com/v/14.0.2/72x72/1f4bb.png",
];

const renderEmoji3D = (emoji: string) => {
  // Twemoji CDN converts emoji char -> code point
  const code = Array.from(emoji).map(c => c.codePointAt(0)?.toString(16)).filter(Boolean).join("-");
  return `https://twemoji.maxcdn.com/v/14.0.2/72x72/${code}.png`;
};

const EmojiPicker = ({ isOpen, onClose, onSelectEmoji, onSelectSticker }: Props) => {
  const { user } = useAuth();
  const [tab, setTab] = useState<"emoji" | "stickers">("emoji");
  const [activeCategory, setActiveCategory] = useState(Object.keys(EMOJI_CATEGORIES)[0]);
  const [userStickers, setUserStickers] = useState<{ id: string; url: string }[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadStickers = async () => {
    if (!user) return;
    const { data } = await supabase.from("stickers").select("id, url").eq("user_id", user.id).order("created_at", { ascending: false });
    setUserStickers(data || []);
  };

  useEffect(() => { if (isOpen && tab === "stickers") loadStickers(); }, [isOpen, tab, user]);

  const uploadSticker = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 2 * 1024 * 1024) { toast.error("Sticker must be < 2MB"); return; }
    const ext = file.name.split(".").pop();
    const path = `${user.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("stickers").upload(path, file);
    if (error) { toast.error("Upload failed"); return; }
    const { data: pub } = supabase.storage.from("stickers").getPublicUrl(path);
    await supabase.from("stickers").insert({ user_id: user.id, url: pub.publicUrl });
    toast.success("Sticker added!");
    loadStickers();
  };

  const deleteSticker = async (id: string) => {
    await supabase.from("stickers").delete().eq("id", id);
    loadStickers();
  };

  if (!isOpen) return null;

  return (
    <div className="bg-card border-t border-border/50 max-h-[45vh] flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/30">
        <div className="flex gap-2">
          <button onClick={() => setTab("emoji")} className={`text-xs font-mono px-3 py-1 rounded-full ${tab === "emoji" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>Emoji</button>
          <button onClick={() => setTab("stickers")} className={`text-xs font-mono px-3 py-1 rounded-full ${tab === "stickers" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>Stickers</button>
        </div>
        <button onClick={onClose} className="p-1 text-muted-foreground"><X className="h-4 w-4" /></button>
      </div>

      {tab === "emoji" ? (
        <>
          <div className="flex gap-1 px-2 py-1 overflow-x-auto border-b border-border/20">
            {Object.keys(EMOJI_CATEGORIES).map((cat) => (
              <button key={cat} onClick={() => setActiveCategory(cat)} className={`text-base px-2 py-0.5 rounded whitespace-nowrap ${activeCategory === cat ? "bg-primary/20" : ""}`}>
                {cat.split(" ")[0]}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            <div className="grid grid-cols-8 gap-1">
              {EMOJI_CATEGORIES[activeCategory]?.map((emoji, i) => (
                <button key={i} onClick={() => onSelectEmoji(emoji)} className="p-1 hover:bg-muted rounded transition-colors flex items-center justify-center">
                  <img src={renderEmoji3D(emoji)} alt={emoji} className="w-7 h-7" loading="lazy" onError={(e) => { (e.target as HTMLImageElement).replaceWith(document.createTextNode(emoji)); }} />
                </button>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="flex-1 overflow-y-auto p-3">
          <div className="flex justify-between items-center mb-2">
            <p className="text-xs font-mono text-muted-foreground">Tap a sticker to send</p>
            <button onClick={() => fileRef.current?.click()} className="flex items-center gap-1 text-xs text-primary font-mono bg-primary/10 px-2 py-1 rounded">
              <Plus className="h-3 w-3" /> Create
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={uploadSticker} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            {userStickers.map((s) => (
              <div key={s.id} className="relative group" style={{ width: "calc(33vw - 16px)", height: "calc(33vw - 16px)", maxWidth: 140, maxHeight: 140 }}>
                <button onClick={() => onSelectSticker(s.url)} className="w-full h-full bg-muted/30 rounded-xl overflow-hidden flex items-center justify-center">
                  <img src={s.url} alt="sticker" className="w-full h-full object-contain" />
                </button>
                <button onClick={() => deleteSticker(s.id)} className="absolute top-1 right-1 p-1 bg-destructive/80 rounded-full opacity-0 group-hover:opacity-100">
                  <Trash2 className="h-2.5 w-2.5 text-white" />
                </button>
              </div>
            ))}
            {DEFAULT_STICKERS.map((url, i) => (
              <button key={i} onClick={() => onSelectSticker(url)} className="bg-muted/30 rounded-xl flex items-center justify-center" style={{ width: "calc(33vw - 16px)", height: "calc(33vw - 16px)", maxWidth: 140, maxHeight: 140 }}>
                <img src={url} alt="sticker" className="w-3/4 h-3/4 object-contain" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default EmojiPicker;
