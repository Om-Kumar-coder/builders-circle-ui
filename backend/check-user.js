const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function checkUser() {
  try {
    const user = await prisma.user.findFirst({
      where: { email: 'admin@test.com' },
      include: { profile: true }
    });
    
    if (user) {
      console.log('User found:', {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.profile?.role,
        passwordHash: user.password.substring(0, 20) + '...'
      });
      
      // Test password
      const testPasswords = ['password123', 'admin123', 'test123', 'password'];
      for (const pwd of testPasswords) {
        const isValid = await bcrypt.compare(pwd, user.password);
        console.log(`Password "${pwd}": ${isValid ? '✅ VALID' : '❌ invalid'}`);
        if (isValid) break;
      }
    } else {
      console.log('No user found with email admin@test.com');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUser();