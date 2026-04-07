import React, { useState, useRef, useEffect } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

const SWATCHES = [
  // Row 1 — vibrant primaries
  '#6c63ff', '#7c3aed', '#8b5cf6', '#a855f7',
  '#3b82f6', '#2563eb', '#0ea5e9', '#06b6d4',
  // Row 2 — warm tones
  '#ec4899', '#f43f5e', '#ef4444', '#f97316',
  '#f59e0b', '#eab308', '#fbbf24', '#fcd34d',
  // Row 3 — greens & teals
  '#10b981', '#34d399', '#43e97b', '#22c55e',
  '#14b8a6', '#2dd4bf', '#84cc16', '#a3e635',
  // Row 4 — neutrals
  '#1e293b', '#334155', '#64748b', '#94a3b8',
  '#e2e8f0', '#f1f5f9', '#fafafa', '#ffffff',
];

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  label: string;
  description?: string;
}

const ColorPicker: React.FC<ColorPickerProps> = ({ value, onChange, label, description }) => {
  const [hexInput, setHexInput] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setHexInput(value);
  }, [value]);

  const isValidHex = (hex: string) => /^#[0-9A-Fa-f]{6}$/.test(hex);

  const handleHexChange = (raw: string) => {
    let val = raw.startsWith('#') ? raw : `#${raw}`;
    val = val.slice(0, 7);
    setHexInput(val);
    if (isValidHex(val)) {
      onChange(val);
    }
  };

  const handleSwatchClick = (color: string) => {
    setHexInput(color);
    onChange(color);
  };

  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-foreground">{label}</label>
      {description && <p className="mb-2 text-xs text-muted-foreground">{description}</p>}

      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-3 rounded-2xl border border-border bg-card px-3 py-2.5 transition-colors hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <span
              className="h-8 w-8 shrink-0 rounded-xl border border-border"
              style={{ backgroundColor: value }}
            />
            <span className="font-mono text-sm text-muted-foreground">{value}</span>
          </button>
        </PopoverTrigger>

        <PopoverContent
          className="w-[280px] rounded-2xl border border-border bg-card p-4"
          align="start"
          sideOffset={8}
        >
          {/* Swatches grid */}
          <div className="mb-4 grid grid-cols-8 gap-1.5">
            {SWATCHES.map((swatch) => (
              <button
                key={swatch}
                type="button"
                onClick={() => handleSwatchClick(swatch)}
                className={cn(
                  'h-7 w-7 rounded-lg border transition-all hover:scale-110',
                  value.toLowerCase() === swatch.toLowerCase()
                    ? 'border-foreground ring-2 ring-foreground/20'
                    : 'border-border/50'
                )}
                style={{ backgroundColor: swatch }}
                title={swatch}
              />
            ))}
          </div>

          {/* Hex input */}
          <div className="flex items-center gap-2">
            <span
              className="h-9 w-9 shrink-0 rounded-xl border border-border"
              style={{ backgroundColor: isValidHex(hexInput) ? hexInput : value }}
            />
            <input
              ref={inputRef}
              type="text"
              value={hexInput}
              onChange={(e) => handleHexChange(e.target.value)}
              maxLength={7}
              placeholder="#000000"
              className="h-9 w-full rounded-xl border border-border bg-background px-3 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default ColorPicker;
