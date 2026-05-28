import { Metadata } from "next";
import Link from "next/link";
import { Connector } from "@/components/shared/layout/curvy-rect";
import { HeaderProvider } from "@/components/shared/header/HeaderContext";
import HeaderWrapper from "@/components/shared/header/Wrapper/Wrapper";
import NinetyLogo from "@/components/shared/ninety-logo";
import { hasAnalysisAccess } from "@/utils/signed-analysis";
import ScanRequestForm from "./ScanRequestForm";

type SearchParams = Record<string, string | string[] | undefined>;

export const metadata: Metadata = {
  title: "Request an AI Readiness Scan | The Ninety",
  description: "Submit a website and contact details for an AI readiness scan.",
};

function getParam(searchParams: SearchParams, key: string): string {
  const value = searchParams[key];
  return Array.isArray(value) ? value[0] || "" : value || "";
}

export default function ScanPage({ searchParams = {} }: { searchParams?: SearchParams }) {
  const initialWebsiteUrl =
    getParam(searchParams, "url") ||
    getParam(searchParams, "website") ||
    getParam(searchParams, "site");
  const accessParam = getParam(searchParams, "access");
  const instantAccessToken = hasAnalysisAccess(accessParam) ? accessParam : "";

  const initialTracking = {
    submitted_from: "",
    referrer: "",
    utm_source: getParam(searchParams, "utm_source"),
    utm_medium: getParam(searchParams, "utm_medium"),
    utm_campaign: getParam(searchParams, "utm_campaign"),
    utm_term: getParam(searchParams, "utm_term"),
    utm_content: getParam(searchParams, "utm_content"),
    gclid: getParam(searchParams, "gclid"),
    fbclid: getParam(searchParams, "fbclid"),
    msclkid: getParam(searchParams, "msclkid"),
  };

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
                href="/"
              >
                Report
              </Link>
            </div>
          </HeaderWrapper>
        </div>

        <section className="relative overflow-hidden px-16 py-32 sm:py-48 lg:py-70" id="hero-content">
          <div className="absolute inset-x-0 top-0 h-2 border-y-2 border-[#0A0A0A] bg-[#FFD100]" />
          <div className="mx-auto grid w-full max-w-[1040px] gap-30 lg:grid-cols-[0.86fr_1.14fr] lg:items-start">
            <div className="pt-8">
              <div className="ninety-mono mb-14 inline-flex border-2 border-[#0A0A0A] bg-white px-10 py-6 text-[10px]">
                AI readiness scan
              </div>
              <h1 className="ninety-display max-w-[520px] text-[44px] leading-[0.94] text-[#0A0A0A] sm:text-[64px] lg:text-[78px]">
                See how findable your site is.
              </h1>
              <p className="mt-18 max-w-[520px] text-body-x-large text-[#0A0A0A]">
                {instantAccessToken
                  ? "Enter the website and contact details. The scan will start as soon as you submit."
                  : "Enter the website you want scanned and where we should send the follow-up."}
              </p>
            </div>

            <ScanRequestForm
              initialWebsiteUrl={initialWebsiteUrl}
              initialTracking={initialTracking}
              instantAccessToken={instantAccessToken}
            />
          </div>
        </section>
      </div>
    </HeaderProvider>
  );
}
