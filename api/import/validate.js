import { corsHeaders, handleError } from '../../lib/cors.js';

export default async function handler(req, res) {
  // Handle CORS
  if (corsHeaders(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({
      error: { code: '405', message: 'Method not allowed' }
    });
  }

  try {
    const { mappings, objectType = 'contact' } = req.body;
    
    if (!mappings || !Array.isArray(mappings)) {
      return res.status(400).json({
        error: { code: '400', message: 'Mappings array is required' }
      });
    }
    
    const errors = [];
    const warnings = [];
    
    // Validate each mapping
    mappings.forEach((mapping, index) => {
      // Check required fields
      if (!mapping.suggestedName) {
        errors.push({
          field: mapping.sourceField,
          index,
          message: 'Property name is required'
        });
      }
      
      // Check name format
      if (mapping.suggestedName && !/^[a-z][a-z0-9_]*$/.test(mapping.suggestedName)) {
        errors.push({
          field: mapping.sourceField,
          index,
          message: 'Property name must start with a letter and contain only lowercase letters, numbers, and underscores'
        });
      }
      
      // Check name length
      if (mapping.suggestedName && mapping.suggestedName.length > 50) {
        errors.push({
          field: mapping.sourceField,
          index,
          message: 'Property name must be 50 characters or less'
        });
      }
      
      // Check for duplicates
      const duplicates = mappings.filter(m => m.suggestedName === mapping.suggestedName);
      if (duplicates.length > 1) {
        errors.push({
          field: mapping.sourceField,
          index,
          message: `Duplicate property name: ${mapping.suggestedName}`
        });
      }
      
      // Low confidence warning
      if (mapping.confidence < 0.5) {
        warnings.push({
          field: mapping.sourceField,
          index,
          message: 'Low confidence field type detection. Please verify.'
        });
      }
    });
    
    // Object-specific validations
    if (objectType === 'contact') {
      const hasEmail = mappings.some(m => 
        m.detectedType?.hubspotType === 'email' || 
        m.suggestedName?.toLowerCase().includes('email')
      );
      
      if (!hasEmail) {
        warnings.push({
          field: 'general',
          message: 'No email field found. Contact records typically require an email address.'
        });
      }
    }
    
    const isValid = errors.length === 0;
    
    res.status(200).json({
      isValid,
      errors,
      warnings,
      summary: {
        totalMappings: mappings.length,
        errorCount: errors.length,
        warningCount: warnings.length
      }
    });
    
  } catch (error) {
    handleError(res, error, 'Failed to validate mappings');
  }
}