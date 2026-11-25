import React from 'react';

interface SolariLogoProps {
  dark?: boolean;
  label?: string;
}

export const SolariLogo: React.FC<SolariLogoProps> = ({
  dark = false,
  label = 'Emmystylez Solar Electrical Store',
}) => {
  return (
    <div className="inline-flex items-center select-none whitespace-nowrap shrink-0">
      <span
        className={`text-[15px] sm:text-[17px] font-extrabold tracking-tight leading-none ${
          dark ? 'text-white' : 'text-[#151916]'
        }`}
      >
        {label}
      </span>
    </div>
  );
};
