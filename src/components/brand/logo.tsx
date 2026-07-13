import Image from "next/image";
import lightBg from "../../../public/brand/biteexpress_logo_light_bg.png";
import darkBg from "../../../public/brand/biteexpress_logo_dark_bg.png";

const RATIO = 6273 / 2276; // intrinsic aspect of the wordmark

interface LogoProps {
  /** "light" = the wordmark made for light backgrounds (canvas);
   *  "dark"  = the variant for dark surfaces (code card, auth hero). */
  variant?: "light" | "dark";
  height?: number;
  className?: string;
  priority?: boolean;
}

export function Logo({
  variant = "light",
  height = 32,
  className,
  priority = false,
}: LogoProps) {
  return (
    <Image
      src={variant === "light" ? lightBg : darkBg}
      alt="BiteExpress"
      height={height}
      width={Math.round(height * RATIO)}
      priority={priority}
      className={className}
    />
  );
}
