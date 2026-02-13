import React from 'react';
import { InfoTooltip } from '@/components/ui/info-tooltip';
import { BarChart3, TrendingUp, Search, Brain } from 'lucide-react';
import { getScoreCalculationMethod } from '@/lib/analysis/utils/ModelAttributionMapping';

// Define stat explanations and formulas
interface StatDefinition {
  title: string;
  description: string;
  formula?: string;
  example?: string;
}

const statDefinitions: Record<string, StatDefinition> = {
  'Markets analyzed': {
    title: 'Markets Analyzed',
    description: 'The total number of geographic areas (ZIP codes, counties, etc.) included in this analysis.',
    example: '984 ZIP codes analyzed across Florida'
  },
  'Areas analyzed': {
    title: 'Areas Analyzed',
    description: 'The total number of geographic areas included in this analysis.',
    example: '500 areas analyzed'
  },
  'Records analyzed': {
    title: 'Records Analyzed',
    description: 'The total number of data records processed in this analysis.',
    example: '1,250 records analyzed'
  },
  'Data points': {
    title: 'Data Points',
    description: 'The total number of individual data measurements included in the analysis.',
    example: '5,000 data points processed'
  },
  'Average difference': {
    title: 'Average Difference',
    description: 'The mean difference in market share between the two brands across all markets. Positive values indicate first brand advantage, negative values indicate second brand advantage.',
    formula: 'Σ(brand1_share - brand2_share) / n',
    example: '-8.37% means competitor has 8.37% higher average market share'
  },
  'Median difference': {
    title: 'Median Difference',
    description: 'The middle value when all market share differences are sorted. Less affected by extreme outliers than the average.',
    formula: 'Middle value of sorted differences',
    example: '-8.22% is the middle value of all differences'
  },
  'Average score': {
    title: 'Average Score',
    description: 'The arithmetic mean of all scores in the dataset. Provides a central tendency measure.',
    formula: 'Σ(scores) / n',
    example: '7.5/10 average across all markets'
  },
  'Median score': {
    title: 'Median Score',
    description: 'The middle value when all scores are sorted. More robust to outliers than the mean.',
    formula: 'Middle value of sorted scores',
    example: '7.8/10 is the middle score'
  },
  'Standard deviation': {
    title: 'Standard Deviation',
    description: 'Measures the spread or dispersion of values from the mean. Higher values indicate more variability.',
    formula: '√(Σ(x - μ)² / n)',
    example: '1.31% means most values are within ±1.31% of the average'
  },
  'Score range': {
    title: 'Score Range',
    description: 'The minimum and maximum scores in the dataset, showing the full spread of values.',
    example: '3.2 to 9.8 shows the full range of scores'
  },
  'Total population': {
    title: 'Total Population',
    description: 'The combined population across all analyzed areas.',
    formula: 'Σ(population per area)',
    example: '15.3M people across all markets'
  },
  'Total area': {
    title: 'Total Area',
    description: 'The combined geographic area in square miles across all analyzed regions.',
    formula: 'Σ(area in sq mi)',
    example: '12,450 sq mi total coverage'
  },
  'Difference range': {
    title: 'Difference Range',
    description: 'The minimum and maximum brand share differences in the dataset, showing the full competitive spread.',
    example: '-16.7% to 0.0% shows competitor advantages ranging from 0% to 16.7%'
  },
  'Quartiles': {
    title: 'Quartiles',
    description: 'Values that divide the dataset into four equal parts. Q1 (25th percentile), Q2 (median), Q3 (75th percentile).',
    formula: 'Q1=25th%, Q2=50th%, Q3=75th%',
    example: 'Q1=52.28, Q2=63.90, Q3=76.62 means 25% of areas score below 52.28'
  },
  'IQR': {
    title: 'Interquartile Range (IQR)',
    description: 'The range between the first and third quartiles, representing the middle 50% of the data.',
    formula: 'IQR = Q3 - Q1',
    example: 'IQR: 24.34 means the middle 50% of scores span 24.34 points'
  },
  'Outliers': {
    title: 'Outliers',
    description: 'Data points that are significantly different from other observations, typically beyond 1.5 × IQR from quartiles.',
    formula: 'Beyond Q1 - 1.5×IQR or Q3 + 1.5×IQR',
    example: 'None detected means all data points fall within normal range'
  },
  'Distribution shape': {
    title: 'Distribution Shape',
    description: 'The overall pattern of how data values are spread across the range.',
    example: 'Normal means bell-curved, skewed-left/right means asymmetric, bimodal means two peaks'
  },
  'Model Used': {
    title: 'Analysis Model',
    description: 'The specific analytical model used to generate these results and scores. Each model uses different calculation methods for optimal accuracy.',
    example: 'Strategic Analysis Model uses investment potential weighted by market factors, growth indicators, and competitive positioning'
  },
  'R² Score': {
    title: 'R-Squared Score',
    description: 'A statistical measure indicating how well the model explains the variance in the data (0-1 scale).',
    formula: 'R² = 1 - (SS_res / SS_tot)',
    example: '0.87 means the model explains 87% of the variance in the data'
  },
  'Confidence': {
    title: 'Model Confidence',
    description: 'The level of confidence in the model\'s predictions and results.',
    example: 'High confidence indicates reliable predictions based on strong data patterns'
  }
};

