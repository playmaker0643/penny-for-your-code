const logoAsset = { url: "/codebreakers-logo.jpg" };

export default function BrandedLoader({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-10">
      <div className="relative">
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-secondary via-primary to-accent opacity-60 blur-xl animate-pulse" />
        <img
          src={logoAsset.url}
          alt="CodeBreakers"
          className="relative h-20 w-20 rounded-2xl object-cover animate-pulse-neon"
        />
      </div>
      <div className="h-1 w-40 overflow-hidden rounded-full bg-muted">
        <div className="h-full w-1/2 rounded-full bg-gradient-to-r from-secondary via-primary to-accent animate-[loaderSlide_1.2s_ease-in-out_infinite]" />
      </div>
      <p className="text-xs font-mono text-muted-foreground">{label}</p>
      <style>{`
        @keyframes loaderSlide {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
      `}</style>
    </div>
  );
}
