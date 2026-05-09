export default function Footer() {
  return (
    <footer className="border-t border-border mt-auto py-6">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 text-center text-sm text-muted-foreground flex flex-col md:flex-row items-center justify-between gap-3">
        <p className="font-medium">© {new Date().getFullYear()} AnyDL</p>
        <p className="text-xs text-muted-foreground/60">
          Built with FastAPI + React. Not affiliated with YouTube.
        </p>
      </div>
    </footer>
  );
}
