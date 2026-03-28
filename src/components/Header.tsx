interface HeaderProps {
  className?: string;
}

export default function Header({ className }: HeaderProps) {
  return (
    <header className={`absolute top-0 left-0 right-0 z-10 p-6 ${className ?? ""}`}>
      <div className="flex justify-between items-center">
        <div className="text-white text-sm uppercase tracking-wide">lumino</div>
        <nav className="flex gap-8">
          <a
            href="#about"
            className="text-white hover:text-neutral-400 transition-colors duration-300 uppercase text-sm"
          >
            О нас
          </a>
          <a
            href="#contact"
            className="text-white hover:text-neutral-400 transition-colors duration-300 uppercase text-sm"
          >
            Контакты
          </a>
        </nav>
      </div>
    </header>
  );
}
