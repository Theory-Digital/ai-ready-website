import { NextRequest, NextResponse } from 'next/server';
import ScrapeProvider from '@mendable/firecrawl-js';
import crypto from 'crypto';
import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';
import { verifySignedAnalysisParams } from '../../../utils/signed-analysis';

const scrapeProvider = new ScrapeProvider({
  apiKey: process.env.SCRAPE_PROVIDER_API_KEY || process.env.FIRECRAWL_API_KEY!
});

export const runtime = 'nodejs';

interface CheckResult {
  id: string;
  label: string;
  status: 'pass' | 'fail' | 'warning';
  score: number;
  details: string;
  recommendation: string;
  actionItems?: string[];
}

interface AiReadinessResponse {
  success: true;
  url: string;
  overallScore: number;
  checks: CheckResult[];
  htmlContent: string;
  metadata: {
    title?: string;
    description?: string;
    analyzedAt: string;
    scoreBreakdown: Record<string, number>;
    scoreCaps: string[];
    cache?: {
      hit: boolean;
      cachedAt: string;
    };
  };
}

interface CachedReport {
  cachedAt: string;
  response: AiReadinessResponse;
}

class AnalysisRunError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.status = status;
  }
}

const reportCacheDir = path.join(process.cwd(), '.next', 'cache', 'ai-readiness-reports');
const configuredReportCacheTtlSeconds = Number(process.env.AI_READINESS_CACHE_TTL_SECONDS);
const reportCacheTtlSeconds = Number.isFinite(configuredReportCacheTtlSeconds)
  ? configuredReportCacheTtlSeconds
  : 60 * 60 * 24 * 30;
const reportCacheTtlMs = Math.max(0, reportCacheTtlSeconds) * 1000;
const inFlightReports = new Map<string, Promise<AiReadinessResponse>>();

function getReportCacheKey(params: { url: string; expires: string | number; signature: string }): string {
  return crypto
    .createHash('sha256')
    .update(`${params.url}\n${params.expires}\n${params.signature}`)
    .digest('hex');
}

function getReportCachePath(cacheKey: string): string {
  return path.join(reportCacheDir, `${cacheKey}.json`);
}

function withCacheMetadata(response: AiReadinessResponse, hit: boolean, cachedAt: string): AiReadinessResponse {
  return {
    ...response,
    metadata: {
      ...response.metadata,
      cache: {
        hit,
        cachedAt,
      },
    },
  };
}

async function readCachedReport(cacheKey: string): Promise<AiReadinessResponse | null> {
  try {
    const raw = await readFile(getReportCachePath(cacheKey), 'utf8');
    const cached = JSON.parse(raw) as CachedReport;
    const cachedAtMs = Date.parse(cached.cachedAt);

    if (!cached.response?.success || Number.isNaN(cachedAtMs)) {
      return null;
    }

    if (reportCacheTtlMs > 0 && Date.now() - cachedAtMs > reportCacheTtlMs) {
      return null;
    }

    return withCacheMetadata(cached.response, true, cached.cachedAt);
  } catch {
    return null;
  }
}

async function writeCachedReport(cacheKey: string, response: AiReadinessResponse): Promise<void> {
  const cachedAt = new Date().toISOString();
  const cached: CachedReport = {
    cachedAt,
    response: withCacheMetadata(response, false, cachedAt),
  };

  await mkdir(reportCacheDir, { recursive: true });
  await writeFile(getReportCachePath(cacheKey), JSON.stringify(cached), 'utf8');
}

// Calculate Flesch-Kincaid readability score
function calculateReadability(text: string): number {
  // Simple approximation of Flesch Reading Ease
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const words = text.split(/\s+/).filter(w => w.length > 0);
  const syllables = words.reduce((acc, word) => {
    // Simple syllable counting: count vowel groups
    return acc + (word.match(/[aeiouAEIOU]+/g) || []).length || 1;
  }, 0);

  if (sentences.length === 0 || words.length === 0) return 0;

  const avgWordsPerSentence = words.length / sentences.length;
  const avgSyllablesPerWord = syllables / words.length;

  // Flesch Reading Ease formula
  const score = 206.835 - 1.015 * avgWordsPerSentence - 84.6 * avgSyllablesPerWord;

  // Clamp between 0 and 100
  return Math.max(0, Math.min(100, score));
}

// Extract text content from HTML
function extractTextContent(html: string): string {
  // Remove script and style tags (using [\s\S] instead of . with s flag)
  let cleanHtml = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  cleanHtml = cleanHtml.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

  // Remove HTML tags
  cleanHtml = cleanHtml.replace(/<[^>]+>/g, ' ');

  // Decode HTML entities
  cleanHtml = cleanHtml.replace(/&nbsp;/g, ' ');
  cleanHtml = cleanHtml.replace(/&amp;/g, '&');
  cleanHtml = cleanHtml.replace(/&lt;/g, '<');
  cleanHtml = cleanHtml.replace(/&gt;/g, '>');
  cleanHtml = cleanHtml.replace(/&quot;/g, '"');
  cleanHtml = cleanHtml.replace(/&#39;/g, "'");

  // Clean up whitespace
  return cleanHtml.replace(/\s+/g, ' ').trim();
}

function extractJsonLd(html: string): any[] {
  const scripts = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi) || [];
  const nodes: any[] = [];

  for (const script of scripts) {
    const content = script
      .replace(/<script[^>]*>/i, '')
      .replace(/<\/script>/i, '')
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .trim();

    try {
      const parsed = JSON.parse(content);
      nodes.push(parsed);
    } catch {
      nodes.push({ __invalidJsonLd: true, raw: content.substring(0, 200) });
    }
  }

  return nodes;
}

