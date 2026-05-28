import { cn } from "@/utils/cn";

export default function NinetyLogo({ className }: { className?: string }) {
  return (
    <div className={cn("inline-flex items-stretch border-2 border-[#0A0A0A] text-[#0A0A0A]", className)}>
      <div className="ninety-display flex items-center bg-[#F4EFE4] px-10 py-7 text-[18px] leading-none">
        THE
      </div>
      <div className="ninety-display flex items-center border-l-2 border-[#0A0A0A] bg-[#FFD100] px-12 py-7 text-[34px] leading-none">
        90
      </div>
    </div>
  );
}
