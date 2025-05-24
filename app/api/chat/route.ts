import { NextRequest, NextResponse } from 'next/server';
import { applySecurityHeaders, isPublicRoute } from '@/lib/auth-utils';

type ChatError = {
  message: string;
  stack?: string;
  details?: unknown;
};

type FileData = {
  type: string;
  transfer_method: 'local_file';
  upload_file_id: string;
};

type RequestBody = {
  inputs: Record<string, unknown>;
  query: string;
  response_mode: string;
  user: string;
  conversation_id?: string;
  files?: FileData[];
};

const DIFY_API_KEY = process.env.NEXT_PUBLIC_DIFY_API_KEY;
const DIFY_API_URL = "https://api.dify.ai/v1/chat-messages";

export const runtime = 'edge'; 

// Simple auth check for Edge API routes
async function simpleAuthCheck(req: NextRequest): Promise<boolean> {
  const cookieHeader = req.headers.get('cookie');
  if (!cookieHeader) return false;
  
  // Just check if the session cookie exists
  // We can't verify it in Edge Runtime, but this provides basic protection
  const hasSessionCookie = cookieHeader.includes('__session=');
  return hasSessionCookie;
}

export async function POST(req: NextRequest) {
  try {
    const pathname = req.nextUrl.pathname;
   
    
    const { query, conversation_id, user: userIdFromRequest, files } = await req.json();

    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    const headers = {
      'Authorization': `Bearer ${DIFY_API_KEY}`,
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream',
    };

    const userId = userIdFromRequest || "website-user-" + Date.now().toString().slice(-6);

    const requestBody: RequestBody = {
      inputs: {},
      query: query,
      response_mode: "streaming",
      user: userId,
    };

    
    if (conversation_id) {
      requestBody.conversation_id = conversation_id;
    }

    
    if (files && Array.isArray(files) && files.length > 0) {
      
      const isValidFiles = files.every(file => 
        typeof file === 'object' && 
        file !== null &&
        typeof file.type === 'string' &&
        file.transfer_method === 'local_file' &&
        typeof file.upload_file_id === 'string'
      );

      if (!isValidFiles) {
        console.error("API Chat Route: Invalid file structure received from frontend:", JSON.stringify(files, null, 2));
        return NextResponse.json({ error: 'Invalid file structure provided' }, { status: 400 });
      }
      requestBody.files = files; 
    }

    const difyResponse = await fetch(DIFY_API_URL, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(requestBody),
    });

    if (!difyResponse.ok) {
      const errorText = await difyResponse.text();
      let errorJson: unknown = {};
      try { errorJson = JSON.parse(errorText); } catch {}
      console.error("API Chat Route: Dify API returned an error:", difyResponse.status, errorText);
      const errorResponse = new NextResponse(JSON.stringify({ error: `Dify API Error: ${difyResponse.status}`, details: errorJson || errorText }), {
        status: difyResponse.status,
        headers: { 'Content-Type': 'application/json' },
      });
      return applySecurityHeaders(errorResponse);
    }

    if (!difyResponse.body) {
      console.error("API Chat Route: Dify response body is null after OK status");
      const errorResponse = NextResponse.json({ error: "Dify response body is null" }, { status: 500 });
      return applySecurityHeaders(errorResponse);
    }

    const responseStream = difyResponse.body;

    const response = new NextResponse(responseStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
    
    return applySecurityHeaders(response);

  } catch (error: unknown) {
    const chatError = error as ChatError;
    console.error("API Chat Route: Caught Internal Server Error:", chatError.message);
    
    const errorResponse = new NextResponse(JSON.stringify({ 
      error: 'Internal Server Error', 
      details: chatError.stack || chatError.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
    
    return applySecurityHeaders(errorResponse);
  }
} 
