import { Link } from "react-router-dom";

const Logo = ({ className = "" }: { className?: string }) => (
  <Link to="/" className={`flex items-center gap-1 ${className}`}>
    <span className="text-3xl font-mono text-primary font-bold">&lt;/&gt;</span>
    <span className="text-lg font-bold font-display text-foreground">
      Code<span className="text-primary">Breakers</span>
    </span>
  </Link>
);

export default Logo;
