# The Ninety AI Readiness Report

A signed-link website report for industrial companies that need to be found by buyers, search engines, and AI assistants.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env.local` file and add your environment variables:
```bash
# Copy from .env.local.example or add your API keys
OPENAI_API_KEY=your_openai_api_key
SCRAPE_PROVIDER_API_KEY=your_scraping_provider_api_key
SIGNED_ANALYSIS_SECRET=use_a_long_random_secret
ANALYSIS_ACCESS_CODE=oilmens
NEXT_PUBLIC_CONTACT_EMAIL=megan@theorydigital.ca
```

3. Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## Public Scan Request Form

Use `/scan` as the public intake URL for visitors to submit a website URL, name, email, and company. The form posts to Netlify as `ai-readiness-scan-request` and includes hidden fields for referrer, submitted URL, UTM parameters, `gclid`, `fbclid`, and `msclkid`.

You can prefill the website field for ads or direct outreach:

```bash
https://reports.yoursite.com/scan?url=example.com&utm_source=google&utm_medium=cpc&utm_campaign=ai-readiness
```

Use the access code when the submission should launch the instant report after the form is logged:

```bash
https://reports.yoursite.com/scan?access=oilmens&utm_source=google&utm_medium=cpc&utm_campaign=ai-readiness
```

## Signed Report Links

Public visitors see a contact button. Analysis only runs from signed URLs.

Generate a report link:

Generate a secret:

```bash
openssl rand -base64 32
```

Put that value in `.env.local` as `SIGNED_ANALYSIS_SECRET`.

Generate a signed report link:

```bash
SIGNED_ANALYSIS_SECRET=your_secret npm run sign-url -- https://example.com https://reports.yoursite.com 14
```

The generated URL includes `url`, `expires`, and `signature` query params. API routes reject requests without a valid signature. Links can be valid for up to 45 days.

## Features

- Signed report links for controlled access
- Industrial buyer-readiness scoring
- Plain-English practical impact summary
- Technical details for SEO, accessibility, schema, and crawler checks
