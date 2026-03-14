const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testModels() {
  try {
    console.log('🔍 Testing Prisma models...');
    
    // List available models
    const models = Object.keys(prisma).filter(key => 
      !key.startsWith('$') && 
      !key.startsWith('_') && 
      typeof prisma[key] === 'object' &&
      prisma[key].findMany
    );
    
    console.log('📋 Available models:', models);
    
    // Test userActivitySession specifically
    if (models.includes('userActivitySession')) {
      console.log('✅ userActivitySession model found');
      const count = await prisma.userActivitySession.count();
      console.log(`📊 Total sessions: ${count}`);
    } else {
      console.log('❌ userActivitySession model NOT found');
      console.log('Available models that might be related:', 
        models.filter(m => m.toLowerCase().includes('session') || m.toLowerCase().includes('activity'))
      );
    }
    
  } catch (error) {
    console.error('❌ Error testing models:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testModels();