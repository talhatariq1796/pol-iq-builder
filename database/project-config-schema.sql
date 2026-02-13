-- Database schema for Project Configuration Management System
-- This creates the necessary tables for storing project configurations and templates
-- Order matters: project_templates must exist before project_configurations (FK reference).

-- Project Templates Table (must be created first - referenced by project_configurations)
CREATE TABLE IF NOT EXISTS project_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL CHECK (category IN ('industry', 'use-case', 'custom')),
    configuration JSONB NOT NULL,
    author_id UUID REFERENCES auth.users(id),
    is_public BOOLEAN DEFAULT false,
    download_count INTEGER DEFAULT 0,
    rating DECIMAL(3,2) DEFAULT 0.0 CHECK (rating >= 0.0 AND rating <= 5.0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    version TEXT DEFAULT '1.0.0',
    preview_image TEXT,
    documentation TEXT,
    tags TEXT[] DEFAULT '{}',
    
    CONSTRAINT project_templates_name_check CHECK (length(name) > 0),
    CONSTRAINT project_templates_download_count_check CHECK (download_count >= 0)
);

-- Project Configurations Table
CREATE TABLE IF NOT EXISTS project_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    configuration JSONB NOT NULL,
    template_id UUID REFERENCES project_templates(id),
    user_id UUID REFERENCES auth.users(id),
    organization_id UUID,
    is_active BOOLEAN DEFAULT true,
    is_template BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    version INTEGER DEFAULT 1,
    tags TEXT[] DEFAULT '{}',
    
    CONSTRAINT project_configurations_name_check CHECK (length(name) > 0),
    CONSTRAINT project_configurations_version_check CHECK (version > 0)
);

-- Layer Dependencies Table (for tracking file/component dependencies)
CREATE TABLE IF NOT EXISTS layer_dependencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES project_configurations(id) ON DELETE CASCADE,
    layer_id TEXT NOT NULL,
    file_path TEXT NOT NULL,
    dependency_type TEXT NOT NULL CHECK (dependency_type IN ('config', 'component', 'service', 'utility')),
    reference_type TEXT NOT NULL CHECK (reference_type IN ('import', 'hardcoded', 'dynamic')),
    line_number INTEGER,
    column_number INTEGER,
    context_info TEXT,
    update_strategy TEXT DEFAULT 'manual' CHECK (update_strategy IN ('auto', 'manual', 'prompt')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Configuration Change Log Table
CREATE TABLE IF NOT EXISTS configuration_change_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES project_configurations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id),
    change_type TEXT NOT NULL CHECK (change_type IN ('add', 'remove', 'modify')),
    target_type TEXT NOT NULL CHECK (target_type IN ('layer', 'group', 'concept', 'setting')),
    target_path TEXT NOT NULL,
    old_value JSONB,
    new_value JSONB,
    reason TEXT,
    impact_analysis JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Deployment History Table
CREATE TABLE IF NOT EXISTS deployment_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES project_configurations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id),
    deployment_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'partial')),
    files_updated TEXT[] DEFAULT '{}',
    errors JSONB DEFAULT '[]',
    rollback_available BOOLEAN DEFAULT false,
    deployment_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    rollback_time TIMESTAMP WITH TIME ZONE,
    notes TEXT
);

-- Template Ratings Table
CREATE TABLE IF NOT EXISTS template_ratings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID REFERENCES project_templates(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id),
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    review TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(template_id, user_id)
);