function flattenSchemaNodes(value: any, flattened: any[] = [], depth = 0): any[] {
  if (!value || depth > 8) return flattened;

  if (Array.isArray(value)) {
    value.forEach(item => flattenSchemaNodes(item, flattened, depth + 1));
    return flattened;
  }

  if (typeof value !== 'object') return flattened;

  if (value['@type'] || value.type || value.__invalidJsonLd) {
    flattened.push(value);
  }

  const nestedKeys = [
    '@graph',
    'mainEntity',
    'itemListElement',
    'provider',
    'address',
    'contactPoint',
    'makesOffer',
    'hasOfferCatalog',
    'itemOffered',
    'offers',
    'hasCertification',
    'manufacturer',
    'brand',
  ];

  for (const key of nestedKeys) {
    if (value[key]) flattenSchemaNodes(value[key], flattened, depth + 1);
  }

  return flattened;
}

function getSchemaTypes(node: any): string[] {
  const type = node?.['@type'] || node?.type;
  if (!type) return [];
  return Array.isArray(type) ? type.map(String) : [String(type)];
}

function hasAnyText(text: string, terms: string[]): boolean {
  return terms.some(term => text.includes(term));
}

function countPatternMatches(text: string, patterns: RegExp[]): number {
  return patterns.filter(pattern => pattern.test(text)).length;
}

function scoreCheck(score: number): 'pass' | 'warning' | 'fail' {
  if (score >= 80) return 'pass';
  if (score >= 50) return 'warning';
  return 'fail';
}

function getScore(checks: CheckResult[], id: string): number {
  return checks.find(check => check.id === id)?.score ?? 0;
}

function weightedAverage(
  checks: CheckResult[],
  weights: Record<string, number>
): number {
  let weightedSum = 0;
  let totalWeight = 0;

  for (const [id, weight] of Object.entries(weights)) {
    weightedSum += getScore(checks, id) * weight;
    totalWeight += weight;
  }

  return totalWeight > 0 ? weightedSum / totalWeight : 0;
}

function calculateIndustrialReadinessScore(checks: CheckResult[]): {
  score: number;
  categoryScores: Record<string, number>;
  appliedCaps: string[];
} {
  const categoryScores = {
    buyerReadiness: weightedAverage(checks, {
      'industrial-services': 1.2,
      'procurement-readiness': 1.2,
      'certifications-safety': 1.0,
      'local-industrial-schema': 0.8,
    }),
    structuredData: weightedAverage(checks, {
      'local-industrial-schema': 1.4,
      'industrial-services': 1.1,
      'equipment-product-data': 0.9,
      'certifications-safety': 1.0,
    }),
    crawlBasics: weightedAverage(checks, {
      'robots-txt': 1.0,
      'sitemap': 1.0,
      'meta-tags': 0.9,
      'heading-structure': 0.8,
      'llms-txt': 0.2,
    }),
    contentClarity: weightedAverage(checks, {
      'readability': 1.0,
      'semantic-html': 0.9,
      'accessibility': 0.8,
    }),
  };

  let score = Math.round(
    categoryScores.buyerReadiness * 0.45 +
    categoryScores.structuredData * 0.25 +
    categoryScores.crawlBasics * 0.15 +
    categoryScores.contentClarity * 0.15
  );

  const caps: { id: string; maxScore: number; reason: string }[] = [
    {
      id: 'procurement-readiness',
      maxScore: 70,
      reason: 'No clear RFQ/contact procurement path',
    },
    {
      id: 'industrial-services',
      maxScore: 65,
      reason: 'Industrial services and capabilities are not clear enough',
    },
    {
      id: 'local-industrial-schema',
      maxScore: 75,
      reason: 'Local business entity and service area signals are weak',
    },
    {
      id: 'certifications-safety',
      maxScore: 75,
      reason: 'Safety, certification, and compliance trust signals are weak',
    },
  ];

  const appliedCaps: string[] = [];

  for (const cap of caps) {
    if (getScore(checks, cap.id) < 50 && score > cap.maxScore) {
      score = cap.maxScore;
      appliedCaps.push(cap.reason);
    }
  }

  const hasStructuredData = [
    'local-industrial-schema',
    'industrial-services',
    'equipment-product-data',
    'certifications-safety',
  ].some(id => getScore(checks, id) >= 50);

  if (!hasStructuredData && score > 80) {
    score = 80;
    appliedCaps.push('No meaningful industrial structured data detected');
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    categoryScores: Object.fromEntries(
      Object.entries(categoryScores).map(([key, value]) => [key, Math.round(value)])
    ),
    appliedCaps,
  };
}

