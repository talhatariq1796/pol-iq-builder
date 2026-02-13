// components/ProjectConfigManager/TemplateLibrary.tsx
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ProjectTemplate } from '@/types/project-config';

interface TemplateLibraryProps {
  templates: ProjectTemplate[];
  onCreateFromTemplate: (templateId: string, projectName: string) => void;
}

export const TemplateLibrary: React.FC<TemplateLibraryProps> = ({
  templates,
  onCreateFromTemplate
}) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Template Library</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-gray-500">Template library coming soon...</p>
      </CardContent>
    </Card>
  );
}; 