-- Project Shares Table (for collaborative editing)
CREATE TABLE IF NOT EXISTS project_shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES project_configurations(id) ON DELETE CASCADE,
    shared_with_user_id UUID REFERENCES auth.users(id),
    shared_by_user_id UUID REFERENCES auth.users(id),
    permission_level TEXT NOT NULL CHECK (permission_level IN ('read', 'edit', 'admin')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    
    UNIQUE(project_id, shared_with_user_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_project_configurations_user_id ON project_configurations(user_id);
CREATE INDEX IF NOT EXISTS idx_project_configurations_template_id ON project_configurations(template_id);
CREATE INDEX IF NOT EXISTS idx_project_configurations_is_active ON project_configurations(is_active);
CREATE INDEX IF NOT EXISTS idx_project_configurations_tags ON project_configurations USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_project_configurations_created_at ON project_configurations(created_at);

CREATE INDEX IF NOT EXISTS idx_project_templates_category ON project_templates(category);
CREATE INDEX IF NOT EXISTS idx_project_templates_is_public ON project_templates(is_public);
CREATE INDEX IF NOT EXISTS idx_project_templates_author_id ON project_templates(author_id);
CREATE INDEX IF NOT EXISTS idx_project_templates_tags ON project_templates USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_project_templates_rating ON project_templates(rating);

CREATE INDEX IF NOT EXISTS idx_layer_dependencies_project_id ON layer_dependencies(project_id);
CREATE INDEX IF NOT EXISTS idx_layer_dependencies_layer_id ON layer_dependencies(layer_id);
CREATE INDEX IF NOT EXISTS idx_layer_dependencies_file_path ON layer_dependencies(file_path);

CREATE INDEX IF NOT EXISTS idx_configuration_change_log_project_id ON configuration_change_log(project_id);
CREATE INDEX IF NOT EXISTS idx_configuration_change_log_user_id ON configuration_change_log(user_id);
CREATE INDEX IF NOT EXISTS idx_configuration_change_log_created_at ON configuration_change_log(created_at);

CREATE INDEX IF NOT EXISTS idx_deployment_history_project_id ON deployment_history(project_id);
CREATE INDEX IF NOT EXISTS idx_deployment_history_deployment_time ON deployment_history(deployment_time);

CREATE INDEX IF NOT EXISTS idx_template_ratings_template_id ON template_ratings(template_id);
CREATE INDEX IF NOT EXISTS idx_template_ratings_user_id ON template_ratings(user_id);

CREATE INDEX IF NOT EXISTS idx_project_shares_project_id ON project_shares(project_id);
CREATE INDEX IF NOT EXISTS idx_project_shares_shared_with_user_id ON project_shares(shared_with_user_id);

-- Create triggers for updating timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_project_configurations_updated_at 
    BEFORE UPDATE ON project_configurations 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_project_templates_updated_at 
    BEFORE UPDATE ON project_templates 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_layer_dependencies_updated_at 
    BEFORE UPDATE ON layer_dependencies 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_template_ratings_updated_at 
    BEFORE UPDATE ON template_ratings 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create function to update template ratings
CREATE OR REPLACE FUNCTION update_template_rating()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE project_templates 
    SET rating = (
        SELECT COALESCE(AVG(rating), 0.0)
        FROM template_ratings 
        WHERE template_id = COALESCE(NEW.template_id, OLD.template_id)
    )
    WHERE id = COALESCE(NEW.template_id, OLD.template_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ language 'plpgsql';

CREATE TRIGGER update_template_rating_trigger
    AFTER INSERT OR UPDATE OR DELETE ON template_ratings
    FOR EACH ROW EXECUTE FUNCTION update_template_rating();

-- Create function to increment download count
CREATE OR REPLACE FUNCTION increment_template_downloads(template_uuid UUID)
RETURNS void AS $$
BEGIN
    UPDATE project_templates 
    SET download_count = download_count + 1
    WHERE id = template_uuid;
END;
$$ language 'plpgsql';

-- Row Level Security (RLS) policies
ALTER TABLE project_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE layer_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE configuration_change_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE deployment_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_shares ENABLE ROW LEVEL SECURITY;

-- RLS Policies for project_configurations
CREATE POLICY "Users can view their own project configurations" ON project_configurations
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view shared project configurations" ON project_configurations
    FOR SELECT USING (
        id IN (
            SELECT project_id FROM project_shares 
            WHERE shared_with_user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert their own project configurations" ON project_configurations
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own project configurations" ON project_configurations
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own project configurations" ON project_configurations
    FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for project_templates
CREATE POLICY "Anyone can view public templates" ON project_templates
    FOR SELECT USING (is_public = true);

CREATE POLICY "Users can view their own templates" ON project_templates
    FOR SELECT USING (auth.uid() = author_id);

CREATE POLICY "Users can insert their own templates" ON project_templates
    FOR INSERT WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Users can update their own templates" ON project_templates
    FOR UPDATE USING (auth.uid() = author_id);

CREATE POLICY "Users can delete their own templates" ON project_templates
    FOR DELETE USING (auth.uid() = author_id);

-- Insert some default templates (author_id NULL = system-provided; no auth.users row required)
INSERT INTO project_templates (name, description, category, configuration, author_id, is_public, tags, version) VALUES
('Real Estate Analytics', 'Template for real estate and mortgage analysis applications', 'industry', 
 '{"id":"real_estate_template","name":"Real Estate Analytics","description":"Real estate and mortgage analysis","version":"1.0.0","layers":{},"groups":[],"conceptMappings":{"layerMappings":{},"fieldMappings":{},"synonyms":{},"weights":{},"customConcepts":[]},"dependencies":{"files":[],"services":[],"components":[]},"settings":{"defaultVisibility":{},"defaultCollapsed":{},"globalSettings":{"defaultOpacity":0.8,"maxVisibleLayers":10,"performanceMode":"standard","autoSave":true,"previewMode":false},"ui":{"theme":"auto","compactMode":false,"showAdvanced":false}},"metadata":{"industry":"real_estate","useCase":"mortgage_analysis"}}',
 NULL, true, ARRAY['real-estate', 'mortgage', 'analytics'], '1.0.0'),

('Demographic Analysis', 'Template for demographic and population analysis', 'use-case',
 '{"id":"demographic_template","name":"Demographic Analysis","description":"Demographic and population analysis","version":"1.0.0","layers":{},"groups":[],"conceptMappings":{"layerMappings":{},"fieldMappings":{},"synonyms":{},"weights":{},"customConcepts":[]},"dependencies":{"files":[],"services":[],"components":[]},"settings":{"defaultVisibility":{},"defaultCollapsed":{},"globalSettings":{"defaultOpacity":0.8,"maxVisibleLayers":10,"performanceMode":"standard","autoSave":true,"previewMode":false},"ui":{"theme":"auto","compactMode":false,"showAdvanced":false}},"metadata":{"useCase":"demographic_analysis"}}',
 NULL, true, ARRAY['demographics', 'population', 'analysis'], '1.0.0'),

('Business Intelligence', 'Template for business intelligence and market analysis', 'use-case',
 '{"id":"business_intelligence_template","name":"Business Intelligence","description":"Business intelligence and market analysis","version":"1.0.0","layers":{},"groups":[],"conceptMappings":{"layerMappings":{},"fieldMappings":{},"synonyms":{},"weights":{},"customConcepts":[]},"dependencies":{"files":[],"services":[],"components":[]},"settings":{"defaultVisibility":{},"defaultCollapsed":{},"globalSettings":{"defaultOpacity":0.8,"maxVisibleLayers":10,"performanceMode":"standard","autoSave":true,"previewMode":false},"ui":{"theme":"auto","compactMode":false,"showAdvanced":false}},"metadata":{"useCase":"business_intelligence"}}',
 NULL, true, ARRAY['business', 'intelligence', 'market-analysis'], '1.0.0');

-- Create views for easier querying
CREATE OR REPLACE VIEW project_configurations_with_stats AS
SELECT 
    pc.*,
    pt.name as template_name,
    COUNT(ccl.id) as change_count,
    MAX(ccl.created_at) as last_change,
    COUNT(dh.id) as deployment_count,
    MAX(dh.deployment_time) as last_deployment
FROM project_configurations pc
LEFT JOIN project_templates pt ON pc.template_id = pt.id
LEFT JOIN configuration_change_log ccl ON pc.id = ccl.project_id
LEFT JOIN deployment_history dh ON pc.id = dh.project_id
GROUP BY pc.id, pt.name;

CREATE OR REPLACE VIEW template_stats AS
SELECT 
    pt.*,
    COUNT(pc.id) as usage_count,
    COUNT(tr.id) as rating_count,
    COALESCE(AVG(tr.rating), 0.0) as avg_rating
FROM project_templates pt
LEFT JOIN project_configurations pc ON pt.id = pc.template_id
LEFT JOIN template_ratings tr ON pt.id = tr.template_id
GROUP BY pt.id; 