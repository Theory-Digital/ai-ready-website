import { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, CheckCircle2 } from "lucide-react";

import { Connector } from "@/components/shared/layout/curvy-rect";
import { HeaderProvider } from "@/components/shared/header/HeaderContext";
import HeaderWrapper from "@/components/shared/header/Wrapper/Wrapper";
import NinetyLogo from "@/components/shared/ninety-logo";

export const metadata: Metadata = {
  title: "Scan Request Received | The Ninety",
  description: "Your AI readiness scan request has been received.",
};

export default function ScanThanksPage() {
  return (
    <HeaderProvider>
      <div className="ninety-brand min-h-screen bg-background-base">
        <div className="sticky left-0 top-0 z-[101] w-full border-b-2 border-[#0A0A0A] bg-background-base header">
          <div className="absolute top-0 cmw-container h-full border-x-2 border-[#0A0A0A] pointer-events-none" />

          <div className="cmw-container absolute top-0 h-full pointer-events-none">
            <Connector className="absolute -left-[10.5px] -bottom-11" />
            <Connector className="absolute -right-[10.5px] -bottom-11" />
          </div>

          <HeaderWrapper>
            <div className="mx-auto flex w-full max-w-[1040px] items-center justify-between">
              <Link href="/" aria-label="The Ninety home">
                <NinetyLogo />
              </Link>

              <Link
                className="ninety-mono ninety-lift border-2 border-[#0A0A0A] bg-[#FFD100] px-16 py-10 text-[11px] text-[#0A0A0A]"
                href="/scan"
              >
                New scan
              </Link>
            </div>
          </HeaderWrapper>
        </div>

        <section className="px-16 py-44 sm:py-70" id="hero-content">
          <div className="mx-auto max-w-[760px] border-2 border-[#0A0A0A] bg-[#F4EFE4] p-22 text-center shadow-[8px_8px_0_#0A0A0A] sm:p-36">
            <CheckCircle2 className="mx-auto size-44 text-[#F26419]" aria-hidden="true" />
            <p className="ninety-mono mt-16 text-[10px]">Request received</p>
            <h1 className="ninety-display mx-auto mt-10 max-w-[560px] text-[44px] leading-[0.95] sm:text-[64px]">
              Your scan is in the queue.
            </h1>
            <p className="mx-auto mt-16 max-w-[560px] text-body-large">
              We have the website and contact details. We'll use the request to prepare the AI readiness scan.
            </p>

            <Link
              href="/scan"
              className="ninety-mono ninety-lift mt-22 inline-flex items-center justify-center gap-8 border-2 border-[#0A0A0A] bg-[#FFD100] px-16 py-13 text-[12px] text-[#0A0A0A]"
            >
              <ArrowLeft className="size-16" aria-hidden="true" />
              Back to form
            </Link>
          </div>
        </section>
      </div>
    </HeaderProvider>
  );
}
