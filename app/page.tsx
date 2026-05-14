"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

// Import shared components
import { Connector } from "@/components/shared/layout/curvy-rect";
import HeroFlame from "@/components/shared/effects/flame/hero-flame";
import AsciiExplosion from "@/components/shared/effects/flame/ascii-explosion";

// Import hero section components
import HomeHeroBackground from "@/components/app/(home)/sections/hero/Background/Background";
import { BackgroundOuterPiece } from "@/components/app/(home)/sections/hero/Background/BackgroundOuterPiece";
import HomeHeroBadge from "@/components/app/(home)/sections/hero/Badge/Badge";
import HomeHeroPixi from "@/components/app/(home)/sections/hero/Pixi/Pixi";
import HomeHeroTitle from "@/components/app/(home)/sections/hero/Title/Title";
import HeroInputSubmitButton from "@/components/app/(home)/sections/hero-input/Button/Button";
import Globe from "@/components/app/(home)/sections/hero-input/_svg/Globe";
import HeroScraping from "@/components/app/(home)/sections/hero-scraping/HeroScraping";
import { Endpoint } from "@/components/shared/Playground/Context/types";
import ControlPanel from "@/components/app/(home)/sections/ai-readiness/ControlPanel";

// Import header components
import { HeaderProvider } from "@/components/shared/header/HeaderContext";
import HeaderWrapper from "@/components/shared/header/Wrapper/Wrapper";

function NinetyLogo() {
  return (
    <div className="inline-flex items-stretch border-2 border-[#0A0A0A] text-[#0A0A0A]">
      <div className="ninety-display flex items-center bg-[#F4EFE4] px-10 py-7 text-[18px] leading-none">
        THE
      </div>
      <div className="ninety-display flex items-center border-l-2 border-[#0A0A0A] bg-[#FFD100] px-12 py-7 text-[34px] leading-none">
        90
      </div>
    </div>
  );
}

