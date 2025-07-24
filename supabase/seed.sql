-- Insert default templates
INSERT INTO templates (id, name, description, industry, config, "isActive", "usageCount", "createdBy", "createdAt", "updatedAt") VALUES 
(
  uuid_generate_v4(),
  'B2B SaaS Starter',
  'Complete setup for B2B SaaS companies with trial tracking, MRR properties, and sales pipeline',
  'SaaS',
  '{
    "properties": {
      "contacts": [
        {
          "name": "trial_start_date",
          "label": "Trial Start Date",
          "type": "date",
          "fieldType": "date",
          "groupName": "sales_information"
        },
        {
          "name": "trial_end_date",
          "label": "Trial End Date",
          "type": "date",
          "fieldType": "date",
          "groupName": "sales_information"
        },
        {
          "name": "demo_scheduled",
          "label": "Demo Scheduled",
          "type": "bool",
          "fieldType": "booleancheckbox",
          "groupName": "sales_information"
        },
        {
          "name": "use_case",
          "label": "Primary Use Case",
          "type": "enumeration",
          "fieldType": "select",
          "groupName": "sales_information",
          "options": [
            { "label": "Marketing Automation", "value": "marketing_automation" },
            { "label": "Sales Management", "value": "sales_management" },
            { "label": "Customer Support", "value": "customer_support" },
            { "label": "Analytics", "value": "analytics" },
            { "label": "Other", "value": "other" }
          ]
        },
        {
          "name": "company_size",
          "label": "Company Size",
          "type": "enumeration",
          "fieldType": "select",
          "groupName": "companyinformation",
          "options": [
            { "label": "1-10 employees", "value": "1_10" },
            { "label": "11-50 employees", "value": "11_50" },
            { "label": "51-200 employees", "value": "51_200" },
            { "label": "201-500 employees", "value": "201_500" },
            { "label": "500+ employees", "value": "500_plus" }
          ]
        }
      ],
      "companies": [
        {
          "name": "mrr",
          "label": "Monthly Recurring Revenue",
          "type": "number",
          "fieldType": "number",
          "groupName": "companyinformation"
        },
        {
          "name": "arr",
          "label": "Annual Recurring Revenue",
          "type": "number",
          "fieldType": "number",
          "groupName": "companyinformation"
        },
        {
          "name": "plan_type",
          "label": "Subscription Plan",
          "type": "enumeration",
          "fieldType": "select",
          "groupName": "companyinformation",
          "options": [
            { "label": "Free Trial", "value": "free_trial" },
            { "label": "Starter", "value": "starter" },
            { "label": "Professional", "value": "professional" },
            { "label": "Enterprise", "value": "enterprise" }
          ]
        }
      ],
      "deals": [
        {
          "name": "contract_length",
          "label": "Contract Length (months)",
          "type": "number",
          "fieldType": "number",
          "groupName": "dealinformation"
        },
        {
          "name": "implementation_timeline",
          "label": "Implementation Timeline",
          "type": "enumeration",
          "fieldType": "select",
          "groupName": "dealinformation",
          "options": [
            { "label": "Immediate", "value": "immediate" },
            { "label": "1-2 weeks", "value": "1_2_weeks" },
            { "label": "1 month", "value": "1_month" },
            { "label": "2-3 months", "value": "2_3_months" },
            { "label": "3+ months", "value": "3_plus_months" }
          ]
        }
      ]
    },
    "pipelines": {
      "deals": [
        {
          "label": "SaaS Sales Pipeline",
          "displayOrder": 0,
          "stages": [
            {
              "label": "Lead",
              "displayOrder": 0,
              "metadata": { "probability": 0.1, "isClosed": false }
            },
            {
              "label": "Demo Scheduled",
              "displayOrder": 1,
              "metadata": { "probability": 0.2, "isClosed": false }
            },
            {
              "label": "Trial Started",
              "displayOrder": 2,
              "metadata": { "probability": 0.4, "isClosed": false }
            },
            {
              "label": "Proposal Sent",
              "displayOrder": 3,
              "metadata": { "probability": 0.6, "isClosed": false }
            },
            {
              "label": "Negotiation",
              "displayOrder": 4,
              "metadata": { "probability": 0.8, "isClosed": false }
            },
            {
              "label": "Closed Won",
              "displayOrder": 5,
              "metadata": { "probability": 1.0, "isClosed": true }
            },
            {
              "label": "Closed Lost",
              "displayOrder": 6,
              "metadata": { "probability": 0.0, "isClosed": true }
            }
          ]
        }
      ]
    },
    "lifecycleStages": {
      "stages": [
        { "name": "subscriber", "label": "Subscriber", "displayOrder": 0 },
        { "name": "lead", "label": "Lead", "displayOrder": 1 },
        { "name": "marketingqualifiedlead", "label": "Marketing Qualified Lead", "displayOrder": 2 },
        { "name": "salesqualifiedlead", "label": "Sales Qualified Lead", "displayOrder": 3 },
        { "name": "opportunity", "label": "Opportunity", "displayOrder": 4 },
        { "name": "customer", "label": "Customer", "displayOrder": 5 },
        { "name": "evangelist", "label": "Evangelist", "displayOrder": 6 }
      ]
    }
  }',
  true,
  0,
  'system',
  NOW(),
  NOW()
),
(
  uuid_generate_v4(),
  'E-commerce Store',
  'Optimized for online retail with order tracking, product interests, and customer lifecycle',
  'E-commerce',
  '{
    "properties": {
      "contacts": [
        {
          "name": "first_purchase_date",
          "label": "First Purchase Date",
          "type": "date",
          "fieldType": "date",
          "groupName": "sales_information"
        },
        {
          "name": "last_purchase_date",
          "label": "Last Purchase Date",
          "type": "date",
          "fieldType": "date",
          "groupName": "sales_information"
        },
        {
          "name": "total_purchases",
          "label": "Total Number of Purchases",
          "type": "number",
          "fieldType": "number",
          "groupName": "sales_information"
        },
        {
          "name": "lifetime_value",
          "label": "Customer Lifetime Value",
          "type": "number",
          "fieldType": "number",
          "groupName": "sales_information"
        },
        {
          "name": "preferred_category",
          "label": "Preferred Product Category",
          "type": "enumeration",
          "fieldType": "select",
          "groupName": "sales_information",
          "options": [
            { "label": "Electronics", "value": "electronics" },
            { "label": "Clothing", "value": "clothing" },
            { "label": "Home & Garden", "value": "home_garden" },
            { "label": "Sports & Outdoors", "value": "sports_outdoors" },
            { "label": "Books", "value": "books" }
          ]
        },
        {
          "name": "cart_abandoner",
          "label": "Cart Abandoner",
          "type": "bool",
          "fieldType": "booleancheckbox",
          "groupName": "sales_information"
        }
      ],
      "companies": [
        {
          "name": "business_type",
          "label": "Business Type",
          "type": "enumeration",
          "fieldType": "select",
          "groupName": "companyinformation",
          "options": [
            { "label": "B2C Retail", "value": "b2c_retail" },
            { "label": "B2B Wholesale", "value": "b2b_wholesale" },
            { "label": "Marketplace", "value": "marketplace" },
            { "label": "Dropshipping", "value": "dropshipping" }
          ]
        }
      ],
      "deals": [
        {
          "name": "order_value",
          "label": "Order Value",
          "type": "number",
          "fieldType": "number",
          "groupName": "dealinformation"
        },
        {
          "name": "shipping_method",
          "label": "Shipping Method",
          "type": "enumeration",
          "fieldType": "select",
          "groupName": "dealinformation",
          "options": [
            { "label": "Standard Shipping", "value": "standard" },
            { "label": "Express Shipping", "value": "express" },
            { "label": "Overnight", "value": "overnight" },
            { "label": "Local Pickup", "value": "pickup" }
          ]
        }
      ]
    },
    "pipelines": {
      "deals": [
        {
          "label": "E-commerce Sales Process",
          "displayOrder": 0,
          "stages": [
            {
              "label": "Browsing",
              "displayOrder": 0,
              "metadata": { "probability": 0.1, "isClosed": false }
            },
            {
              "label": "Added to Cart",
              "displayOrder": 1,
              "metadata": { "probability": 0.3, "isClosed": false }
            },
            {
              "label": "Checkout Started",
              "displayOrder": 2,
              "metadata": { "probability": 0.6, "isClosed": false }
            },
            {
              "label": "Payment Processing",
              "displayOrder": 3,
              "metadata": { "probability": 0.9, "isClosed": false }
            },
            {
              "label": "Order Completed",
              "displayOrder": 4,
              "metadata": { "probability": 1.0, "isClosed": true }
            },
            {
              "label": "Abandoned Cart",
              "displayOrder": 5,
              "metadata": { "probability": 0.0, "isClosed": true }
            }
          ]
        }
      ]
    }
  }',
  true,
  0,
  'system',
  NOW(),
  NOW()
),
(
  uuid_generate_v4(),
  'Professional Services',
  'Designed for consultancies, agencies, and service providers with project tracking',
  'Professional Services',
  '{
    "properties": {
      "contacts": [
        {
          "name": "project_budget",
          "label": "Project Budget Range",
          "type": "enumeration",
          "fieldType": "select",
          "groupName": "sales_information",
          "options": [
            { "label": "Under $10k", "value": "under_10k" },
            { "label": "$10k - $25k", "value": "10k_25k" },
            { "label": "$25k - $50k", "value": "25k_50k" },
            { "label": "$50k - $100k", "value": "50k_100k" },
            { "label": "Over $100k", "value": "over_100k" }
          ]
        },
        {
          "name": "service_interest",
          "label": "Service of Interest",
          "type": "enumeration",
          "fieldType": "select",
          "groupName": "sales_information",
          "options": [
            { "label": "Consulting", "value": "consulting" },
            { "label": "Implementation", "value": "implementation" },
            { "label": "Training", "value": "training" },
            { "label": "Support", "value": "support" },
            { "label": "Custom Development", "value": "custom_development" }
          ]
        },
        {
          "name": "project_timeline",
          "label": "Desired Project Timeline",
          "type": "enumeration",
          "fieldType": "select",
          "groupName": "sales_information",
          "options": [
            { "label": "ASAP", "value": "asap" },
            { "label": "Within 30 days", "value": "30_days" },
            { "label": "1-3 months", "value": "1_3_months" },
            { "label": "3-6 months", "value": "3_6_months" },
            { "label": "6+ months", "value": "6_plus_months" }
          ]
        }
      ],
      "companies": [
        {
          "name": "service_needs",
          "label": "Service Needs",
          "type": "string",
          "fieldType": "textarea",
          "groupName": "companyinformation"
        }
      ],
      "deals": [
        {
          "name": "project_scope",
          "label": "Project Scope",
          "type": "string",
          "fieldType": "textarea",
          "groupName": "dealinformation"
        },
        {
          "name": "proposal_sent_date",
          "label": "Proposal Sent Date",
          "type": "date",
          "fieldType": "date",
          "groupName": "dealinformation"
        }
      ]
    },
    "pipelines": {
      "deals": [
        {
          "label": "Professional Services Pipeline",
          "displayOrder": 0,
          "stages": [
            {
              "label": "Initial Contact",
              "displayOrder": 0,
              "metadata": { "probability": 0.1, "isClosed": false }
            },
            {
              "label": "Needs Assessment",
              "displayOrder": 1,
              "metadata": { "probability": 0.2, "isClosed": false }
            },
            {
              "label": "Proposal Development",
              "displayOrder": 2,
              "metadata": { "probability": 0.4, "isClosed": false }
            },
            {
              "label": "Proposal Sent",
              "displayOrder": 3,
              "metadata": { "probability": 0.6, "isClosed": false }
            },
            {
              "label": "Contract Negotiation",
              "displayOrder": 4,
              "metadata": { "probability": 0.8, "isClosed": false }
            },
            {
              "label": "Project Awarded",
              "displayOrder": 5,
              "metadata": { "probability": 1.0, "isClosed": true }
            },
            {
              "label": "Not Selected",
              "displayOrder": 6,
              "metadata": { "probability": 0.0, "isClosed": true }
            }
          ]
        }
      ]
    }
  }',
  true,
  0,
  'system',
  NOW(),
  NOW()
);