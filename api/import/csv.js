const csv = require('csv-parser');
const { Readable } = require('stream');

module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { csvData, objectType, delimiter = ',' } = req.body;

    if (!csvData) {
      return res.status(400).json({ error: 'CSV data is required' });
    }

    const results = [];
    const headers = [];
    let firstRow = true;

    // Parse CSV data
    const stream = Readable.from(csvData)
      .pipe(csv({ separator: delimiter }));

    for await (const data of stream) {
      if (firstRow) {
        headers.push(...Object.keys(data));
        firstRow = false;
      }
      results.push(data);
    }

    if (headers.length === 0) {
      return res.status(400).json({ error: 'No headers found in CSV data' });
    }

    // Extract sample data (first 10 rows)
    const sampleData = results.slice(0, 10);
    const totalRows = results.length;

    // Basic field type detection
    const fieldAnalysis = headers.map(header => {
      const sampleValues = sampleData
        .map(row => row[header])
        .filter(val => val && val.toString().trim() !== '');

      return {
        fieldName: header,
        sampleValues: sampleValues.slice(0, 5),
        detectedType: detectFieldType(header, sampleValues),
        confidence: calculateConfidence(header, sampleValues)
      };
    });

    res.status(200).json({
      success: true,
      data: {
        headers,
        sampleData,
        totalRows,
        objectType,
        fieldAnalysis,
        importMethod: 'csv'
      }
    });

  } catch (error) {
    console.error('CSV parsing error:', error);
    res.status(500).json({ 
      error: 'Failed to parse CSV data',
      details: error.message 
    });
  }
};

function detectFieldType(fieldName, sampleValues) {
  const field = fieldName.toLowerCase();
  
  // Email detection
  if (field.includes('email') || sampleValues.some(val => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val))) {
    return {
      hubspotType: 'string',
      fieldType: 'text',
      isEmail: true
    };
  }

  // Phone detection
  if (field.includes('phone') || field.includes('mobile') || field.includes('tel') ||
      sampleValues.some(val => /^[\+]?[1-9][\d]{0,15}$/.test(val.replace(/[\s\-\(\)]/g, '')))) {
    return {
      hubspotType: 'phone_number',
      fieldType: 'phonenumber'
    };
  }

  // Date detection
  if (field.includes('date') || field.includes('created') || field.includes('modified') ||
      sampleValues.some(val => !isNaN(Date.parse(val)))) {
    return {
      hubspotType: 'datetime',
      fieldType: 'date'
    };
  }

  // Number detection
  if (field.includes('price') || field.includes('amount') || field.includes('revenue') || field.includes('value') ||
      sampleValues.every(val => !isNaN(parseFloat(val)))) {
    return {
      hubspotType: 'number',
      fieldType: 'number'
    };
  }

  // Boolean detection
  if (sampleValues.every(val => ['true', 'false', 'yes', 'no', '1', '0'].includes(val.toLowerCase()))) {
    return {
      hubspotType: 'bool',
      fieldType: 'booleancheckbox'
    };
  }

  // Enumeration detection (limited unique values)
  const uniqueValues = [...new Set(sampleValues)];
  if (uniqueValues.length <= 10 && uniqueValues.length >= 2 && sampleValues.length >= 5) {
    return {
      hubspotType: 'enumeration',
      fieldType: 'select',
      options: uniqueValues.map(val => ({ label: val, value: val.toLowerCase().replace(/\s+/g, '_') }))
    };
  }

  // Default to text
  return {
    hubspotType: 'string',
    fieldType: 'text'
  };
}

function calculateConfidence(fieldName, sampleValues) {
  const field = fieldName.toLowerCase();
  let confidence = 0.5; // Base confidence

  // High confidence field names
  const highConfidenceFields = ['email', 'phone', 'first_name', 'last_name', 'company', 'website'];
  if (highConfidenceFields.some(hcf => field.includes(hcf))) {
    confidence += 0.3;
  }

  // Data pattern matching increases confidence
  if (sampleValues.length > 0) {
    const firstValue = sampleValues[0];
    
    // Email pattern
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(firstValue)) {
      confidence += 0.2;
    }
    
    // Phone pattern
    if (/^[\+]?[1-9][\d]{0,15}$/.test(firstValue.replace(/[\s\-\(\)]/g, ''))) {
      confidence += 0.2;
    }
    
    // Date pattern
    if (!isNaN(Date.parse(firstValue))) {
      confidence += 0.1;
    }
  }

  return Math.min(confidence, 1.0);
}