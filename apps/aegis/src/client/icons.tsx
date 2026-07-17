import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Icon({ size = 18, children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {children}
    </svg>
  );
}

export const ShieldIcon = (props: IconProps) => (
  <Icon {...props}><path d="M12 3 20 6v5c0 5.1-3.4 8.4-8 10-4.6-1.6-8-4.9-8-10V6l8-3Z" /><path d="m8.5 12 2.2 2.2 4.9-5" /></Icon>
);
export const PlayIcon = (props: IconProps) => (
  <Icon {...props}><path d="m8 5 11 7-11 7V5Z" /></Icon>
);
export const RadioIcon = (props: IconProps) => (
  <Icon {...props}><circle cx="12" cy="12" r="2" /><path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M4.9 4.9a10 10 0 0 0 0 14.2M19.1 4.9a10 10 0 0 1 0 14.2" /></Icon>
);
export const BoltIcon = (props: IconProps) => (
  <Icon {...props}><path d="m13 2-9 12h7l-1 8 9-12h-7l1-8Z" /></Icon>
);
export const EyeIcon = (props: IconProps) => (
  <Icon {...props}><path d="M2.5 12s3.4-6 9.5-6 9.5 6 9.5 6-3.4 6-9.5 6-9.5-6-9.5-6Z" /><circle cx="12" cy="12" r="2.5" /></Icon>
);
export const CloseIcon = (props: IconProps) => (
  <Icon {...props}><path d="m6 6 12 12M18 6 6 18" /></Icon>
);
export const ChevronIcon = (props: IconProps) => (
  <Icon {...props}><path d="m9 18 6-6-6-6" /></Icon>
);
export const CheckIcon = (props: IconProps) => (
  <Icon {...props}><path d="m5 12 4 4L19 6" /></Icon>
);
export const LockIcon = (props: IconProps) => (
  <Icon {...props}><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></Icon>
);
export const BranchIcon = (props: IconProps) => (
  <Icon {...props}><circle cx="6" cy="5" r="2" /><circle cx="18" cy="6" r="2" /><circle cx="6" cy="19" r="2" /><path d="M6 7v10M8 12h4a6 6 0 0 0 6-4" /></Icon>
);
export const FlaskIcon = (props: IconProps) => (
  <Icon {...props}><path d="M9 3h6M10 3v6l-6 9a2 2 0 0 0 1.7 3h12.6a2 2 0 0 0 1.7-3l-6-9V3" /><path d="M7.5 15h9" /></Icon>
);
export const ArrowIcon = (props: IconProps) => (
  <Icon {...props}><path d="M5 12h14M14 7l5 5-5 5" /></Icon>
);
export const SparkIcon = (props: IconProps) => (
  <Icon {...props}><path d="m12 2 1.5 5.5L19 9l-5.5 1.5L12 16l-1.5-5.5L5 9l5.5-1.5L12 2Z" /><path d="m19 16 .7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7L19 16Z" /></Icon>
);
export const ArchiveIcon = (props: IconProps) => (
  <Icon {...props}><rect x="3" y="4" width="18" height="5" rx="1" /><path d="M5 9v11h14V9M9 13h6" /></Icon>
);
