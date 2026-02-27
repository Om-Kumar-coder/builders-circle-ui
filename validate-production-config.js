#!/usr/bin/env node

/**
 * Production Configuration Validator
 * Verifies that all configuration is set correctly for production deployment
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Validating Production Configuration...\n');

let hasErrors = false;
let hasWarnings = false;

// Load .env.local
function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  
  const content = fs.readFileSync(filePath, 'utf8');
  const env = {};
  
  content.split('\n').forEach(line => {
    const match = line.match(/^([^=:#]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim();
      env[key] = value;
    }
  });
  
  return env;
}

// Check for localhost references in source files
function checkForLocalhost(dir, extensions = ['.ts', '.tsx', '.js', '.jsx']) {
  const localhostRefs = [];
  
  function scanDir(currentDir) {
    const items = fs.readdirSync(currentDir);
    
    for (const item of items) {
      const fullPath = path.join(currentDir, item);
      const stat = fs.statSync(fullPath);
      
      // Skip node_modules, .next, and other build directories
      if (item === 'node_modules' || item === '.next' || item === '.git') {
        continue;
      }
      
      if (stat.isDirectory()) {
        scanDir(fullPath);
      } else if (extensions.some(ext => item.endsWith(ext))) {
        const content = fs.readFileSync(fullPath, 'utf8');
        if (content.includes('localhost') || content.includes('127.0.0.1')) {
          localhostRefs.push(fullPath);
        }
      }
    }
  }
  
  scanDir(dir);
  return localhostRefs;
}

// 1. Check .env.local exists
console.log('📄 Checking .env.local...');
const env = loadEnvFile('.env.local');

if (!env) {
  console.error('  ❌ .env.local file not found!');
  hasErrors = true;
} else {
  console.log('  ✅ .env.local exists');
  
  // 2. Validate required variables
  const required = {
    'NEXT_PUBLIC_APPWRITE_ENDPOINT': 'http://148.230.90.1/v1',
    'NEXT_PUBLIC_APPWRITE_PROJECT_ID': '69948407003ab1a59d8d',
    'NEXT_PUBLIC_APPWRITE_FUNCTION_ID': '69933d31002f287121c6',
    'NEXT_PUBLIC_APPWRITE_DATABASE_ID': 'builder_circle',
    'NEXT_PUBLIC_APPWRITE_USERS_COLLECTION_ID': 'user_profiles',
    'NEXT_PUBLIC_APPWRITE_CYCLES_COLLECTION_ID': 'build_cycles',
    'NEXT_PUBLIC_APPWRITE_PARTICIPATION_COLLECTION_ID': 'cycle_participation'
  };
  
  console.log('\n🔑 Validating environment variables...');
  for (const [key, expectedValue] of Object.entries(required)) {
    if (!env[key]) {
      console.error(`  ❌ Missing: ${key}`);
      hasErrors = true;
    } else if (env[key] !== expectedValue) {
      console.warn(`  ⚠️  ${key}`);
      console.warn(`     Expected: ${expectedValue}`);
      console.warn(`     Got: ${env[key]}`);
      hasWarnings = true;
    } else {
      console.log(`  ✅ ${key}`);
    }
  }
  
  // 3. Check for localhost in endpoint
  if (env['NEXT_PUBLIC_APPWRITE_ENDPOINT']?.includes('localhost')) {
    console.error('  ❌ Endpoint still contains localhost!');
    hasErrors = true;
  }
}

// 4. Check for localhost in source code
console.log('\n🔍 Scanning source code for localhost references...');
const srcRefs = checkForLocalhost('src');
const appRefs = checkForLocalhost('app');

if (srcRefs.length > 0 || appRefs.length > 0) {
  console.error('  ❌ Found localhost references in source code:');
  [...srcRefs, ...appRefs].forEach(file => {
    console.error(`     - ${file}`);
  });
  hasErrors = true;
} else {
  console.log('  ✅ No localhost references in source code');
}

// 5. Check appwrite.config.json
console.log('\n📋 Checking appwrite.config.json...');
if (fs.existsSync('appwrite.config.json')) {
  const config = JSON.parse(fs.readFileSync('appwrite.config.json', 'utf8'));
  
  if (config.projectId === '69948407003ab1a59d8d') {
    console.log('  ✅ Project ID is correct');
  } else {
    console.error(`  ❌ Project ID mismatch: ${config.projectId}`);
    hasErrors = true;
  }
  
  // Check database ID
  const db = config.tablesDB?.[0];
  if (db?.$id === 'builder_circle') {
    console.log('  ✅ Database ID is correct');
  } else {
    console.error(`  ❌ Database ID mismatch: ${db?.$id}`);
    hasErrors = true;
  }
} else {
  console.warn('  ⚠️  appwrite.config.json not found');
  hasWarnings = true;
}

// 6. Check function configuration
console.log('\n⚙️  Checking function configuration...');
const functionConfigPath = 'functions/computeOwnership/appwrite.json';
if (fs.existsSync(functionConfigPath)) {
  const functionConfig = JSON.parse(fs.readFileSync(functionConfigPath, 'utf8'));
  
  if (functionConfig.projectId === '69948407003ab1a59d8d') {
    console.log('  ✅ Function project ID is correct');
  } else {
    console.error(`  ❌ Function project ID mismatch: ${functionConfig.projectId}`);
    hasErrors = true;
  }
} else {
  console.warn('  ⚠️  Function config not found');
  hasWarnings = true;
}

// 7. Check if .next exists (should be cleared)
console.log('\n🗑️  Checking build cache...');
if (fs.existsSync('.next')) {
  console.warn('  ⚠️  .next folder exists - consider clearing before production build');
  hasWarnings = true;
} else {
  console.log('  ✅ Build cache is clear');
}

// Summary
console.log('\n' + '='.repeat(60));
if (hasErrors) {
  console.error('\n❌ VALIDATION FAILED - Please fix the errors above\n');
  process.exit(1);
} else if (hasWarnings) {
  console.warn('\n⚠️  VALIDATION PASSED WITH WARNINGS\n');
  console.log('Review warnings above before deploying to production.\n');
  process.exit(0);
} else {
  console.log('\n✅ ALL CHECKS PASSED - Ready for production!\n');
  console.log('Next steps:');
  console.log('  1. npm run build');
  console.log('  2. Test locally with: npm run start');
  console.log('  3. Deploy to production\n');
  process.exit(0);
}
