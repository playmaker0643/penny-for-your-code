import { Link } from "react-router-dom";
const logoAsset = { url: "/codebreakers-logo.jpg" };

const Logo = ({ className = "", showText = true }: { className?: string; showText?: boolean }) => (
  <Link to="/" className={`flex items-center gap-2 ${className}`}>
    <img
      src={logoAsset.url}
      alt="CodeBreakers"
      width={36}
      height={36}
      decoding="async"
      fetchPriority="high"
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