async function analyzeHTML(html: string, metadata: any, url: string): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  console.log('[AI-READY] HTML Check 1/10: Extracting text content...');
  const textContent = extractTextContent(html);
  const lowerText = textContent.toLowerCase();
  const jsonLdRoots = extractJsonLd(html);
  const schemaNodes = flattenSchemaNodes(jsonLdRoots);
  const schemaText = JSON.stringify(jsonLdRoots).toLowerCase();
  const schemaTypes = schemaNodes.flatMap(getSchemaTypes).map(type => type.toLowerCase());

  console.log('[AI-READY] HTML Check 2/10: Analyzing heading structure...');
  // 1. Heading Structure (High Signal)
  const h1Count = (html.match(/<h1[^>]*>/gi) || []).length;
  const headings = html.match(/<h([1-6])[^>]*>/gi) || [];
  const headingLevels = headings.map(h => parseInt(h.match(/<h([1-6])/i)?.[1] || '0'));

  let headingScore = 100;
  let headingIssues: string[] = [];

  // Check for single H1
  if (h1Count === 0) {
    headingScore -= 40;
    headingIssues.push('No H1 found');
  } else if (h1Count > 1) {
    headingScore -= 30;
    headingIssues.push(`Multiple H1s (${h1Count}) create topic ambiguity`);
  }

  // Check heading hierarchy
  for (let i = 1; i < headingLevels.length; i++) {
    if (headingLevels[i] - headingLevels[i-1] > 1) {
      headingScore -= 15;
      headingIssues.push(`Skipped heading level (H${headingLevels[i-1]} → H${headingLevels[i]})`);
    }
  }

  headingScore = Math.max(0, headingScore);

  results.push({
    id: 'heading-structure',
    label: 'Heading Hierarchy',
    status: headingScore >= 80 ? 'pass' : headingScore >= 50 ? 'warning' : 'fail',
    score: headingScore,
    details: headingIssues.length > 0 ? headingIssues.join(', ') : `Perfect hierarchy with ${h1Count} H1 and logical structure`,
    recommendation: headingScore < 80 ?
      'Use exactly one H1 and maintain logical heading hierarchy (H1→H2→H3)' :
      'Excellent heading structure for AI comprehension'
  });

  console.log('[AI-READY] HTML Check 3/10: Calculating readability score...');
  // 3. Readability Score (High Signal)
  const readabilityScore = calculateReadability(textContent);
  let readabilityStatus: 'pass' | 'warning' | 'fail' = 'pass';
  let readabilityDetails = '';
  let normalizedScore = 0;

  if (readabilityScore >= 70) {
    normalizedScore = 100;
    readabilityStatus = 'pass';
    readabilityDetails = `Very readable (Flesch: ${Math.round(readabilityScore)})`;
  } else if (readabilityScore >= 50) {
    normalizedScore = 80;
    readabilityStatus = 'pass';
    readabilityDetails = `Good readability (Flesch: ${Math.round(readabilityScore)})`;
  } else if (readabilityScore >= 30) {
    normalizedScore = 50;
    readabilityStatus = 'warning';
    readabilityDetails = `Difficult to read (Flesch: ${Math.round(readabilityScore)})`;
  } else {
    normalizedScore = 20;
    readabilityStatus = 'fail';
    readabilityDetails = `Very difficult (Flesch: ${Math.round(readabilityScore)})`;
  }

  results.push({
    id: 'readability',
    label: 'Content Readability',
    status: readabilityStatus,
    score: normalizedScore,
    details: readabilityDetails,
    recommendation: normalizedScore < 80 ?
      'Simplify sentences and use clearer language for better AI comprehension' :
      'Content is clearly written and AI-friendly'
  });

  console.log('[AI-READY] HTML Check 4/10: Checking metadata quality...');
  // 4. Enhanced Metadata Quality (Medium Signal)
  const hasOgTitle = metadata?.ogTitle || metadata?.title || html.includes('og:title') || html.includes('<title');
  const hasOgDescription = metadata?.ogDescription || metadata?.description || html.includes('og:description') || html.includes('name="description"');

  // Check description quality
  const descMatch = html.match(/content="([^"]*)"/i);
  const descLength = descMatch?.[1]?.length || 0;
  const hasGoodDescLength = descLength >= 70 && descLength <= 160;

  const hasCanonical = html.includes('rel="canonical"');
  const hasAuthor = html.includes('name="author"') || html.includes('property="article:author"');
  const hasPublishDate = html.includes('property="article:published_time"') || html.includes('property="article:modified_time"');

  // Enhanced scoring - be more generous
  let metaScore = 30; // Base score for having a page
  let metaDetails: string[] = [];

  if (hasOgTitle) {
    metaScore += 30;
    metaDetails.push('Title ✓');
  } else if (html.includes('<title')) {
    metaScore += 20;
    metaDetails.push('Basic title');
  }

  if (hasOgDescription) {
    metaScore += 25;
    if (hasGoodDescLength) {
      metaScore += 10;
      metaDetails.push('Description ✓');
    } else {
      metaDetails.push('Description');
    }
  }

  if (hasAuthor) {
    metaScore += 10;
    metaDetails.push('Author ✓');
  }
  if (hasPublishDate) {
    metaScore += 10;
    metaDetails.push('Date ✓');
  }

  // Cap at 100
  metaScore = Math.min(100, metaScore);
  results.push({
    id: 'meta-tags',
    label: 'Metadata Quality',
    status: metaScore >= 70 ? 'pass' : metaScore >= 40 ? 'warning' : 'fail',
    score: metaScore,
    details: metaDetails.length > 0 ? metaDetails.join(', ') : 'Missing critical metadata',
    recommendation: metaScore < 70 ?
      'Add title, description (70-160 chars), author, and publish date metadata' :
      'Metadata provides excellent context for AI'
  });

  console.log('[AI-READY] HTML Check 5/10: Checking semantic HTML and accessibility...');
  // 6. Semantic HTML (Medium Signal)
  const semanticTags = ['<article', '<nav', '<main', '<section', '<header', '<footer', '<aside'];
  const semanticCount = semanticTags.filter(tag => html.includes(tag)).length;

  // Modern SPAs might use divs with proper ARIA roles
  const hasAriaRoles = html.includes('role="') || html.includes('aria-');
  const isModernFramework = html.includes('__next') || html.includes('_app') || html.includes('react') || html.includes('vue') || html.includes('svelte');

  const semanticScore = Math.min(100,
    (semanticCount / 5) * 60 +
    (hasAriaRoles ? 20 : 0) +
    (isModernFramework ? 20 : 0));

  results.push({
    id: 'semantic-html',
    label: 'Semantic HTML',
    status: semanticScore >= 80 ? 'pass' : semanticScore >= 40 ? 'warning' : 'fail',
    score: semanticScore,
    details: `Found ${semanticCount} semantic HTML5 elements`,
    recommendation: semanticScore < 80 ? 'Use more semantic HTML5 elements (article, nav, main, section, etc.)' : 'Excellent use of semantic HTML'
  });

  // 7. Check accessibility (Lower Signal but still important)
  const hasAltText = (html.match(/alt="/g) || []).length;
  const imgCount = (html.match(/<img/g) || []).length;
  const altTextRatio = imgCount > 0 ? (hasAltText / imgCount) * 100 : 100;
  const hasAriaLabels = html.includes('aria-label');
  const hasAriaDescribedBy = html.includes('aria-describedby');
  const hasRole = html.includes('role="');
  const hasLangAttribute = html.includes('lang="');

  // Sites with no images shouldn't be penalized
  const imageScore = imgCount === 0 ? 40 : (altTextRatio * 0.4);

  const accessibilityScore = Math.min(100,
    imageScore +
    (hasAriaLabels ? 20 : 0) +
    (hasAriaDescribedBy ? 10 : 0) +
    (hasRole ? 15 : 0) +
    (hasLangAttribute ? 15 : 0));

  results.push({
    id: 'accessibility',
    label: 'Accessibility',
    status: accessibilityScore >= 80 ? 'pass' : accessibilityScore >= 50 ? 'warning' : 'fail',
    score: Math.round(accessibilityScore),
    details: `${Math.round(altTextRatio)}% images have alt text, ARIA labels: ${hasAriaLabels ? 'Yes' : 'No'}`,
    recommendation: accessibilityScore < 80 ? 'Add alt text to all images and use ARIA labels for interactive elements' : 'Good accessibility implementation'
  });

  console.log('[AI-READY] HTML Check 6/10: Checking local industrial entity schema...');
  const invalidJsonLdCount = schemaNodes.filter(node => node.__invalidJsonLd).length;
  const hasOrganizationSchema = schemaTypes.some(type => ['organization', 'localbusiness', 'corporation'].includes(type));
  const hasLocalBusinessSchema = schemaTypes.includes('localbusiness');
  const hasBusinessIdentity = hasOrganizationSchema || schemaText.includes('"@type":"organization"') || schemaText.includes('"@type":"localbusiness"');
  const hasAddress = schemaText.includes('"address"') || lowerText.includes('nisku') || lowerText.includes('leduc county') || lowerText.includes('edmonton');
  const hasPhone = schemaText.includes('"telephone"') || /\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}/.test(textContent);
  const hasMapOrGeo = schemaText.includes('"geo"') || schemaText.includes('"hasmap"') || lowerText.includes('google maps');
  const hasAreaServed = schemaText.includes('"areaserved"') || hasAnyText(lowerText, ['nisku', 'leduc county', 'edmonton', 'alberta', 'western canada']);
  const hasSameAs = schemaText.includes('"sameas"');
  const hasIndustryCode = schemaText.includes('"naics"') || schemaText.includes('"isicv4"');

  const localEntityScore = Math.max(0, Math.min(100,
    (hasBusinessIdentity ? 25 : 0) +
    (hasLocalBusinessSchema ? 15 : 0) +
    (hasAddress ? 15 : 0) +
    (hasPhone ? 10 : 0) +
    (hasMapOrGeo ? 10 : 0) +
    (hasAreaServed ? 15 : 0) +
    (hasSameAs ? 5 : 0) +
    (hasIndustryCode ? 5 : 0) -
    (invalidJsonLdCount > 0 ? 15 : 0)
  ));

  results.push({
    id: 'local-industrial-schema',
    label: 'Local Entity Schema',
    status: scoreCheck(localEntityScore),
    score: localEntityScore,
    details: [
      hasBusinessIdentity ? 'Business entity schema found' : 'No Organization/LocalBusiness schema found',
      hasAreaServed ? 'service area is clear' : 'service area is unclear',
      invalidJsonLdCount > 0 ? `${invalidJsonLdCount} invalid JSON-LD block(s)` : 'JSON-LD parses cleanly'
    ].join(', '),
    recommendation: localEntityScore < 80
      ? 'Add Organization or LocalBusiness JSON-LD with Nisku/Leduc County address, phone, map/geo, areaServed, sameAs, and NAICS/ISIC where available'
      : 'Strong local business entity signals for industrial search and AI extraction',
    actionItems: [
      'Use Organization or LocalBusiness schema with a stable @id such as https://example.com/#organization',
      'Include address, telephone, url, logo, geo or hasMap, and sameAs profile links',
      'Add areaServed values such as Nisku, Leduc County, Edmonton, Alberta, and Western Canada when accurate',
      'Add naics or isicV4 when the company has a clear industrial classification'
    ]
  });

  console.log('[AI-READY] HTML Check 7/10: Checking services and offer catalog...');
  const industrialServiceTerms = [
    'fabrication', 'machining', 'welding', 'oilfield', 'maintenance', 'equipment rental',
    'trucking', 'sandblasting', 'coating', 'inspection', 'hydrovac', 'pipefitting',
    'millwright', 'field service', 'shutdown', 'turnaround', 'repair'
  ];
  const hasServiceSchema = schemaTypes.includes('service') || schemaText.includes('"servicetype"');
  const hasOfferCatalog = schemaText.includes('"hasoffercatalog"') || schemaText.includes('"makesoffer"');
  const serviceTermCount = industrialServiceTerms.filter(term => lowerText.includes(term)).length;
  const hasServiceAreaLanguage = hasAnyText(lowerText, ['service area', 'serving', 'nisku', 'leduc', 'edmonton', 'alberta']);
  const servicesScore = Math.min(100,
    (hasServiceSchema ? 35 : 0) +
    (hasOfferCatalog ? 20 : 0) +
    Math.min(25, serviceTermCount * 5) +
    (hasServiceAreaLanguage ? 20 : 0)
  );

  results.push({
    id: 'industrial-services',
    label: 'Industrial Services',
    status: scoreCheck(servicesScore),
    score: servicesScore,
    details: hasServiceSchema
      ? `Service schema found; ${serviceTermCount} industrial service signal(s) detected`
      : `No Service schema found; ${serviceTermCount} industrial service signal(s) detected in page copy`,
    recommendation: servicesScore < 80
      ? 'Mark up core services with Service schema, serviceType, provider, areaServed, and an OfferCatalog where multiple services are listed'
      : 'Services are clear enough for industrial buyers and AI systems to classify',
    actionItems: [
      'Create one visible section for core capabilities such as fabrication, machining, repair, rentals, or field service',
      'Add Service JSON-LD for each major service page',
      'Connect each service to the provider Organization and areaServed',
      'Use hasOfferCatalog when the page lists multiple service lines'
    ]
  });

  console.log('[AI-READY] HTML Check 8/10: Checking products, equipment, and specs...');
  const productSpecTerms = [
    'equipment', 'fleet', 'model', 'capacity', 'specification', 'spec sheet', 'sku',
    'manufacturer', 'rental', 'parts', 'inventory', 'ton', 'psi', 'hp', 'warranty'
  ];
  const hasProductSchema = schemaTypes.includes('product') || schemaText.includes('"manufacturer"') || schemaText.includes('"model"');
  const hasOfferSchema = schemaText.includes('"offers"') || schemaText.includes('"availability"');
  const productSpecCount = productSpecTerms.filter(term => lowerText.includes(term)).length;
  const hasDownloadableSpecs = /href=["'][^"']+\.(pdf|xlsx?|csv|docx?)["']/i.test(html) || lowerText.includes('download spec');
  const productsScore = Math.min(100,
    (hasProductSchema ? 35 : 0) +
    (hasOfferSchema ? 20 : 0) +
    Math.min(25, productSpecCount * 4) +
    (hasDownloadableSpecs ? 20 : 0)
  );

  results.push({
    id: 'equipment-product-data',
    label: 'Equipment & Product Data',
    status: scoreCheck(productsScore),
    score: productsScore,
    details: hasProductSchema
      ? `Product/equipment schema found; ${productSpecCount} spec signal(s) detected`
      : `${productSpecCount} equipment/spec signal(s) detected, but Product schema is missing`,
    recommendation: productsScore < 80
      ? 'For rentals, parts, or equipment pages, add Product schema with manufacturer, model, SKU/part numbers, offers, availability, and visible spec data'
      : 'Equipment and product details are well structured for AI-assisted procurement',
    actionItems: [
      'Use Product schema only for real products, parts, rentals, or equipment listings',
      'Include manufacturer, brand, model, SKU, dimensions/capacity, and availability when known',
      'Summarize PDF spec sheets in HTML so AI systems do not need to infer from downloads only',
      'Link products or equipment back to relevant services and RFQ paths'
    ]
  });

  console.log('[AI-READY] HTML Check 9/10: Checking safety, certifications, and trust signals...');
  const certificationPatterns = [
    /\bcor\b/i,
    /\bsecor\b/i,
    /\bisnetworld\b/i,
    /\bcomplyworks\b/i,
    /\bwcb\b/i,
    /\bcwb\b/i,
    /\bcsa\b/i,
    /\bapi\b/i,
    /\biso\b/i,
    /\binsurance\b/i,
    /\bbonded\b/i,
    /\bcertified\b/i,
    /\bcertification\b/i,
    /\bsafety program\b/i,
    /\bquality assurance\b/i,
    /\bhse\b/i
  ];
  const certificationCount = countPatternMatches(lowerText, certificationPatterns);
  const hasCertificationSchema = schemaText.includes('"hascertification"') || schemaTypes.includes('certification');
  const hasCredentialSchema = schemaText.includes('"hascredential"');
  const hasSafetyPage = /href=["'][^"']*(safety|certification|quality|hse|compliance)[^"']*["']/i.test(html);
  const trustScore = Math.min(100,
    (hasCertificationSchema ? 35 : 0) +
    (hasCredentialSchema ? 10 : 0) +
    Math.min(35, certificationCount * 7) +
    (hasSafetyPage ? 20 : 0)
  );

  results.push({
    id: 'certifications-safety',
    label: 'Safety & Certifications',
    status: scoreCheck(trustScore),
    score: trustScore,
    details: hasCertificationSchema
      ? `Certification schema found; ${certificationCount} safety/compliance signal(s) detected`
      : `${certificationCount} safety/compliance signal(s) detected, but Certification schema is missing`,
    recommendation: trustScore < 80
      ? 'Expose safety programs, trade certifications, WCB/insurance, and compliance networks in visible copy and Certification schema'
      : 'Strong industrial trust and compliance signals',
    actionItems: [
      'List applicable COR/SECOR, ISNetworld, ComplyWorks, WCB, CWB, CSA, API, or ISO credentials',
      'Use hasCertification on Organization, Service, or Product schema where the credential applies',
      'Include certification identifiers, issuing bodies, and expiry dates when accurate',
      'Create a dedicated safety or compliance page if these details are buried'
    ]
  });

  console.log('[AI-READY] HTML Check 10/10: Checking procurement readiness...');
  const hasRfq = hasAnyText(lowerText, ['request a quote', 'rfq', 'quote request', 'get a quote', 'estimate']);
  const hasContactPath = hasPhone || lowerText.includes('@') || /href=["']mailto:/i.test(html) || /href=["']tel:/i.test(html);
  const hasEmergency = hasAnyText(lowerText, ['24/7', '24 hour', 'emergency', 'after hours', 'shutdown', 'turnaround']);
  const hasIndustriesServed = hasAnyText(lowerText, ['industries served', 'oil and gas', 'construction', 'mining', 'energy', 'municipal', 'utilities']);
  const hasProjectEvidence = hasAnyText(lowerText, ['case study', 'project', 'portfolio', 'gallery', 'completed work', 'clients']);
  const procurementScore = Math.min(100,
    (hasRfq ? 25 : 0) +
    (hasContactPath ? 25 : 0) +
    (hasEmergency ? 15 : 0) +
    (hasIndustriesServed ? 20 : 0) +
    (hasProjectEvidence ? 15 : 0)
  );

  results.push({
    id: 'procurement-readiness',
    label: 'Procurement Readiness',
    status: scoreCheck(procurementScore),
    score: procurementScore,
    details: [
      hasRfq ? 'RFQ path found' : 'RFQ path missing',
      hasContactPath ? 'contact path found' : 'contact path missing',
      hasIndustriesServed ? 'industries served are visible' : 'industries served are unclear'
    ].join(', '),
    recommendation: procurementScore < 80
      ? 'Make it easy for buyers and AI systems to identify capabilities, service area, RFQ/contact path, emergency availability, and relevant industries'
      : 'Procurement path and buyer intent signals are clear',
    actionItems: [
      'Add a prominent RFQ or quote request path with phone and email alternatives',
      'State industries served and typical job/project types',
      'Mention emergency, shutdown, or after-hours availability only if actually offered',
      'Add project examples, client sectors, or capability photos with descriptive captions'
    ]
  });
  return results;
}

async function checkAdditionalFiles(domain: string): Promise<{ robots: CheckResult, sitemap: CheckResult, llms: CheckResult }> {
  const baseUrl = domain.startsWith('http') ? domain : `https://${domain}`;
  const cleanUrl = new URL(baseUrl).origin;

  // Helper function to fetch with timeout
  const fetchWithTimeout = async (url: string, timeout = 3000) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  };

  // Define default results
  let robotsCheck: CheckResult = {
    id: 'robots-txt',
    label: 'Robots.txt',
    status: 'fail',
    score: 0,
    details: 'No robots.txt file found',
    recommendation: 'Create a robots.txt file with AI crawler directives'
  };

  let sitemapCheck: CheckResult = {
    id: 'sitemap',
    label: 'Sitemap',
    status: 'fail',
    score: 0,
    details: 'No sitemap.xml found',
    recommendation: 'Generate and submit an XML sitemap'
  };

  let llmsCheck: CheckResult = {
    id: 'llms-txt',
    label: 'LLMs.txt',
    status: 'fail',
    score: 0,
    details: 'No llms.txt file found',
    recommendation: 'Add an llms.txt file to define AI usage permissions'
  };

  // Store robots.txt content for sitemap extraction
  let robotsText = '';
  let sitemapUrls: string[] = [];

  // Create all fetch promises in parallel
  const promises = [
    // Check robots.txt
    fetchWithTimeout(`${cleanUrl}/robots.txt`)
      .then(async (response) => {
        if (response.ok) {
          robotsText = await response.text();
          const hasUserAgent = robotsText.toLowerCase().includes('user-agent');

          // Extract sitemap URLs from robots.txt
          const sitemapMatches = robotsText.match(/Sitemap:\s*(.+)/gi);
          if (sitemapMatches) {
            sitemapUrls = sitemapMatches.map(match =>
              match.replace(/Sitemap:\s*/i, '').trim()
            );
          }

          const hasSitemap = sitemapUrls.length > 0;
          const score = (hasUserAgent ? 60 : 0) + (hasSitemap ? 40 : 0);

          robotsCheck = {
            id: 'robots-txt',
            label: 'Robots.txt',
            status: score >= 80 ? 'pass' : score >= 40 ? 'warning' : 'fail',
            score,
            details: `Robots.txt found${hasSitemap ? ` with ${sitemapUrls.length} sitemap reference(s)` : ''}`,
            recommendation: score < 80 ? 'Add sitemap reference to robots.txt' : 'Robots.txt properly configured'
          };
        }
      })
      .catch(() => {}), // Ignore errors, use default

    // Check llms.txt variations in parallel
    ...['llms.txt', 'LLMs.txt', 'llms-full.txt'].map(filename =>
      fetchWithTimeout(`${cleanUrl}/${filename}`)
        .then(async (response) => {
          if (response.ok) {
            const llmsText = await response.text();
            // Verify it's actually an LLMs.txt file, not a 404 page or HTML
            const isValidLlms = (
              llmsText.length > 10 && // Has some content
              !llmsText.includes('<!DOCTYPE') &&
              !llmsText.includes('<html') &&
              !llmsText.includes('<HTML') &&
              !llmsText.toLowerCase().includes('404 not found') &&
              !llmsText.toLowerCase().includes('page not found') &&
              !llmsText.toLowerCase().includes('cannot be found')
            );

            if (isValidLlms) {
              llmsCheck = {
                id: 'llms-txt',
                label: 'LLMs.txt',
                status: 'pass',
                score: 100,
                details: `${filename} file found with AI usage guidelines`,
                recommendation: 'Great! You have defined AI usage permissions'
              };
            }
          }
        })
        .catch(() => {}) // Ignore errors
    )
  ];

  // Wait for all promises to complete (with timeout)
  await Promise.all(promises);

  // After checking robots.txt, now check for sitemaps
  // First check URLs from robots.txt, then fallback to common locations
  const possibleSitemapUrls = [...sitemapUrls];

  // Add common sitemap locations if not already in list
  const commonLocations = [
    `${cleanUrl}/sitemap.xml`,
    `${cleanUrl}/sitemap_index.xml`,
    `${cleanUrl}/sitemap-index.xml`,
    `${cleanUrl}/sitemaps/sitemap.xml`,
    `${cleanUrl}/sitemap/sitemap.xml`
  ];

  for (const url of commonLocations) {
    if (!possibleSitemapUrls.includes(url)) {
      possibleSitemapUrls.push(url);
    }
  }

  // Check all possible sitemap URLs
  for (const sitemapUrl of possibleSitemapUrls) {
    try {
      const response = await fetchWithTimeout(sitemapUrl);
      if (response.ok) {
        const content = await response.text();
        // Verify it's actually an XML sitemap
        const isValidSitemap = (
          content.includes('<?xml') ||
          content.includes('<urlset') ||
          content.includes('<sitemapindex') ||
          content.includes('<url>') ||
          content.includes('<sitemap>')
        ) && !content.includes('<!DOCTYPE html');

        if (isValidSitemap) {
          const fromRobots = sitemapUrls.includes(sitemapUrl);
          sitemapCheck = {
            id: 'sitemap',
            label: 'Sitemap',
            status: 'pass',
            score: 100,
            details: `Valid XML sitemap found${fromRobots ? ' (referenced in robots.txt)' : ` at ${sitemapUrl.replace(cleanUrl, '')}`}`,
            recommendation: 'Sitemap is properly configured'
          };
          break; // Found a valid sitemap, stop checking
        }
      }
    } catch (error) {
      // Continue checking other URLs
    }
  }

  return { robots: robotsCheck, sitemap: sitemapCheck, llms: llmsCheck };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const signedAnalysis = await verifySignedAnalysisParams({
      url: body.url,
      expires: body.expires,
      signature: body.signature,
    });

    if (!signedAnalysis.ok || !signedAnalysis.url) {
      return NextResponse.json(
        { error: signedAnalysis.error || 'A valid signed analysis link is required' },
        { status: signedAnalysis.status || 401 }
      );
    }

    const url = signedAnalysis.url;
    const cacheKey = getReportCacheKey({
      url,
      expires: body.expires,
      signature: body.signature,
    });
    const cachedReport = await readCachedReport(cacheKey);

    if (cachedReport) {
      console.log(`[AI-READY] Cache hit for ${new URL(url).hostname.toLowerCase()}`);
      return NextResponse.json(cachedReport);
    }

    const existingJob = inFlightReports.get(cacheKey);
    if (existingJob) {
      console.log(`[AI-READY] Reusing in-flight analysis for ${new URL(url).hostname.toLowerCase()}`);
      return NextResponse.json(await existingJob);
    }

    const analysisJob = runAnalysis(url, cacheKey);
    inFlightReports.set(cacheKey, analysisJob);

    try {
      return NextResponse.json(await analysisJob);
    } finally {
      inFlightReports.delete(cacheKey);
    }

  } catch (error) {
    console.error('AI Readiness analysis error:', error);
    return NextResponse.json(
      { error: error instanceof AnalysisRunError ? error.message : 'Failed to analyze website' },
      { status: error instanceof AnalysisRunError ? error.status : 500 }
    );
  }
}

