# 🚀 Vercel + Supabase Deployment Guide

Deploy your HubSpot Automation Platform with **Vercel** (hosting) + **Supabase** (PostgreSQL database) in under 10 minutes!

## 🎯 **Step 1: Setup Supabase Database**

### 1.1 Create Supabase Project
1. Go to [Supabase.com](https://supabase.com) and sign up
2. Click **"New Project"**
3. Fill in details:
   - **Name**: `hubspot-automation`
   - **Database Password**: Choose a strong password
   - **Region**: Choose closest to your users
4. Click **"Create new project"** (takes ~2 minutes)

### 1.2 Run Database Migration
1. In your Supabase dashboard, go to **SQL Editor**
2. Click **"New query"**
3. Copy and paste the contents of `supabase/migrations/001_initial_schema.sql`
4. Click **"Run"** to create all tables
5. Create another query and paste contents of `supabase/seed.sql`
6. Click **"Run"** to insert sample templates

### 1.3 Get Connection String
1. Go to **Settings** → **Database**
2. Scroll down to **Connection string**
3. Copy the **URI** (it looks like: `postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres`)
4. **Save this** - you'll need it for Vercel!

## 🚀 **Step 2: Deploy to Vercel**

### 2.1 Deploy from GitHub
1. Go to [Vercel.com](https://vercel.com) and sign up with GitHub
2. Click **"New Project"**
3. Import your repository: `geordiefrost/hubspot-automation`
4. **DO NOT** click Deploy yet - we need to set environment variables first

### 2.2 Configure Environment Variables
In the Vercel deployment screen, add these environment variables:

```bash
# Required - Database
DATABASE_URL=your-supabase-connection-string-from-step-1.3

# Required - Security
NODE_ENV=production
JWT_SECRET=your-super-secret-jwt-key-here-make-it-long
ENCRYPTION_KEY=exactly32characterslongkey123456

# Optional but recommended
CLIENT_URL=https://your-app-name.vercel.app
LOG_LEVEL=info
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### 2.3 Generate Secure Keys
Use these commands to generate secure keys:

```bash
# JWT Secret (copy the output)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Encryption Key (must be exactly 32 characters)
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
```

Or use online generators:
- [JWT Secret Generator](https://www.allkeysgenerator.com/Random/Security-Encryption-Key-Generator.aspx)
- Make sure Encryption Key is exactly 32 characters!

### 2.4 Deploy!
1. Click **"Deploy"** 
2. Wait 3-5 minutes for build and deployment
3. Get your live URL: `https://your-project-name.vercel.app`

## ✅ **Step 3: Test Your Live App**

### 3.1 Basic Functionality Test
1. **Visit your Vercel URL**
2. **Dashboard should load** with stats (will show zeros initially)
3. **Navigate between pages** (Templates, Import, etc.)
4. **Check API health**: Visit `https://your-app.vercel.app/health`

### 3.2 Database Test
1. Go to **Templates** page
2. Should see 3 pre-loaded templates:
   - B2B SaaS Starter
   - E-commerce Store  
   - Professional Services
3. Try creating a new template

### 3.3 Import Workflow Test
1. Go to **Import** page
2. Create a test CSV:
   ```csv
   First Name,Last Name,Email,Company
   John,Doe,john@example.com,Acme Corp
   Jane,Smith,jane@example.com,Beta Inc
   ```
3. Upload and test the 4-step workflow
4. Should see intelligent field mapping suggestions

### 3.4 HubSpot Integration Test (Optional)
1. Get a HubSpot API key from your HubSpot account
2. Click the **"No API Key"** status in the sidebar
3. Enter your API key - should validate successfully
4. Try deploying a configuration (will create real HubSpot properties!)

## 🔧 **Environment Variables Reference**

### Required Variables
```bash
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres
NODE_ENV=production
JWT_SECRET=64-character-random-string
ENCRYPTION_KEY=exactly-32-character-string
```

### Optional Variables
```bash
CLIENT_URL=https://your-app.vercel.app
LOG_LEVEL=info
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
HUBSPOT_APP_ID=your-hubspot-app-id
HUBSPOT_CLIENT_SECRET=your-hubspot-client-secret
REDIS_URL=redis://your-redis-url (for advanced rate limiting)
```

## 🎯 **Quick Deploy Buttons**

### Deploy to Vercel
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/geordiefrost/hubspot-automation)

### Setup Supabase
[![Setup Supabase](https://supabase.com/button)](https://supabase.com/new)

## 🛠️ **Troubleshooting**

### Build Fails
**Problem**: "Build failed" on Vercel
**Solutions**:
1. Check build logs in Vercel dashboard
2. Ensure all environment variables are set
3. Try redeploying: Dashboard → Deployments → "Redeploy"

### Database Connection Issues
**Problem**: "Database connection failed"
**Solutions**:
1. Verify `DATABASE_URL` is correct and includes password
2. Check Supabase project is active (not paused)
3. Test connection in Supabase dashboard

### App Loads but No Data
**Problem**: Templates page is empty
**Solutions**:
1. Run the seed SQL script in Supabase SQL Editor
2. Check database tables exist in Supabase Table Editor
3. Verify `DATABASE_URL` environment variable

### API Errors
**Problem**: "Internal Server Error" on API calls
**Solutions**:
1. Check Vercel function logs: Dashboard → Functions → View logs
2. Verify all required environment variables are set
3. Check that JWT_SECRET and ENCRYPTION_KEY are proper length

### HubSpot Integration Issues
**Problem**: "Invalid API key" errors
**Solutions**:
1. Verify API key format: should start with `pat-` or `sk-`
2. Check HubSpot API key permissions/scopes
3. Test API key directly in HubSpot's API explorer

## 📊 **Monitoring Your App**

### Vercel Analytics
- Go to your project dashboard
- Click **"Analytics"** tab
- Monitor page views, API calls, performance

### Supabase Monitoring
- Go to Supabase dashboard
- Click **"Database"** → **"Logs"**
- Monitor queries and connections

### Error Tracking
- Check Vercel function logs for API errors
- Monitor Supabase logs for database issues
- Set up alerts in both platforms

## 🚀 **What You Get**

After successful deployment, you'll have:

✅ **Full-stack web application** at your Vercel URL
✅ **PostgreSQL database** with all tables and sample data
✅ **4-step CSV import workflow** with intelligent mapping
✅ **Template management system** with industry presets
✅ **Real-time deployment tracking** (when using HubSpot API)
✅ **Security features** (rate limiting, validation, encryption)
✅ **Responsive design** that works on mobile and desktop
✅ **Production-ready** with proper error handling

## 💡 **Pro Tips**

1. **Custom Domain**: Add your own domain in Vercel dashboard
2. **Environment Separation**: Create preview deployments for testing
3. **Database Backups**: Supabase automatically backs up your data
4. **Monitoring**: Set up alerts for errors and performance issues
5. **Updates**: Push to GitHub to auto-deploy updates

## 🎉 **Success!**

Your HubSpot Automation Platform is now live! Share your URL and start automating HubSpot setups for clients.

**Live App**: `https://your-project-name.vercel.app`
**Database**: Managed by Supabase
**Hosting**: Powered by Vercel

## 🆘 **Need Help?**

If you run into issues:
1. Check the troubleshooting section above
2. Look at Vercel deployment logs
3. Check Supabase database connection
4. Create an issue on the GitHub repository

**Deployment Time**: ~8-10 minutes total
**Monthly Cost**: $0 (both platforms have generous free tiers)