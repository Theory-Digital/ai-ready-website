"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  Globe,
  FileText,
  Code,
  Shield,
  Search,
  Zap,
  Database,
  Lock,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertCircle,
  Bot,
  Sparkles,
  FileCode,
  Network,
  Info,
  Eye,
  MapPin,
  Wrench,
  PackageCheck,
  ClipboardCheck,
  Building2
} from "lucide-react";
import { useEffect, useState } from "react";
import ScoreChart from "./ScoreChart";
import RadarChart from "./RadarChart";
import MetricBars from "./MetricBars";

interface ControlPanelProps {
  isAnalyzing: boolean;
  showResults: boolean;
  url: string;
  analysisData?: any;
  onReset: () => void;
}

interface CheckItem {
  id: string;
  label: string;
  description: string;
  icon: any;
  status: 'pending' | 'checking' | 'pass' | 'fail' | 'warning';
  score?: number;
  details?: string;
  recommendation?: string;
  actionItems?: string[];
  tooltip?: string;
}

export default function ControlPanel({
  isAnalyzing,
  showResults,
  url,
  analysisData,
  onReset,
}: ControlPanelProps) {
  const [showAIAnalysis, setShowAIAnalysis] = useState(false);
  const [aiInsights, setAiInsights] = useState<CheckItem[]>([]);
  const [isAnalyzingAI, setIsAnalyzingAI] = useState(false);
  const [combinedChecks, setCombinedChecks] = useState<CheckItem[]>([]);
  const [checks, setChecks] = useState<CheckItem[]>([
    {
      id: 'heading-structure',
      label: 'Heading Hierarchy',
      description: 'H1-H6 structure',
      icon: FileText,
      status: 'pending',
    },
    {
      id: 'readability',
      label: 'Readability',
      description: 'Content clarity',
      icon: Globe,
      status: 'pending',
    },
    {
      id: 'meta-tags',
      label: 'Metadata Quality',
      description: 'Title, desc, author',
      icon: FileCode,
      status: 'pending',
    },
    {
      id: 'semantic-html',
      label: 'Semantic HTML',
      description: 'Proper HTML5 tags',
      icon: Code,
      status: 'pending',
    },
    {
      id: 'accessibility',
      label: 'Accessibility',
      description: 'Alt text & ARIA',
      icon: Eye,
      status: 'pending',
    },
    {
      id: 'llms-txt',
      label: 'LLMs.txt',
      description: 'AI permissions',
      icon: Bot,
      status: 'pending',
    },
    {
      id: 'robots-txt',
      label: 'Robots.txt',
      description: 'Crawler rules',
      icon: Shield,
      status: 'pending',
    },
    {
      id: 'sitemap',
      label: 'Sitemap',
      description: 'Site structure',
      icon: Network,
      status: 'pending',
    },
    {
      id: 'local-industrial-schema',
      label: 'Local Entity Schema',
      description: 'Nisku business identity',
      icon: MapPin,
      status: 'pending',
    },
    {
      id: 'industrial-services',
      label: 'Industrial Services',
      description: 'Capabilities & service area',
      icon: Wrench,
      status: 'pending',
    },
    {
      id: 'equipment-product-data',
      label: 'Equipment & Product Data',
      description: 'Specs, rentals, parts',
      icon: PackageCheck,
      status: 'pending',
    },
    {
      id: 'certifications-safety',
      label: 'Safety & Certifications',
      description: 'Compliance signals',
      icon: ClipboardCheck,
      status: 'pending',
    },
    {
      id: 'procurement-readiness',
      label: 'Buyer Path',
      description: 'Quote and contact path',
      icon: Building2,
      status: 'pending',
    },
  ]);

  const [overallScore, setOverallScore] = useState(0);
  const [currentCheckIndex, setCurrentCheckIndex] = useState(-1);
  const [selectedCheck, setSelectedCheck] = useState<string | null>(null);
  const [hoveredCheck, setHoveredCheck] = useState<string | null>(null);
  const [resultsTab, setResultsTab] = useState<'overview' | 'advanced'>('overview');
  const [viewMode, setViewMode] = useState<'grid' | 'chart' | 'bars'>('grid');
  const getDisplayLabel = (check: Pick<CheckItem, 'id' | 'label'>) => {
    if (check.id === 'procurement-readiness') return 'Buyer Path';
    return check.label;
  };

  useEffect(() => {
    if (analysisData && analysisData.checks && showResults) {
      // Use real data from API
      const mappedChecks = analysisData.checks.map((check: any) => ({
        ...check,
        label: check.id === 'procurement-readiness' ? 'Buyer Path' : check.label,
        description: check.id === 'procurement-readiness'
          ? 'Quote and contact path'
          : check.details || checks.find(c => c.id === check.id)?.description,
        icon: checks.find(c => c.id === check.id)?.icon || FileText,
      }));
      setChecks(mappedChecks);
      setCombinedChecks(mappedChecks); // Initialize with basic checks
      setOverallScore(analysisData.overallScore || 0);
      setCurrentCheckIndex(-1);

      // If AI analysis should auto-start, handle the promise
      if (analysisData.autoStartAI && analysisData.aiAnalysisPromise) {
        console.log('Auto-starting AI analysis with promise');
        setIsAnalyzingAI(true);
        setShowAIAnalysis(true);

        // Add placeholder AI tiles immediately with actual titles
        const placeholderAIChecks = [
          {
            id: 'ai-loading-0',
            label: 'Content Quality for AI',
            description: 'Analyzing content signal ratio...',
            icon: Sparkles,
            status: 'checking' as const,
            score: 0,
            isAI: true,
            isLoading: true
          },
          {
            id: 'ai-loading-1',
            label: 'Information Architecture',
            description: 'Evaluating page structure...',
            icon: Bot,
            status: 'checking' as const,
            score: 0,
            isAI: true,
            isLoading: true
          },
          {
            id: 'ai-loading-2',
            label: 'Crawlability Patterns',
            description: 'Checking JavaScript usage...',
            icon: Database,
            status: 'checking' as const,
            score: 0,
            isAI: true,
            isLoading: true
          },
          {
            id: 'ai-loading-3',
            label: 'AI Training Value',
            description: 'Assessing training potential...',
            icon: Network,
            status: 'checking' as const,
            score: 0,
            isAI: true,
            isLoading: true
          },
          {
            id: 'ai-loading-4',
            label: 'Knowledge Extraction',
            description: 'Analyzing entity definitions...',
            icon: FileCode,
            status: 'checking' as const,
            score: 0,
            isAI: true,
            isLoading: true
          },
          {
            id: 'ai-loading-5',
            label: 'Template Quality',
            description: 'Reviewing semantic structure...',
            icon: Shield,
            status: 'checking' as const,
            score: 0,
            isAI: true,
            isLoading: true
          },
          {
            id: 'ai-loading-6',
            label: 'Content Depth',
            description: 'Measuring content richness...',
            icon: Zap,
            status: 'checking' as const,
            score: 0,
            isAI: true,
            isLoading: true
          },
          {
            id: 'ai-loading-7',
            label: 'Machine Readability',
            description: 'Testing extraction reliability...',
            icon: Globe,
            status: 'checking' as const,
            score: 0,
            isAI: true,
            isLoading: true
          }
        ];

        // Add loading AI tiles with staggered animation
        placeholderAIChecks.forEach((check, idx) => {
          setTimeout(() => {
            setCombinedChecks(prev => [...prev, check]);
          }, 100 * (idx + 1));
        });

        // Handle the AI analysis promise
        analysisData.aiAnalysisPromise
          .then(async (aiResponse: any) => {
            if (aiResponse) {
              const data = await aiResponse.json();
              if (data.success && data.insights) {
                // Convert AI insights to CheckItem format
                const aiChecks: CheckItem[] = data.insights.map((insight: any, idx: number) => ({
                  ...insight,
                  icon: [Sparkles, Bot, Database, Network, FileCode, Shield, Zap, Globe][idx % 8],
                  description: insight.details?.substring(0, 60) + '...' || 'AI Analysis',
                  isAI: true,
                }));

                setAiInsights(aiChecks);

                // Replace loading tiles with real AI tiles
                setCombinedChecks(prev => {
                  // Remove loading tiles
                  const withoutLoading = prev.filter(c => !(c as any).isLoading);
                  // Add real AI tiles
                  return [...withoutLoading, ...aiChecks];
                });
              }
            }
          })
          .catch(error => {
            console.error('AI analysis error:', error);
            // Remove loading tiles on error
            setCombinedChecks(prev => prev.filter(c => !(c as any).isLoading));
          })
          .finally(() => {
            setIsAnalyzingAI(false);
          });
      }
    } else if (isAnalyzing) {
      // Reset all checks when starting analysis
      const resetChecks = checks.map(check => ({ ...check, status: 'pending' as const }));
      setChecks(resetChecks);
      setCombinedChecks(resetChecks); // Reset combined checks too
      setCurrentCheckIndex(0);
      setOverallScore(0);

      // Visual animation while waiting for real results
      const checkInterval = setInterval(() => {
        setCurrentCheckIndex(prev => {
          if (prev >= checks.length - 1) {
            clearInterval(checkInterval);
            return prev;
          }
          return prev + 1;
        });
      }, 200);

      return () => clearInterval(checkInterval);
    }
  }, [isAnalyzing, showResults, analysisData]);

  useEffect(() => {
    if (currentCheckIndex >= 0 && currentCheckIndex < checks.length && isAnalyzing) {
      // Mark current as checking during animation
      setChecks(prev => prev.map((check, index) => {
        if (index === currentCheckIndex) {
          return { ...check, status: 'checking' };
        }
        if (index < currentCheckIndex) {
          return { ...check, status: 'checking' };
        }
        return check;
      }));

      // Update combinedChecks to show the animation
      setCombinedChecks(prev => prev.map((check, index) => {
        if (index === currentCheckIndex) {
          return { ...check, status: 'checking' };
        }
        if (index < currentCheckIndex) {
          return { ...check, status: 'checking' };
        }
        return check;
      }));
    }
  }, [currentCheckIndex, checks.length, isAnalyzing]);

  const getStatusIcon = (status: CheckItem['status']) => {
    switch (status) {
      case 'checking':
        return <Loader2 className="w-16 h-16 text-heat-100 animate-spin" />;
      case 'pass':
        return <CheckCircle2 className="w-16 h-16 text-emerald-700" />;
      case 'fail':
        return <XCircle className="w-16 h-16 text-red-700" />;
      case 'warning':
        return <AlertCircle className="w-16 h-16 text-amber-700" />;
      default:
        return <div className="w-16 h-16 rounded-full border border-black-alpha-8" />;
    }
  };

  const getStatusCardClasses = (status: CheckItem['status'], isActive: boolean, isAI: boolean, isLoading: boolean) => {
    if (isLoading || status === 'checking') {
      return 'bg-[#FFF7CC] border-[#FFD100] shadow-sm';
    }

    if (status === 'pass') {
      return 'bg-green-100 border-green-500 hover:bg-green-200/70';
    }

    if (status === 'warning') {
      return 'bg-yellow-100 border-yellow-500 hover:bg-yellow-200/70';
    }

    if (status === 'fail') {
      return 'bg-red-100 border-red-500 hover:bg-red-200/70';
    }

    if (isActive) {
      return 'bg-accent-white border-heat-100 shadow-lg';
    }

    return isAI
      ? 'bg-accent-white border-heat-100 border-opacity-40'
      : 'bg-accent-white border-black-alpha-8';
  };

  const getStatusBarClasses = (status: CheckItem['status']) => {
    if (status === 'pass') return 'bg-emerald-500';
    if (status === 'warning') return 'bg-amber-500';
    if (status === 'fail') return 'bg-red-500';
    return 'bg-heat-100';
  };

  const getBreakdownTextColor = (score: number) => {
    if (score >= 80) return 'text-emerald-700';
    if (score >= 50) return 'text-amber-700';
    return 'text-red-700';
  };

  const scoreBreakdown = analysisData?.metadata?.scoreBreakdown;
  const scoreCaps = analysisData?.metadata?.scoreCaps || [];
  const scoreBreakdownItems = scoreBreakdown ? [
    { label: 'Buyer clarity', value: scoreBreakdown.buyerReadiness },
    { label: 'AI-readable info', value: scoreBreakdown.structuredData },
    { label: 'Findability basics', value: scoreBreakdown.crawlBasics },
    { label: 'Page clarity', value: scoreBreakdown.contentClarity },
  ] : [];

  const visibleScore = overallScore;
  const findCheck = (id: string) => combinedChecks.find(check => check.id === id);
  const findCheckScore = (id: string) => findCheck(id)?.score || 0;
  const formatCheckEvidence = (check?: CheckItem) => {
    if (!check) return '';

    const score = typeof check.score === 'number' ? `${check.score}%` : 'not scored';
    const details = check.details ? `: ${check.details}` : '';

    return `${getDisplayLabel(check)} scored ${score}${details}`;
  };
  const formatCheckScore = (check?: CheckItem) => {
    if (!check) return '';

    const score = typeof check.score === 'number' ? `${check.score}%` : 'not scored';

    return `${getDisplayLabel(check)} (${score})`;
  };

  const impactDefinitions = [
    {
      id: 'procurement-readiness',
      low: 'A buyer who is ready to ask for pricing may have to hunt for the quote path, phone, email, industries served, or project proof before they can act.',
      mid: 'The lead path exists, but it is not strong enough for a buyer or AI summary to confidently describe the next step.',
      high: 'Buyers and AI systems can identify the quote/contact path without much guesswork.',
    },
    {
      id: 'industrial-services',
      low: 'AI systems may see the company name but still be unable to classify the actual services, capabilities, and service area.',
      mid: 'The site gives some service clues, but the capability story can still be summarized too broadly or inaccurately.',
      high: 'The core services are clear enough to classify and summarize.',
    },
    {
      id: 'local-industrial-schema',
      low: 'For local searches around Nisku, Leduc County, Edmonton, or Alberta, there is weak structured proof tying the company to the right place.',
      mid: 'Local identity is partly visible, but the business entity and service-area signals are incomplete.',
      high: 'The business identity and local service area are easy to extract.',
    },
    {
      id: 'certifications-safety',
      low: 'Buyers may not see the safety, compliance, insurance, or certification proof they use to shortlist lower-risk vendors.',
      mid: 'Some trust signals are present, but they are not complete or structured enough to carry the comparison.',
      high: 'Safety and compliance proof is visible enough to support buyer trust.',
    },
    {
      id: 'equipment-product-data',
      low: 'If buyers need equipment, rental, part, or spec details, AI systems have little structured data to match the company to that need.',
      mid: 'There are some product or spec clues, but the data is not complete enough for reliable matching.',
      high: 'Equipment, product, or spec details are structured enough to support buyer research.',
    },
  ];

  const scoredImpactDefinitions = impactDefinitions
    .map(definition => ({
      ...definition,
      check: findCheck(definition.id),
      score: findCheckScore(definition.id),
    }))
    .filter(item => item.check)
    .sort((a, b) => a.score - b.score);

  const scoreMeaning = visibleScore >= 80
    ? {
        label: 'Strong',
        headline: 'Buyers and AI systems can understand this business.',
        body: 'The site gives clear signals about what the company does, where it works, and how someone should take the next step.',
        tone: 'text-emerald-700',
        bg: 'bg-green-100 border-green-500',
      }
    : visibleScore >= 50
      ? {
          label: 'Needs work',
          headline: 'The company is visible, but the story is incomplete.',
          body: 'People and AI systems can find some useful information, but important buyer signals are missing or not obvious enough.',
          tone: 'text-amber-700',
          bg: 'bg-yellow-100 border-yellow-500',
        }
      : {
          label: 'At risk',
          headline: 'AI systems and buyers are likely missing the full picture.',
          body: 'The site may load and look fine, but it does not clearly explain the company in the way buyers, search engines, and AI assistants need.',
          tone: 'text-red-700',
          bg: 'bg-red-100 border-red-500',
        };

  const practicalImplications = scoredImpactDefinitions.length > 0
    ? scoredImpactDefinitions
        .slice(0, visibleScore >= 80 ? 3 : 4)
        .map(item => {
          const consequence = item.score >= 80 ? item.high : item.score >= 50 ? item.mid : item.low;
          return `${formatCheckEvidence(item.check)}. ${consequence}`;
        })
    : visibleScore >= 80
      ? [
          'The strongest signal is practical clarity: AI assistants are more likely to understand what the company does, where it serves, and how a buyer should act.',
          'Buyers can confirm capabilities, trust signals, and next steps without digging through the site.',
          'The site has a stronger chance of being summarized accurately in AI-driven search.',
        ]
      : visibleScore >= 50
        ? [
            'The impact is partial visibility: AI assistants may mention the company, but important buyer details can still be incomplete or too generic.',
            'Buyers may need to dig around to confirm services, location, certifications, or quote options.',
            'Competitors with clearer capability pages may look more credible in AI-generated answers.',
          ]
        : [
            'The impact is a confidence problem: AI systems and buyers do not have enough clear evidence to understand the company quickly.',
            'Missing service, location, trust, or quote signals can cause the company to be overlooked in comparison-heavy research.',
            'A competitor with clearer services and quote paths can look like the safer choice.',
          ];

  const priorityFixes = [
    findCheckScore('industrial-services') < 80 && `${formatCheckScore(findCheck('industrial-services'))}: State the main services and capabilities in plain language.`,
    findCheckScore('procurement-readiness') < 80 && `${formatCheckScore(findCheck('procurement-readiness'))}: Make the quote/contact path obvious for buyers.`,
    findCheckScore('local-industrial-schema') < 80 && `${formatCheckScore(findCheck('local-industrial-schema'))}: Make the service area clear: Nisku, Leduc County, Edmonton, Alberta, or Western Canada.`,
    findCheckScore('certifications-safety') < 80 && `${formatCheckScore(findCheck('certifications-safety'))}: Show safety, compliance, insurance, and certification proof where buyers can see it.`,
    findCheckScore('equipment-product-data') < 80 && `${formatCheckScore(findCheck('equipment-product-data'))}: Add equipment, product, rental, part, or spec details where relevant.`,
  ].filter(Boolean).slice(0, 4) as string[];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.5 }}
      className="w-full max-w-[1200px] mx-auto"
    >
      {/* Header */}
      <motion.div
        className="text-center mb-48 pt-24 md:pt-0"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <h2 className="ninety-display text-title-h2 text-accent-black mb-12">The Ninety AI Report</h2>
        <p className="text-body-large text-black-alpha-64">Single-page snapshot of {url}</p>

        {showResults && (
          <>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", delay: 0.5 }}
              className="flex justify-center mt-28"
            >
              <ScoreChart
                score={visibleScore}
                size={180}
              />
            </motion.div>

            {scoreBreakdownItems.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.65 }}
                className="mt-18 flex flex-wrap justify-center gap-8"
              >
                {scoreBreakdownItems.map(item => (
                  <div
                    key={item.label}
                    className="px-10 py-6 rounded-8 bg-accent-white border border-black-alpha-8 text-label-small"
                  >
                    <span className="text-black-alpha-48">{item.label}</span>
                    <span className={`ml-6 font-medium ${getBreakdownTextColor(item.value)}`}>
                      {item.value}%
                    </span>
                  </div>
                ))}
              </motion.div>
            )}

            {scoreCaps.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.75 }}
                className="mt-10 text-label-small text-red-700"
              >
                Score capped: {scoreCaps.join('; ')}
              </motion.div>
            )}

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              className="mt-24 flex justify-center gap-4"
            >
              <button
                onClick={() => setResultsTab('overview')}
                className={`px-18 py-9 rounded-8 text-label-medium font-medium transition-all ${
                  resultsTab === 'overview'
                    ? 'bg-accent-black text-white shadow-md'
                    : 'bg-black-alpha-4 text-black-alpha-64 hover:bg-black-alpha-8'
                }`}
              >
                What It Means
              </button>
              <button
                onClick={() => setResultsTab('advanced')}
                className={`px-18 py-9 rounded-8 text-label-medium font-medium transition-all ${
                  resultsTab === 'advanced'
                    ? 'bg-accent-black text-white shadow-md'
                    : 'bg-black-alpha-4 text-black-alpha-64 hover:bg-black-alpha-8'
                }`}
              >
                Technical Details
              </button>
            </motion.div>
          </>
        )}
      </motion.div>

      {showResults && resultsTab === 'overview' && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="max-w-[920px] mx-auto px-20 mb-40"
        >
          <div className={`rounded-8 border-2 p-24 md:p-28 ${scoreMeaning.bg}`}>
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-18">
              <div className="text-left">
                <div className={`text-label-large font-medium mb-8 ${scoreMeaning.tone}`}>
                  {scoreMeaning.label} at {visibleScore}%
                </div>
                <h3 className="text-title-h3 text-accent-black mb-10">
                  {scoreMeaning.headline}
                </h3>
                <p className="text-body-medium text-black-alpha-64 max-w-[680px]">
                  {scoreMeaning.body}
                </p>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-12 mt-12">
            <div className="rounded-8 border border-black-alpha-8 bg-accent-white p-20 text-left">
              <h3 className="text-label-large text-accent-black font-medium mb-12">
                Practical impact
              </h3>
              <ul className="space-y-10">
                {practicalImplications.map(item => (
                  <li key={item} className="flex gap-8 text-body-small text-black-alpha-64">
                    <span className={`mt-6 h-6 w-6 rounded-full flex-none ${visibleScore >= 80 ? 'bg-emerald-500' : visibleScore >= 50 ? 'bg-amber-500' : 'bg-red-500'}`} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-8 border border-black-alpha-8 bg-accent-white p-20 text-left">
              <h3 className="text-label-large text-accent-black font-medium mb-12">
                Fix first
              </h3>
              <ul className="space-y-10">
                {priorityFixes.map(item => (
                  <li key={item} className="flex gap-8 text-body-small text-black-alpha-64">
                    <span className="mt-6 h-6 w-6 rounded-full bg-accent-black flex-none" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </motion.div>
      )}

      {showResults && resultsTab === 'advanced' && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-24 flex justify-center gap-4"
        >
          <button
            onClick={() => setViewMode('grid')}
            className={`px-16 py-8 rounded-8 text-label-medium font-medium transition-all ${
              viewMode === 'grid'
                ? 'bg-accent-black text-white shadow-md'
                : 'bg-black-alpha-4 text-black-alpha-64 hover:bg-black-alpha-8'
            }`}
          >
            Grid View
          </button>
          <button
            onClick={() => setViewMode('chart')}
            className={`px-16 py-8 rounded-8 text-label-medium font-medium transition-all ${
              viewMode === 'chart'
                ? 'bg-accent-black text-white shadow-md'
                : 'bg-black-alpha-4 text-black-alpha-64 hover:bg-black-alpha-8'
            }`}
          >
            Radar Chart
          </button>
          <button
            onClick={() => setViewMode('bars')}
            className={`px-16 py-8 rounded-8 text-label-medium font-medium transition-all ${
              viewMode === 'bars'
                ? 'bg-accent-black text-white shadow-md'
                : 'bg-black-alpha-4 text-black-alpha-64 hover:bg-black-alpha-8'
            }`}
          >
            Bar Chart
          </button>
        </motion.div>
      )}

      {/* Conditional rendering based on view mode */}
      {resultsTab === 'advanced' && viewMode === 'grid' && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-12 mb-40 px-40 relative">
          {combinedChecks.map((check, index) => {
            const isActive = index === currentCheckIndex;

            return (
              <motion.div
                key={check.id}
                initial={(check as any).isAI ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.9 }}
                animate={{
                  opacity: 1,
                  scale: isActive ? 1.05 : 1,
                }}
                transition={{
                  delay: (check as any).isAI ? 0 : index * 0.1,
                  scale: { type: "spring", stiffness: 300 }
                }}
                className={`
                  relative p-16 rounded-8 transition-all border-2
                  ${getStatusCardClasses(check.status, isActive, Boolean((check as any).isAI), Boolean((check as any).isLoading))}
                  ${isActive ? 'shadow-lg' : ''}
                  ${check.status !== 'pending' && check.status !== 'checking' ? 'cursor-pointer hover:shadow-md' : ''}
                  ${(check as any).isLoading ? 'animate-pulse' : ''}
                `}
                onClick={() => {
                  if (check.status !== 'pending' && check.status !== 'checking') {
                    setSelectedCheck(selectedCheck === check.id ? null : check.id);
                  }
                }}
                onMouseEnter={() => setHoveredCheck(check.id)}
                onMouseLeave={() => setHoveredCheck(null)}
              >
                <div className="relative">
                  <div className="flex items-start justify-end mb-12">
                    {getStatusIcon(check.status)}
                  </div>

                  <h3 className="text-label-large mb-4 text-accent-black font-medium flex items-center gap-6">
                    {check.label}
                    {check.tooltip && !aiInsights.some(ai => ai.id === check.id) && (
                      <div className="relative inline-block">
                        <Info className="w-14 h-14 text-black-alpha-32 hover:text-black-alpha-64 transition-colors" />
                        <AnimatePresence>
                          {hoveredCheck === check.id && (
                            <motion.div
                              initial={{ opacity: 0, y: 5 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: 5 }}
                              className="absolute bottom-full left-1/2 -translate-x-1/2 mb-8 w-200 p-8 bg-accent-black text-white text-body-x-small rounded-6 shadow-lg z-50 pointer-events-none"
                            >
                              {check.tooltip}
                              <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-accent-black" />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}
                  </h3>

                  <p className="text-body-small text-black-alpha-64">
                    {check.description}
                  </p>

                  {check.status !== 'pending' && check.status !== 'checking' && (
                    <>
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-8"
                      >
                        <div className="h-2 bg-black-alpha-4 rounded-full overflow-hidden">
                          <motion.div
                            className={`
                              h-full rounded-full
                              ${getStatusBarClasses(check.status)}
                            `}
                            initial={{ width: 0 }}
                            animate={{ width: `${check.score}%` }}
                            transition={{ duration: 0.5 }}
                          />
                        </div>
                      </motion.div>
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.5 }}
                        className="text-label-x-small text-black-alpha-32 mt-4 text-center"
                      >
                        Click for details
                      </motion.div>
                    </>
                  )}
                </div>

                {/* Expanded Details */}
                <AnimatePresence>
                  {selectedCheck === check.id && check.details && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                      className="mt-12 pt-12 border-t border-black-alpha-8"
                    >
                      <div className="space-y-6">
                        <div>
                          <div className="text-label-small text-black-alpha-48 mb-2">Status</div>
                          <div className="text-body-small text-accent-black">{check.details}</div>
                        </div>
                        <div>
                          <div className="text-label-small text-black-alpha-48 mb-2">Recommendation</div>
                          <div className="text-body-small text-black-alpha-64">{check.recommendation}</div>
                          {check.actionItems && check.actionItems.length > 0 && (
                            <ul className="mt-4 space-y-2">
                              {check.actionItems.map((item: string, i: number) => (
                                <li key={i} className="flex items-start gap-6 text-body-small text-black-alpha-64">
                                  <span className="text-heat-100 mt-1">•</span>
                                  <span>{item}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Radar Chart View */}
      {resultsTab === 'advanced' && viewMode === 'chart' && showResults && (
        <div>
          <motion.div
            className="flex justify-center gap-40 mb-40"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
          >
            {/* Basic Analysis Chart */}
            <div className="flex flex-col items-center">
              <h3 className="text-label-large text-accent-black mb-16 font-medium">Basic Analysis</h3>
              <RadarChart
                data={checks
                  .filter(check => check.status !== 'pending' && check.status !== 'checking')
                  .slice(0, 8)
                  .map(check => ({
                    label: check.label.length > 12 ? check.label.substring(0, 12) + '...' : check.label,
                    score: check.score || 0
                  }))}
                size={350}
              />
              <div className="mt-16 text-center">
                <div className="text-title-h3 text-accent-black">{overallScore}%</div>
                <div className="text-label-small text-black-alpha-48">Overall Score</div>
              </div>
            </div>

            {/* AI Analysis Chart - Only show if AI insights exist */}
            {aiInsights.length > 0 && (
              <motion.div
                className="flex flex-col items-center"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
              >
                <h3 className="text-label-large text-heat-100 mb-16 font-medium">Deeper Analysis</h3>
                <RadarChart
                  data={aiInsights
                    .filter(check => check.status !== 'pending' && check.status !== 'checking')
                    .slice(0, 8)
                    .map(check => ({
                      label: check.label.length > 12 ? check.label.substring(0, 12) + '...' : check.label,
                      score: check.score || 0
                    }))}
                  size={350}
                />
              </motion.div>
            )}
          </motion.div>

          {/* Comparison Summary */}
          {aiInsights.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="text-center mb-20"
            >
              <div className="inline-flex items-center gap-8 px-16 py-8 bg-heat-4 rounded-8">
                <span className="text-label-medium text-accent-black">
                  AI analysis found {aiInsights.filter(i => i.score && i.score < 50).length} additional areas for improvement
                </span>
              </div>
            </motion.div>
          )}
        </div>
      )}

      {/* Bar Chart View */}
      {resultsTab === 'advanced' && viewMode === 'bars' && showResults && (
        <motion.div
          className="px-40 mb-40"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <MetricBars
            metrics={combinedChecks
              .filter(check => check.status !== 'pending' && check.status !== 'checking')
              .map(check => ({
                label: check.label,
                score: check.score || 0,
                status: check.status as 'pass' | 'warning' | 'fail',
                category: (check as any).isAI ? 'ai' :
                  ['robots-txt', 'sitemap', 'llms-txt'].includes(check.id) ? 'domain' : 'page',
                details: check.details,
                recommendation: check.recommendation,
                actionItems: check.actionItems
              }))}
          />
        </motion.div>
      )}

      {/* Action Buttons */}
      {showResults && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="flex gap-12 justify-center"
        >
          <button
            onClick={onReset}
            className="px-20 py-10 bg-accent-white border border-black-alpha-8 hover:bg-black-alpha-4 rounded-8 text-label-medium transition-all"
          >
            Rerun Report
          </button>
          {resultsTab === 'advanced' && (
            <button
              onClick={async () => {
              setIsAnalyzingAI(true);
              setShowAIAnalysis(true);

              // Add placeholder AI tiles immediately with actual titles
              const placeholderAIChecks = [
                {
                  id: 'ai-loading-0',
                  label: 'Content Quality for AI',
                  description: 'Analyzing content signal ratio...',
                  icon: Sparkles,
                  status: 'checking' as const,
                  score: 0,
                  isAI: true,
                  isLoading: true
                },
                {
                  id: 'ai-loading-1',
                  label: 'Information Architecture',
                  description: 'Evaluating page structure...',
                  icon: Bot,
                  status: 'checking' as const,
                  score: 0,
                  isAI: true,
                  isLoading: true
                },
                {
                  id: 'ai-loading-2',
                  label: 'Crawlability Patterns',
                  description: 'Checking JavaScript usage...',
                  icon: Database,
                  status: 'checking' as const,
                  score: 0,
                  isAI: true,
                  isLoading: true
                },
                {
                  id: 'ai-loading-3',
                  label: 'AI Training Value',
                  description: 'Assessing training potential...',
                  icon: Network,
                  status: 'checking' as const,
                  score: 0,
                  isAI: true,
                  isLoading: true
                },
                {
                  id: 'ai-loading-4',
                  label: 'Knowledge Extraction',
                  description: 'Analyzing entity definitions...',
                  icon: FileCode,
                  status: 'checking' as const,
                  score: 0,
                  isAI: true,
                  isLoading: true
                },
                {
                  id: 'ai-loading-5',
                  label: 'Template Quality',
                  description: 'Reviewing semantic structure...',
                  icon: Shield,
                  status: 'checking' as const,
                  score: 0,
                  isAI: true,
                  isLoading: true
                },
                {
                  id: 'ai-loading-6',
                  label: 'Content Depth',
                  description: 'Measuring content richness...',
                  icon: Zap,
                  status: 'checking' as const,
                  score: 0,
                  isAI: true,
                  isLoading: true
                },
                {
                  id: 'ai-loading-7',
                  label: 'Machine Readability',
                  description: 'Testing extraction reliability...',
                  icon: Globe,
                  status: 'checking' as const,
                  score: 0,
                  isAI: true,
                  isLoading: true
                }
              ];

              // Add loading AI tiles with staggered animation immediately
              placeholderAIChecks.forEach((check, idx) => {
                setTimeout(() => {
                  setCombinedChecks(prev => [...prev, check]);
                }, 100 * (idx + 1));
              });

              try {
                const response = await fetch('/api/ai-analysis', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    url,
                    expires: analysisData?.signedParams?.expires,
                    signature: analysisData?.signedParams?.signature,
                    htmlContent: analysisData?.htmlContent || '',
                    currentChecks: checks
                  })
                });

                const data = await response.json();
                if (data.success && data.insights) {
                  // Convert AI insights to CheckItem format with AI flag
                  const aiChecks: CheckItem[] = data.insights.map((insight: any, idx: number) => ({
                    ...insight,
                    icon: [Sparkles, Bot, Database, Network, FileCode, Shield, Zap, Globe][idx % 8],
                    description: insight.details?.substring(0, 60) + '...' || 'AI Analysis',
                    isAI: true, // Mark as AI-generated
                  }));

                  setAiInsights(aiChecks);

                  // Replace loading tiles with real AI tiles
                  setCombinedChecks(prev => {
                    // Remove loading tiles
                    const withoutLoading = prev.filter(c => !(c as any).isLoading);
                    // Add real AI tiles
                    return [...withoutLoading, ...aiChecks];
                  });
                }
              } catch (error) {
                console.error('AI analysis error:', error);
                // Remove loading tiles on error
                setCombinedChecks(prev => prev.filter(c => !(c as any).isLoading));
              } finally {
                setIsAnalyzingAI(false);
              }
            }}
            disabled={isAnalyzingAI}
            className="px-20 py-10 bg-accent-black hover:bg-black-alpha-80 text-white rounded-8 text-label-medium transition-all disabled:opacity-50"
          >
            {isAnalyzingAI ? 'Analyzing...' : 'Run Deeper Analysis'}
          </button>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}
