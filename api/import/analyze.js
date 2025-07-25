import { corsHeaders, handleError } from '../../lib/cors.js';

// Property type detection patterns
const PROPERTY_PATTERNS = {
  email: /email|e-mail|mail/i,
  phone: /phone|tel|mobile|cell/i,
  date: /date|created|updated|birth|dob/i,
  boolean: /is_|has_|active|enabled|verified/i,
  number: /count|age|score|rating|amount|price|value|number|qty|quantity/i,
  url: /url|website|link|site/i
};

function detectPropertyType(fieldName, sampleValues) {
  // Check field name patterns
  for (const [type, pattern] of Object.entries(PROPERTY_PATTERNS)) {
    if (pattern.test(fieldName)) {
      return { type, confidence: 0.8 };
    }
  }
  
  // Analyze sample values
  if (sampleValues && sampleValues.length > 0) {
    const validValues = sampleValues.filter(v => v && v.toString().trim());
    
    if (validValues.length === 0) {
      return { type: 'string', confidence: 0.3 };
    }
    
    // Email detection
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (validValues.some(v => emailPattern.test(v))) {
      return { type: 'email', confidence: 0.9 };
    }
    
    // Phone detection
    const phonePattern = /^\+?[\d\s\-\(\)]{10,}$/;
    if (validValues.some(v => phonePattern.test(v.toString().replace(/\s/g, '')))) {
      return { type: 'phone_number', confidence: 0.8 };
    }
    
    // Date detection
    if (validValues.some(v => !isNaN(Date.parse(v)))) {
      return { type: 'date', confidence: 0.7 };
    }
    
    // Number detection
    if (validValues.every(v => !isNaN(Number(v)))) {
      return { type: 'number', confidence: 0.8 };
    }
    
    // Boolean detection
    const boolValues = validValues.map(v => v.toString().toLowerCase());
    if (boolValues.every(v => ['true', 'false', '1', '0', 'yes', 'no'].includes(v))) {
      return { type: 'bool', confidence: 0.8 };
    }
  }
  
  return { type: 'string', confidence: 0.5 };
}

function transformFieldName(fieldName) {
  return fieldName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .substring(0, 50);
}

export default async function handler(req, res) {
  // Handle CORS
  if (corsHeaders(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({
      error: { code: '405', message: 'Method not allowed' }
    });
  }

  try {
    const { headers, sampleData, objectType = 'contact' } = req.body;
    
    if (!headers || !Array.isArray(headers)) {
      return res.status(400).json({
        error: { code: '400', message: 'Headers array is required' }
      });
    }
    
    const mappings = headers.map(header => {
      const sampleValues = sampleData ? sampleData.map(row => row[header]).slice(0, 5) : [];
      const typeResult = detectPropertyType(header, sampleValues);
      
      return {
        sourceField: header,
        suggestedName: transformFieldName(header),
        suggestedLabel: header.replace(/[_-]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        detectedType: {
          hubspotType: typeResult.type,
          fieldType: typeResult.type === 'string' ? 'text' : typeResult.type
        },
        confidence: typeResult.confidence,
        groupName: objectType === 'contact' ? 'contactinformation' : 'companyinformation',
        sampleValues: sampleValues.filter(v => v && v.toString().trim()).slice(0, 3),
        isReserved: ['email', 'firstname', 'lastname', 'company'].includes(transformFieldName(header))
      };
    });
    
    // Generate summary
    const summary = {
      total: mappings.length,
      highConfidence: mappings.filter(m => m.confidence >= 0.8).length,
      mediumConfidence: mappings.filter(m => m.confidence >= 0.5 && m.confidence < 0.8).length,
      lowConfidence: mappings.filter(m => m.confidence < 0.5).length
    };
    
    // Generate recommendations
    const recommendations = [];
    
    if (summary.lowConfidence > 0) {
      recommendations.push({
        type: 'warning',
        message: `${summary.lowConfidence} fields have low confidence mappings. Please review them.`
      });
    }
    
    const hasEmail = mappings.some(m => m.detectedType.hubspotType === 'email');
    if (!hasEmail && objectType === 'contact') {
      recommendations.push({
        type: 'warning',
        message: 'No email field detected. Contact records should have an email field.'
      });
    }
    
    res.status(200).json({
      mappings,
      summary,
      recommendations
    });
    
  } catch (error) {
    handleError(res, error, 'Failed to analyze field mappings');
  }
}