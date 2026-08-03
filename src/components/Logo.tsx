import React from 'react';
import { MessageCircle } from 'lucide-react';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'full' | 'icon' | 'image';
  showSubtext?: boolean;
}

export const Logo: React.FC<LogoProps> = ({ 
  className = '', 
  size = 'md', 
  showSubtext = false 
}) => {
  const whatsappUrl = `https://wa.me/523951347469?text=${encodeURIComponent('Hola, necesito ayuda')}`;

  const supportButton = (
    <a
      href={whatsappUrl}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="inline-flex items-center gap-1.5 text-[10px] sm:text-xs font-black uppercase tracking-wide text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/90 px-2.5 py-1 rounded-full transition shadow-2xs hover:scale-105 active:scale-95 cursor-pointer font-sans shrink-0"
      title="Chat con Soporte en WhatsApp"
    >
      <MessageCircle className="w-3.5 h-3.5 text-emerald-600 fill-emerald-100 shrink-0" />
      <span>chat con soporte</span>
    </a>
  );

  const imgSizeClasses = {
    sm: 'h-8 w-auto',
    md: 'h-10 w-auto',
    lg: 'h-14 w-auto',
    xl: 'h-20 w-auto'
  };

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <img 
        src="/logov2.jpg" 
        alt="Mesa 22 Logo" 
        className={`${imgSizeClasses[size]} object-contain rounded-xl`} 
        referrerPolicy="no-referrer"
      />
      {showSubtext && supportButton}
    </div>
  );
};

export default Logo;

