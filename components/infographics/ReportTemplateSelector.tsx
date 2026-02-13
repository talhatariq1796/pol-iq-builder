import React from 'react';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectGroup, SelectLabel, SelectItem } from '@/components/ui/select';
import type { ReportTemplate } from '@/types/reports';

interface ReportTemplateSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

export const REPORT_TEMPLATES: ReportTemplate[] = [
  // Summary Reports
  { id: 'whats-in-my-neighbourhood-km', name: 'What\'s in my Neighbourhood?', category: 'Summary Reports' },
  { id: 'whats-in-my-community-km', name: 'What\'s in My Community?', category: 'Summary Reports' },
  { id: 'community-change-snapshot', name: 'Community Change Snapshot', category: 'Summary Reports' },
  { id: 'community-profile', name: 'Community Demographics Report', category: 'Summary Reports' },
  { id: 'neighbourhood-information', name: 'Neighbourhood Information', category: 'Summary Reports' },
  
  // Demographics
  { id: 'demographic-profile', name: 'Demographic Profile', category: 'Demographics' },
  { id: 'demographic-and-income', name: 'Demographic and Income', category: 'Demographics' },
  { id: 'demographics-and-spending', name: 'Demographics and Spending', category: 'Demographics' },
  { id: 'population-and-household-trends', name: '20 Year Population and Household Trends', category: 'Demographics' },
  { id: 'population-and-key-indicators', name: 'Population and Key Indicators', category: 'Demographics' },
  { id: 'millennium-and-genz-profile', name: 'Millennial and GenZ Profile', category: 'Demographics' },
  { id: 'work-and-occupation', name: 'Work and Occupation', category: 'Demographics' },
  { id: 'visible-minority', name: 'Visible Minority and Immigration', category: 'Demographics' },
  { id: 'fb5acdb91f144170b952d740478e7291', name: 'Demographic and Income Report (Tabular)', category: 'Demographics' },
  
  // Market Analysis
  { id: 'prizm-profile', name: 'PRIZM Profile', category: 'Market Analysis' },
  { id: 'prizm-key-facts', name: 'PRIZM Key Facts', category: 'Market Analysis' },
  { id: 'economic-development', name: 'Economic Development', category: 'Market Analysis' },
  { id: 'lifestyle-profile', name: 'Lifestyle Profile', category: 'Market Analysis' },
  { id: 'eating-places-in-canada', name: 'Eating Places in Canada', category: 'Market Analysis' },
  { id: 'segmentation-and-spending-facts', name: 'Segmentation and Spending Facts', category: 'Market Analysis' },
  { id: 'target-market-summary', name: 'Target Market Profile Report', category: 'Market Analysis' },
  { id: 'cfa054e14b884b4fb478013d07ae47b1', name: 'Community Economic Development Initiative', category: 'Market Analysis' },
  { id: 'b09b705d80bc44f89e17b9457b016878', name: 'Market Area Analysis', category: 'Market Analysis' },
  { id: '324a2b6b39b54cd19ab2ffc397295f04', name: 'Market Profile (Tabular)', category: 'Market Analysis' },
  { id: '050c43a0c2a74d5c9c4dbb5d9a215b7c', name: 'PRIZM and Demographic Report (Tabular)', category: 'Market Analysis' },
  
  // Health & Risk
  { id: 'poverty-indicators', name: 'Community Risk and Equitability', category: 'Health & Risk' },
  { id: 'emergency-community-information', name: 'Emergency Community Information', category: 'Health & Risk' },
  { id: '5239e033eb104c6ba6f31fa921c98f80', name: 'Community Health', category: 'Health & Risk' },
  
  // Real Estate
  { id: 'housing-information', name: 'Housing Information', category: 'Real Estate' },
  { id: 'real-estate', name: 'Real Estate and Dwelling Report', category: 'Real Estate' },
  
  // Financial
  { id: '2e778d1da305458fafb7990670377c28', name: 'Banking and Insurance Residential', category: 'Financial' }
];

// Group templates by category
const groupedTemplates = REPORT_TEMPLATES.reduce((acc, template) => {
  if (!acc[template.category]) {
    acc[template.category] = [];
  }
  acc[template.category].push(template);
  return acc;
}, {} as Record<string, typeof REPORT_TEMPLATES>);

const ReportTemplateSelector: React.FC<ReportTemplateSelectorProps> = ({ value, onChange }) => {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Select a report template" />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(groupedTemplates).map(([category, templates]) => (
          <SelectGroup key={category}>
            <SelectLabel>{category}</SelectLabel>
            {templates.map((template) => (
              <SelectItem key={template.id} value={template.id}>
                {template.name}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
};

export default ReportTemplateSelector;