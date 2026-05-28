"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowRight, Loader2 } from "lucide-react";

const FORM_NAME = "ai-readiness-scan-request";

type TrackingFields = {
  submitted_from: string;
  referrer: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_term: string;
  utm_content: string;
  gclid: string;
  fbclid: string;
  msclkid: string;
};

type ScanRequestFormProps = {
  initialWebsiteUrl: string;
  initialTracking: TrackingFields;
  instantAccessToken?: string;
};

function normalizeWebsiteUrl(value: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new Error("Enter the website URL you want scanned.");
  }

  const withProtocol = trimmed.match(/^https?:\/\//i) ? trimmed : `https://${trimmed}`;
  const parsed = new URL(withProtocol);

  if (!parsed.hostname || !parsed.hostname.includes(".")) {
    throw new Error("Enter a real website URL, like example.com.");
  }

  parsed.protocol = "https:";
  parsed.hash = "";
  parsed.hostname = parsed.hostname.toLowerCase();

  return parsed.toString();
}

export default function ScanRequestForm({
  initialWebsiteUrl,
  initialTracking,
  instantAccessToken = "",
}: ScanRequestFormProps) {
  const router = useRouter();
  const [websiteUrl, setWebsiteUrl] = useState(initialWebsiteUrl);
  const [trackingFields, setTrackingFields] = useState(initialTracking);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const submittedFrom = new URL(window.location.href);
    submittedFrom.searchParams.delete("access");

    setTrackingFields((current) => ({
      ...current,
      submitted_from: submittedFrom.toString(),
      referrer: document.referrer,
    }));
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    const form = event.currentTarget;
    const websiteField = form.elements.namedItem("website_url") as HTMLInputElement | null;
    let normalizedUrl = "";

    try {
      normalizedUrl = normalizeWebsiteUrl(websiteUrl);
      setWebsiteUrl(normalizedUrl);
      if (websiteField) websiteField.value = normalizedUrl;
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Enter a valid website URL.");
      websiteField?.focus();
      return;
    }

    const formData = new FormData(form);
    formData.set("website_url", normalizedUrl);
    formData.set("submitted_from", trackingFields.submitted_from);
    formData.set("referrer", trackingFields.referrer);

    const encodedForm = new URLSearchParams();
    formData.forEach((value, key) => {
      if (typeof value === "string") encodedForm.append(key, value);
    });

    setIsSubmitting(true);

    try {
      const response = await fetch("/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: encodedForm.toString(),
      });

      if (!response.ok && process.env.NODE_ENV !== "development") {
        throw new Error("The form did not submit.");
      }

      if (instantAccessToken) {
        const resultUrl = new URL("/", window.location.origin);
        resultUrl.searchParams.set("access", instantAccessToken);
        resultUrl.searchParams.set("url", normalizedUrl);

        router.push(`${resultUrl.pathname}${resultUrl.search}`);
        return;
      }

      router.push("/scan/thanks");
    } catch {
      setError("Something blocked the form submission. Please try again.");
      setIsSubmitting(false);
    }
  };

  return (
    <form
      name={FORM_NAME}
      method="POST"
      action="/scan/thanks"
      data-netlify="true"
      data-netlify-honeypot="bot-field"
      onSubmit={handleSubmit}
      className="relative border-2 border-[#0A0A0A] bg-[#F4EFE4] p-16 shadow-[8px_8px_0_#0A0A0A] sm:p-22"
    >
      <input type="hidden" name="form-name" value={FORM_NAME} />
      <p className="hidden">
        <label>
          Leave this blank
          <input name="bot-field" tabIndex={-1} autoComplete="off" />
        </label>
      </p>
      {Object.entries(trackingFields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <input type="hidden" name="instant_result" value={instantAccessToken ? "yes" : "no"} />

      <div className="grid gap-14">
        <div>
          <label className="ninety-mono mb-6 block text-[10px] text-[#0A0A0A]" htmlFor="website_url">
            Website URL
          </label>
          <input
            id="website_url"
            name="website_url"
            type="text"
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="url"
            required
            placeholder="example.com"
            value={websiteUrl}
            onChange={(event) => setWebsiteUrl(event.target.value)}
            className="w-full border-2 border-[#0A0A0A] bg-white px-12 py-11 text-body-input text-[#0A0A0A] placeholder:text-black-alpha-48 outline-none transition-shadow focus:shadow-[4px_4px_0_#0A0A0A]"
          />
        </div>

        <div className="grid gap-14 sm:grid-cols-2">
          <div>
            <label className="ninety-mono mb-6 block text-[10px] text-[#0A0A0A]" htmlFor="contact_name">
              Your name
            </label>
            <input
              id="contact_name"
              name="contact_name"
              type="text"
              autoComplete="name"
              required
              className="w-full border-2 border-[#0A0A0A] bg-white px-12 py-11 text-body-input text-[#0A0A0A] outline-none transition-shadow focus:shadow-[4px_4px_0_#0A0A0A]"
            />
          </div>

          <div>
            <label className="ninety-mono mb-6 block text-[10px] text-[#0A0A0A]" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="w-full border-2 border-[#0A0A0A] bg-white px-12 py-11 text-body-input text-[#0A0A0A] outline-none transition-shadow focus:shadow-[4px_4px_0_#0A0A0A]"
            />
          </div>
        </div>

        <div>
          <label className="ninety-mono mb-6 block text-[10px] text-[#0A0A0A]" htmlFor="company">
            Company
          </label>
          <input
            id="company"
            name="company"
            type="text"
            autoComplete="organization"
            className="w-full border-2 border-[#0A0A0A] bg-white px-12 py-11 text-body-input text-[#0A0A0A] outline-none transition-shadow focus:shadow-[4px_4px_0_#0A0A0A]"
          />
        </div>
      </div>

      {error && (
        <div className="mt-12 flex items-start gap-8 border-2 border-[#C8102E] bg-white px-12 py-10 text-body-small text-[#C8102E]">
          <AlertCircle className="mt-2 size-16 shrink-0" aria-hidden="true" />
          <p>{error}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="ninety-mono ninety-lift mt-16 inline-flex w-full items-center justify-center gap-8 border-2 border-[#0A0A0A] bg-[#FFD100] px-16 py-13 text-[12px] text-[#0A0A0A] disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="size-16 animate-spin" aria-hidden="true" />
            Submitting
          </>
        ) : (
          <>
            {instantAccessToken ? "Scan my site" : "Request scan"}
            <ArrowRight className="size-16" aria-hidden="true" />
          </>
        )}
      </button>
    </form>
  );
}