export default function StyleGuidePage() {
  const [tab] = useState<Endpoint>(Endpoint.Scrape);
  const [url, setUrl] = useState<string>("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [analysisStep, setAnalysisStep] = useState(0);
  const [analysisData, setAnalysisData] = useState<any>(null);
  const [urlError, setUrlError] = useState<string>("");
  const [signedParams, setSignedParams] = useState<{
    url: string;
    expires: string;
    signature: string;
  } | null>(null);
  const [checkedSignedParams, setCheckedSignedParams] = useState(false);
  const [reportLink, setReportLink] = useState("");
  const autoStartedRef = useRef(false);
  const contactEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL || "megan@theorydigital.ca";
  const normalizedContactEmail = contactEmail.replace(/^mailto:/i, "");
  const contactHref = `mailto:${normalizedContactEmail}`;

  const handleAnalysis = async (
    targetUrl = url,
    signatureParams = signedParams
  ) => {
    if (!targetUrl) return;

    if (!signatureParams) {
      setUrlError('This report requires a private signed link.');
      return;
    }

    // Auto-prepend https:// if no protocol is provided
    let processedUrl = targetUrl.trim();
    if (!processedUrl.match(/^https?:\/\//i)) {
      processedUrl = 'https://' + processedUrl;
    }

    // Validate URL format
    try {
      const urlObj = new URL(processedUrl);
      // Check if it's http or https
      if (urlObj.protocol !== 'https:') {
        setUrlError('Signed reports require an HTTPS website URL.');
        return;
      }
    } catch (error) {
      // If URL constructor throws, it's not a valid URL
      setUrlError('Please enter a valid URL (e.g., example.com)');
      return;
    }

    setIsAnalyzing(true);
    setShowResults(false);
    setAnalysisData(null);

    try {
      // Start basic analysis
      const basicAnalysisPromise = fetch('/api/ai-readiness', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: processedUrl,
          expires: signatureParams.expires,
          signature: signatureParams.signature,
        }),
      });

      // Wait for basic analysis
      const response = await basicAnalysisPromise;
      const data = await response.json();

      if (data.success) {
        setAnalysisData({
          ...data,
          signedParams: {
            url: processedUrl,
            expires: signatureParams.expires,
            signature: signatureParams.signature,
          },
          aiAnalysisPromise: null, // No auto AI analysis
          hasOpenAIKey: false, // Disable auto AI
          autoStartAI: false // Don't auto-start
        });
        setIsAnalyzing(false);
        setShowResults(true);
      } else {
        console.error('Analysis failed:', data.error);
        setIsAnalyzing(false);
        setUrlError(data.error || 'This report link is invalid or expired.');
      }
    } catch (error) {
      console.error('Analysis error:', error);
      setIsAnalyzing(false);
      alert('An error occurred while analyzing the website.');
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const signedUrl = params.get('url');
    const expires = params.get('expires');
    const signature = params.get('signature') || params.get('sig');

    if (signedUrl && expires && signature) {
      const nextSignedParams = { url: signedUrl, expires, signature };
      setSignedParams(nextSignedParams);
      setUrl(signedUrl);
      setReportLink(window.location.href);

      if (!autoStartedRef.current) {
        autoStartedRef.current = true;
        handleAnalysis(signedUrl, nextSignedParams);
      }
    }

    setCheckedSignedParams(true);
  }, []);

  const hasSignedAccess = !!signedParams;
  const reportContactBodyLines = [
    'Hey, I have questions about my AI readiness report. Can you help me?',
    '',
    'Report link:',
    reportLink,
  ];

  if (url) {
    reportContactBodyLines.push('', `Website analyzed: ${url}`);
  }

  const reportContactBody = reportContactBodyLines.join('\n');
  const reportContactHref = hasSignedAccess && reportLink
    ? `mailto:${normalizedContactEmail}?subject=${encodeURIComponent('Questions about my AI readiness report')}&body=${encodeURIComponent(reportContactBody)}`
    : contactHref;

  return (
    <HeaderProvider>
      <div className="ninety-brand min-h-screen bg-background-base">
        {/* Header/Navigation Section */}
        <div className="sticky top-0 left-0 w-full z-[101] bg-background-base header border-b-2 border-[#0A0A0A]">
          <div className="absolute top-0 cmw-container h-full border-x-2 border-[#0A0A0A] pointer-events-none" />

          <div className="cmw-container absolute top-0 h-full pointer-events-none">
            <Connector className="absolute -left-[10.5px] -bottom-11" />
            <Connector className="absolute -right-[10.5px] -bottom-11" />
          </div>

          <HeaderWrapper>
            <div className="max-w-[900px] mx-auto w-full flex justify-between items-center">
              <div className="flex gap-24 items-center">
                <NinetyLogo />
              </div>

              <div className="flex gap-8">
                <a
                  className="ninety-mono ninety-lift border-2 border-[#0A0A0A] bg-[#FFD100] px-16 py-10 text-[11px] text-[#0A0A0A]"
                  href={reportContactHref}
                >
                  Contact Us
                </a>
              </div>
            </div>
          </HeaderWrapper>
        </div>

        {/* Hero Section */}
        <section className="overflow-x-clip" id="home-hero">
          <div className="relative pt-28 pb-115 lg:-mt-100 lg:pt-254" id="hero-content">
            <HomeHeroPixi />
            <HeroFlame />
            <BackgroundOuterPiece />
            <HomeHeroBackground />

            <AnimatePresence mode="wait">
              {!isAnalyzing && !showResults ? (
                <motion.div
                  key="hero"
                  initial={{ opacity: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.5 }}
                  className="relative container px-16"
                >
                  <HomeHeroBadge />
                  <HomeHeroTitle />

                  <p className="text-center text-body-large">
                    {hasSignedAccess
                      ? 'Your private AI readiness report is being prepared from a single'
                      : 'Private AI readiness reports for industrial companies that need to be found by'}
                    <br className="lg-max:hidden" />
                    {hasSignedAccess ? ' page snapshot.' : ' buyers, search engines, and AI assistants.'}
                  </p>
                  {!checkedSignedParams ? null : !hasSignedAccess ? (
                    <a
                      className="ninety-mono ninety-lift block mx-auto mt-18 w-max border-2 border-[#0A0A0A] bg-[#FFD100] px-18 py-12 text-[12px] text-[#0A0A0A]"
                      href={reportContactHref}
                    >
                      Contact us for a report
                    </a>
                  ) : (
                    <div className="ninety-mono block mx-auto mt-12 w-max border border-[#0A0A0A] bg-[#F4EFE4] px-10 py-6 text-[10px]">
                      Private report link
                    </div>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="control-panel"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.5 }}
                  className="relative container px-16"
                  style={{ marginTop: '-35px' }}
                >
                  <ControlPanel
                    isAnalyzing={isAnalyzing}
                    showResults={showResults}
                    url={url}
                    analysisData={analysisData}
                    onReset={() => {
                      setIsAnalyzing(false);
                      setShowResults(false);
                      setAnalysisStep(0);
                      setAnalysisData(null);
                      setUrl(signedParams?.url || "");
                    }}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Signed report input - only show when not analyzing */}
          {!isAnalyzing && !showResults && hasSignedAccess && (
            <motion.div
              className="container lg:contents !p-16 relative -mt-90"
              initial={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="absolute top-0 left-[calc(50%-50vw)] h-1 w-screen bg-border-faint lg:hidden" />
              <div className="absolute bottom-0 left-[calc(50%-50vw)] h-1 w-screen bg-border-faint lg:hidden" />

              <Connector className="-top-10 -left-[10.5px] lg:hidden" />
              <Connector className="-top-10 -right-[10.5px] lg:hidden" />
              <Connector className="-bottom-10 -left-[10.5px] lg:hidden" />
              <Connector className="-bottom-10 -right-[10.5px] lg:hidden" />

              {/* Hero Input Component */}
              <div className="relative z-[11] mx-auto -mt-30 w-full max-w-552 rounded-8 border-2 border-[#0A0A0A] bg-[#F4EFE4] shadow-[8px_8px_0_#0A0A0A] lg:z-[2] lg:-mt-30">
                <div className="p-16 flex gap-12 items-center w-full relative">
                  <Globe />

                  <input
                    className={`flex-1 bg-transparent text-body-input text-accent-black placeholder:text-black-alpha-48 focus:outline-none focus:ring-0 focus:border-transparent ${urlError ? 'text-heat-200' : ''}`}
                    placeholder="example.com"
                    type="text"
                    value={url}
                    readOnly
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && url.length > 0) {
                        e.preventDefault();
                        handleAnalysis();
                      }
                    }}
                  />

                  <div
                    onClick={(e) => {
                      e.preventDefault();
                      if (url.length > 0) {
                        handleAnalysis(url, signedParams);
                      }
                    }}
                  >
                    <HeroInputSubmitButton dirty={url.length > 0} tab={tab} />
                  </div>
                </div>

                {/* Error message */}
                {urlError && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="absolute -bottom-24 left-16 text-heat-200 text-label-small"
                  >
                    {urlError}
                  </motion.div>
                )}

                <div className="h-248 top-84 cw-768 pointer-events-none absolute overflow-clip -z-10">
                  <AsciiExplosion className="-top-200" />
                </div>
              </div>

              {/* Hero report animation */}
              <HeroScraping />
            </motion.div>
          )}
        </section>
      </div>
    </HeaderProvider>
  );
}