async function runAnalysis(url: string, cacheKey: string): Promise<AiReadinessResponse> {
    console.log('[AI-READY] Step 1/4: Starting site snapshot...');
    const scrapeStartTime = Date.now();

    // Capture the target page HTML through the configured scraping provider.
    let scrapeResult;
    try {
      scrapeResult = await scrapeProvider.scrape(url, {
        formats: ['html'],
      });
      console.log(`[AI-READY] Step 1/4: Site snapshot completed in ${Date.now() - scrapeStartTime}ms`);
    } catch (scrapeError) {
      console.error('Site snapshot error:', scrapeError);
      throw new AnalysisRunError('Failed to scrape website. Please check the URL.');
    }

    // Check different possible response structures
    const html = scrapeResult?.html || scrapeResult?.data?.html || scrapeResult?.content || '';
    const metadata = scrapeResult?.metadata || scrapeResult?.data?.metadata || {};

    if (!html) {
      console.error('No HTML content found in response');
      throw new AnalysisRunError('Failed to extract content from website');
    }

    console.log('[AI-READY] Step 2/4: Analyzing HTML content...');
    const htmlStartTime = Date.now();

    // Analyze the HTML
    const htmlChecks = await analyzeHTML(html, metadata, url);
    console.log(`[AI-READY] Step 2/4: HTML analysis completed in ${Date.now() - htmlStartTime}ms`);

    console.log('[AI-READY] Step 3/4: Checking robots.txt, sitemap.xml, llms.txt...');
    const filesStartTime = Date.now();

    // Check additional files
    const fileChecks = await checkAdditionalFiles(url);
    console.log(`[AI-READY] Step 3/4: File checks completed in ${Date.now() - filesStartTime}ms`);

    console.log('[AI-READY] Step 4/4: Calculating final scores...');
    const scoreStartTime = Date.now();

    // Combine all checks
    const allChecks = [
      fileChecks.llms,
      fileChecks.robots,
      fileChecks.sitemap,
      ...htmlChecks
    ];

    const domain = new URL(url).hostname.toLowerCase();
    const scoring = calculateIndustrialReadinessScore(allChecks);
    const overallScore = scoring.score;

    console.log(`[AI-READY] Step 4/4: Score calculation completed in ${Date.now() - scoreStartTime}ms`);
    console.log(`[AI-READY] Final scoring for ${domain}: final=${overallScore}, categoryScores=${JSON.stringify(scoring.categoryScores)}, appliedCaps=${JSON.stringify(scoring.appliedCaps)}`);
    console.log(`[AI-READY] Total analysis time: ${Date.now() - scrapeStartTime}ms`);

    const response: AiReadinessResponse = {
      success: true,
      url,
      overallScore,
      checks: allChecks,
      htmlContent: html.substring(0, 10000), // Limit HTML for client transfer
      metadata: {
        title: metadata.title,
        description: metadata.description,
        analyzedAt: new Date().toISOString(),
        scoreBreakdown: scoring.categoryScores,
        scoreCaps: scoring.appliedCaps
      }
    };

    try {
      await writeCachedReport(cacheKey, response);
    } catch (cacheError) {
      console.error('Failed to write AI readiness cache:', cacheError);
    }

    return response;
  }
