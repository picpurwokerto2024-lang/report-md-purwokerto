import { useState } from 'react';

interface BtbLogoProps {
  className?: string;
  logoUrl?: string;
  logoText?: string;
  logoTextColor?: string;
}

function getLogoTextShadowClass(hexColor: string): string {
  const clean = hexColor.replace('#', '');
  if (clean.length === 6) {
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    if (brightness > 165) {
      return 'drop-shadow-[0_1.5px_0_#1E3A8A]';
    }
  }
  return 'drop-shadow-[0_1px_1px_rgba(15,23,42,0.16)]';
}

export default function BtbLogo({
  className = 'h-10',
  logoUrl,
  logoText = 'BTB',
  logoTextColor = '#eab308',
}: BtbLogoProps) {
  const [imageError, setImageError] = useState(false);
  const resolvedColor =
    logoTextColor && /^#[0-9a-fA-F]{6}$/.test(logoTextColor.trim())
      ? logoTextColor.trim()
      : '#EAB308';
  const shadowClass = getLogoTextShadowClass(resolvedColor);

  // If custom logo URL is provided and has not errored
  if (logoUrl && !imageError) {
    return (
      <div className={`flex items-center gap-1.5 sm:gap-2 select-none shrink-0 ${className}`}>
        <img
          src={logoUrl}
          alt={logoText || 'Logo Perusahaan'}
          className="h-full w-auto max-w-[96px] sm:max-w-[130px] object-contain drop-shadow-sm"
          referrerPolicy="no-referrer"
          onError={() => setImageError(true)}
        />
        {logoText && logoText !== 'BTB' && (
          <span
            style={{ color: resolvedColor }}
            className={`font-extrabold text-lg sm:text-xl md:text-2xl tracking-tight font-sans transition-colors ${shadowClass}`}
          >
            {logoText}
          </span>
        )}
      </div>
    );
  }

  // Default Mascot Bee + BTB Branding
  return (
    <div className={`flex items-center gap-1.5 sm:gap-2 select-none shrink-0 ${className}`}>
      {/* Bee Mascot SVG */}
      <svg
        viewBox="0 0 100 90"
        className="h-full w-auto drop-shadow-sm shrink-0"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Wings */}
        <ellipse
          cx="40"
          cy="26"
          rx="18"
          ry="12"
          transform="rotate(-30 40 26)"
          fill="#BAE6FD"
          fillOpacity="0.85"
          stroke="#0284C7"
          strokeWidth="2.5"
        />
        <ellipse
          cx="58"
          cy="24"
          rx="16"
          ry="11"
          transform="rotate(25 58 24)"
          fill="#E0F2FE"
          fillOpacity="0.85"
          stroke="#0284C7"
          strokeWidth="2.5"
        />

        {/* Antennae */}
        <path
          d="M38 34 Q30 20 24 22"
          stroke="#1E293B"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <circle cx="23" cy="22" r="3" fill="#1E293B" />
        <path
          d="M48 33 Q50 18 56 19"
          stroke="#1E293B"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <circle cx="57" cy="19" r="3" fill="#1E293B" />

        {/* Bee Body */}
        <ellipse
          cx="46"
          cy="52"
          rx="24"
          ry="26"
          fill="#FACC15"
          stroke="#1E293B"
          strokeWidth="3"
        />

        {/* Stripes */}
        <path
          d="M24 46 Q46 51 68 46"
          stroke="#1E293B"
          strokeWidth="4.5"
          strokeLinecap="round"
        />
        <path
          d="M26 58 Q46 63 66 58"
          stroke="#1E293B"
          strokeWidth="4.5"
          strokeLinecap="round"
        />
        <path
          d="M32 69 Q46 73 60 69"
          stroke="#1E293B"
          strokeWidth="4"
          strokeLinecap="round"
        />

        {/* Stinger */}
        <path
          d="M21 54 L12 52 L22 48 Z"
          fill="#1E293B"
        />

        {/* Face */}
        <circle cx="56" cy="42" r="3.5" fill="#1E293B" />
        <circle cx="58" cy="40.5" r="1.2" fill="#FFFFFF" />
        <path
          d="M50 49 Q55 54 60 49"
          stroke="#1E293B"
          strokeWidth="2.2"
          strokeLinecap="round"
        />

        {/* Rosy Cheek */}
        <ellipse cx="62" cy="47" rx="3" ry="2" fill="#F472B6" fillOpacity="0.6" />
      </svg>

      {/* BTB / Custom Brand Typography */}
      <span
        style={{ color: resolvedColor }}
        className={`font-extrabold text-xl sm:text-2xl md:text-3xl tracking-tight font-sans transition-colors ${shadowClass}`}
      >
        {logoText || 'BTB'}
      </span>
    </div>
  );
}
