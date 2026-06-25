import Image from "next/image";

type BrandLogoProps = {
  size?: number;
  className?: string;
  priority?: boolean;
};

export function BrandLogo({ size = 40, className = "", priority = false }: BrandLogoProps) {
  return (
    <Image
      src="/brand/flexpulse-logo.png"
      alt=""
      width={size}
      height={size}
      priority={priority}
      className={`brand-logo${className ? ` ${className}` : ""}`}
      aria-hidden
    />
  );
}
