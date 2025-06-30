// Quick test setup script for PrimePulse 144
// Run with: node test-setup.js

const axios = require('axios');
const fs = require('fs');

// Test configuration
const API_BASE_URL = 'http://localhost:3000';
const API_KEY = 'pp144-mvp-api-key-2024';
const TEST_ASINS = [
  { asin: 'B08N5WRWNW', title: 'Echo Dot (4th Gen)', priority: 5 },
  { asin: 'B07XJ8C8F5', title: 'Fire TV Stick 4K', priority: 4 },
  { asin: 'B08C1W5N87', title: 'Echo Show 5', priority: 3 }
];

async function testPrimePulse() {
  console.log('🚀 Testing PrimePulse 144 Setup...');
  
  try {
    // Test 1: Health Check
    console.log('\n1. Testing Health Check...');
    const healthResponse = await axios.get(`${API_BASE_URL}/api/health`);
    console.log('✅ Health check passed:', healthResponse.data.message);
    
    // Test 2: Add Test ASINs
    console.log('\n2. Adding test ASINs...');
    for (const asin of TEST_ASINS) {
      try {
        const response = await axios.post(`${API_BASE_URL}/api/asins`, asin, {
          headers: { 'X-API-Key': API_KEY, 'Content-Type': 'application/json' }
        });
        console.log(`✅ Added ASIN: ${asin.asin} - ${asin.title}`);
      } catch (error) {
        if (error.response?.status === 400 && error.response.data.error?.includes('already exists')) {
          console.log(`⚠️  ASIN ${asin.asin} already exists (skipping)`);
        } else {
          throw error;
        }
      }
    }
    
    // Test 3: Get ASINs
    console.log('\n3. Retrieving ASINs...');
    const asinsResponse = await axios.get(`${API_BASE_URL}/api/asins`, {
      headers: { 'X-API-Key': API_KEY }
    });
    console.log(`✅ Retrieved ${asinsResponse.data.count} ASINs`);
    
    // Test 4: Test Alert Configuration
    console.log('\n4. Testing alert configuration...');
    const alertConfigResponse = await axios.get(`${API_BASE_URL}/api/alerts/config`, {
      headers: { 'X-API-Key': API_KEY }
    });
    console.log('✅ Alert configuration retrieved:', alertConfigResponse.data);
    
    // Test 5: Test Slack Alert (if webhook configured)
    if (process.env.SLACK_WEBHOOK_URL) {
      console.log('\n5. Testing Slack integration...');
      try {
        await axios.post(`${API_BASE_URL}/api/alerts/test`, { channel: 'slack' }, {
          headers: { 'X-API-Key': API_KEY, 'Content-Type': 'application/json' }
        });
        console.log('✅ Slack test alert sent successfully');
      } catch (error) {
        console.log('⚠️  Slack test failed (check webhook URL):', error.response?.data?.error);
      }
    } else {
      console.log('\n5. Skipping Slack test (SLACK_WEBHOOK_URL not configured)');
    }
    
    // Test 6: Worker Health Check (if configured)
    if (process.env.CLOUDFLARE_WORKER_URL) {
      console.log('\n6. Testing Cloudflare Worker...');
      try {
        const workerResponse = await axios.get(`${process.env.CLOUDFLARE_WORKER_URL}/health`);
        console.log('✅ Cloudflare Worker is healthy:', workerResponse.data.status);
      } catch (error) {
        console.log('⚠️  Cloudflare Worker test failed:', error.message);
      }
    } else {
      console.log('\n6. Skipping Worker test (CLOUDFLARE_WORKER_URL not configured)');
    }
    
    console.log('\n🎉 PrimePulse 144 setup test completed successfully!');
    console.log('\n📋 Next Steps:');
    console.log('1. Configure your environment variables in .env');
    console.log('2. Deploy Cloudflare Workers: wrangler deploy');
    console.log('3. Set up Slack webhook for alerts');
    console.log('4. Start the scheduler: set ENABLE_SCHEDULER=true');
    console.log('5. Monitor logs in ./logs/ directory');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
    process.exit(1);
  }
}

// Check if server is running
async function checkServer() {
  try {
    await axios.get(`${API_BASE_URL}/api/health`, { timeout: 5000 });
    return true;
  } catch (error) {
    return false;
  }
}

async function main() {
  console.log('Checking if PrimePulse 144 server is running...');
  
  const serverRunning = await checkServer();
  if (!serverRunning) {
    console.log('❌ Server not running. Please start with: npm run dev');
    console.log('   or: docker-compose up -d');
    process.exit(1);
  }
  
  await testPrimePulse();
}

if (require.main === module) {
  main();
}

module.exports = { testPrimePulse, checkServer };