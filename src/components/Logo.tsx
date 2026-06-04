import { Link } from "react-router-dom";
import logoAsset from "@/assets/codebreakers-logo.jpg.asset.json";

const Logo = ({ className = "", showText = true }: { className?: string; showText?: boolean }) => (
  <Link to="/" className={`flex items-center gap-2 ${className}`}>
    <img
      src={logoAsset.url}
      alt="CodeBreakers"
      className="h-9 w-9 rounded-lg object-cover shadow-[0_0_18px_hsl(var(--primary)/0.45)]"
    />
    {showText && (
      <span className="text-lg font-bold font-display text-foreground">
        Code<span className="text-primary">Breakers</span>
      </span>
    )}
  </Link>
);

export default Logo;
