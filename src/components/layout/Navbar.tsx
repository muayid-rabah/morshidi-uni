import React from 'react';
import { Menu } from 'lucide-react';

interface NavbarProps {
  onToggleSidebar: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onToggleSidebar }) => {
  return (
    <header className="sticky top-0 z-30 h-[70px] border-b border-[#252a2d] bg-[#151718]">
      <div className="mx-auto flex h-full max-w-[1920px] items-center justify-center px-5">
        <button onClick={onToggleSidebar} className="rounded-lg p-2 text-[#e8ddce] hover:bg-[#252a2d]" aria-label="فتح القائمة">
          <Menu className="h-7 w-7" />
        </button>
      </div>
    </header>
  );
};
