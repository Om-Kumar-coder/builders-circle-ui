import { NextResponse } from 'next/server';

export async function GET() {
  const envVars = {
    NEXT_PUBLIC_APPWRITE_ENDPOINT: process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || 'MISSING',
    NEXT_PUBLIC_APPWRITE_PROJECT_ID: process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || 'MISSING',
    NEXT_PUBLIC_APPWRITE_DATABASE_ID: process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || 'MISSING',
    NEXT_PUBLIC_APPWRITE_ACTIVITY_COLLECTION_ID: process.env.NEXT_PUBLIC_APPWRITE_ACTIVITY_COLLECTION_ID || 'MISSING',
    NEXT_PUBLIC_APPWRITE_CYCLES_COLLECTION_ID: process.env.NEXT_PUBLIC_APPWRITE_CYCLES_COLLECTION_ID || 'MISSING',
    NEXT_PUBLIC_APPWRITE_PARTICIPATION_COLLECTION_ID: process.env.NEXT_PUBLIC_APPWRITE_PARTICIPATION_COLLECTION_ID || 'MISSING',
  };

  const allPresent = Object.values(envVars).every(v => v !== 'MISSING');

  return NextResponse.json({
    success: allPresent,
    variables: envVars,
    message: allPresent 
      ? 'All environment variables are loaded correctly' 
      : 'Some environment variables are missing',
  });
}