interface StatsWithInfoProps {
  content: string;
  className?: string;
  onZipCodeClick?: (zipCode: string) => void;
}

export const StatsWithInfo: React.FC<StatsWithInfoProps> = ({ content, className = '', onZipCodeClick }) => {
  // Parse the content to identify stats
  const lines = content.split('\n');
  
  return (
    <div className={`text-xs ${className}`}>
      {lines.map((line, index) => {
        // Check for section headers and render with appropriate icons
        const sectionMappings = [
          { keyword: 'Quick Statistics', icon: BarChart3 },
          { keyword: 'Brand Difference Statistics', icon: BarChart3 },
          { keyword: 'Distribution Analysis', icon: TrendingUp },
          { keyword: 'Key Patterns', icon: Search },
          { keyword: 'Competitive Patterns', icon: Search },
          { keyword: 'Analysis Statistics', icon: BarChart3 },
          { keyword: 'AI Analysis', icon: Brain }
        ];
        
        for (const { keyword, icon: Icon } of sectionMappings) {
          if (line.includes(`**${keyword}**`)) {
            // Extract the text without emoji
            const cleanText = line.replace(/[�-�][�-�]|[�-�]/g, '').trim();
            return (
              <div key={index} className="font-bold text-xs mt-3 mb-2 first:mt-0 flex items-center gap-1">
                <Icon className="w-3 h-3" />
                <span dangerouslySetInnerHTML={{ __html: formatLine(cleanText) }} />
              </div>
            );
          }
        }
        
        // Legacy emoji-based section detection for backward compatibility
        const isSection = line.includes('📈 **') || line.includes('📊 **') || line.includes('🔍 **') || line.includes('🤖 **');
        
        if (isSection) {
          // Extract keyword to determine icon
          let IconComponent = BarChart3; // default
          if (line.includes('Distribution')) IconComponent = TrendingUp;
          else if (line.includes('Patterns')) IconComponent = Search;
          else if (line.includes('AI Analysis')) IconComponent = Brain;
          
          // Remove emoji and render with icon
          const cleanText = line.replace(/[�-�][�-�]|[�-�]/g, '').trim();
          return (
            <div key={index} className="font-bold text-sm mt-3 mb-2 first:mt-0 flex items-center gap-1">
              <IconComponent className="w-3 h-3" />
              <span dangerouslySetInnerHTML={{ __html: formatLine(cleanText) }} />
            </div>
          );
        }
        
        // Check if this line contains a stat with exact matching to statsCalculator output
        let statKey: string | null = null;
        
        // Extract the exact stat names that are generated by formatStatsForChat and formatBrandDifferenceStatsForChat
        const exactStatNames = [
          'Areas analyzed',
          'Markets analyzed', 
          'Records analyzed',
          'Data points',
          'Average score',
          'Median score', 
          'Average difference',
          'Median difference',
          'Standard deviation',
          'Score range',
          'Difference range',
          'Total population',
          'Total area',
          'Quartiles',
          'IQR',
          'Outliers',
          'Distribution shape',
          'Model Used',
          'R² Score',
          'Confidence'
        ];
        
        // Check for exact matches with the stat names from statsCalculator
        for (const statName of exactStatNames) {
          if (line.includes(`• ${statName}:`) || line.includes(`**${statName}:**`)) {
            statKey = statName;
            break;
          }
        }
        
        if (statKey && statDefinitions[statKey]) {
          let statDef = statDefinitions[statKey];
          
          // For Model Used, create dynamic tooltip based on actual model name
          if (statKey === 'Model Used') {
            const match = line.match(/(?:•\s*Model Used:\s*\*\*([^*]+)\*\*)|(?:\*\*Model Used:\*\*\s*([^*]+))/);
            if (match) {
              const modelName = (match[1] || match[2] || '').trim();
              const calculationMethod = getScoreCalculationMethod(modelName);
              statDef = {
                ...statDef,
                description: `${statDef.description} This model uses: ${calculationMethod}`
              };
            }
          }
          
          // Parse the line to extract the label and value (format: • StatName: **value** OR **StatName:** value)
          const match = line.match(/(?:•\s*([^:]+):\s*(.+))|(?:\*\*([^:]+):\*\*\s*(.+))/);
          if (match) {
            const [, bulletLabel, bulletValue, boldLabel, boldValue] = match;
            const label = bulletLabel || boldLabel;
            const rawValue = bulletValue || boldValue;
            
            // Process the value for ZIP codes and FSA codes formatting
            const processValue = (text: string) => {
              // Combined pattern to match both US ZIP codes and Canadian FSA codes
              const areaParts = text.split(/(\b\d{5}\b|\b[A-Z]\d[A-Z]\b)/);
              return areaParts.map((part, i) => {
                if (/^\d{5}$/.test(part) && onZipCodeClick) {
                  // US ZIP code
                  return (
                    <button
                      key={i}
                      className="inline-flex items-center px-1 py-0.5 text-xs font-medium bg-green-100 text-green-800 rounded hover:bg-green-200 transition-colors cursor-pointer mx-0.5"
                      onClick={() => onZipCodeClick(part)}
                      title={`Click to zoom to ZIP code ${part}`}
                    >
                      {part}
                    </button>
                  );
                } else if (/^[A-Z]\d[A-Z]$/.test(part) && onZipCodeClick) {
                  // Canadian FSA code
                  return (
                    <button
                      key={i}
                      className="inline-flex items-center px-1 py-0.5 text-xs font-medium bg-green-100 text-green-800 rounded hover:bg-green-200 transition-colors cursor-pointer mx-0.5"
                      onClick={() => onZipCodeClick(part)}
                      title={`Click to zoom to FSA ${part}`}
                    >
                      {part}
                    </button>
                  );
                }
                // Process bold text
                const boldParts = part.split(/\*\*([^*]+)\*\*/);
                return boldParts.map((boldPart, j) => {
                  if (j % 2 === 1) {
                    return <strong key={`${i}-${j}`}>{boldPart}</strong>;
                  }
                  return <span key={`${i}-${j}`}>{boldPart}</span>;
                });
              });
            };
            
            return (
              <div key={index} className="flex items-start py-1 ml-4">
                <span className="text-xs flex items-center">
                  <span className="mr-1">•</span>
                  <span className="font-medium">{label}:</span>
                  <span className="ml-1 font-semibold">{processValue(rawValue)}</span>
                  <InfoTooltip
                    title={statDef.title}
                    description={statDef.description}
                    formula={statDef.formula}
                    example={statDef.example}
                  />
                </span>
              </div>
            );
          }
        }
        
        // Handle special formatting for headers and lists
        const isBullet = line.trim().startsWith('•');
        const isNumbered = /^\d+\.\s/.test(line.trim());
        
        if (isBullet || isNumbered) {
          return (
            <div key={index} className={`text-xs py-1 ${isBullet ? 'ml-4' : 'font-semibold mt-2'}`}>
              {renderLineWithZipCodes(line, onZipCodeClick)}
            </div>
          );
        }
        
        // Regular line without info icon
        if (line.trim()) {
          return (
            <div key={index} className="text-xs py-1">
              {renderLineWithZipCodes(line, onZipCodeClick)}
            </div>
          );
        }
        
        return null;
      })}
    </div>
  );
};

// Helper function to render lines with ZIP code and FSA code support
function renderLineWithZipCodes(text: string, onZipCodeClick?: (zipCode: string) => void) {
  const areaParts = text.split(/(\b\d{5}\b|\b[A-Z]\d[A-Z]\b)/);
  
  return areaParts.map((part, i) => {
    if (/^\d{5}$/.test(part) && onZipCodeClick) {
      // US ZIP code
      return (
        <button
          key={i}
          className="inline-flex items-center px-1 py-0.5 text-xs font-medium bg-green-100 text-green-800 rounded hover:bg-green-200 transition-colors cursor-pointer mx-0.5"
          onClick={() => onZipCodeClick(part)}
          title={`Click to zoom to ZIP code ${part}`}
        >
          {part}
        </button>
      );
    } else if (/^[A-Z]\d[A-Z]$/.test(part) && onZipCodeClick) {
      // Canadian FSA code
      return (
        <button
          key={i}
          className="inline-flex items-center px-1 py-0.5 text-xs font-medium bg-green-100 text-green-800 rounded hover:bg-green-200 transition-colors cursor-pointer mx-0.5"
          onClick={() => onZipCodeClick(part)}
          title={`Click to zoom to FSA ${part}`}
        >
          {part}
        </button>
      );
    }
    
    // Process bold text
    const boldParts = part.split(/\*\*([^*]+)\*\*/);
    return boldParts.map((boldPart, j) => {
      if (j % 2 === 1) {
        return <strong key={`${i}-${j}`}>{boldPart}</strong>;
      }
      return <span key={`${i}-${j}`}>{boldPart}</span>;
    });
  });
}

// Helper function to format markdown-like text
function formatLine(text: string): string {
  // Convert **text** to bold
  let formatted = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  
  // Convert markdown headers
  formatted = formatted.replace(/^###\s+(.+)/, '<h3 class="font-semibold text-xs mt-2">$1</h3>');
  formatted = formatted.replace(/^##\s+(.+)/, '<h2 class="font-semibold text-xs mt-3">$1</h2>');
  formatted = formatted.replace(/^#\s+(.+)/, '<h1 class="font-bold text-xs mt-4">$1</h1>');
  
  return formatted;
}