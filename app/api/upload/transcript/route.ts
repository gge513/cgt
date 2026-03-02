/**
 * Transcript File Upload API
 *
 * Enables agents and users to upload .txt transcript files via REST API.
 * Files are validated and stored in the input/ directory for processing.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createWriteStream, mkdirSync, statSync } from 'fs';
import { join } from 'path';
import { Readable } from 'stream';
import { v4 as uuid } from 'uuid';
import { validateAuth } from '@/lib/auth';
import { getLogger } from '@/src/utils/logging';

const logger = getLogger();

// Constants from environment or defaults
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || '10485760', 10);  // 10MB
const INPUT_DIR = 'input';

/**
 * Sanitize filename to prevent directory traversal
 */
function sanitizeFilename(filename: string): string {
  // Remove any path separators and null bytes
  let safe = filename.replace(/[\/\\]/g, '').replace(/\0/g, '');

  // Remove leading dots (hidden files)
  safe = safe.replace(/^\.+/, '');

  // Keep only safe characters
  safe = safe.replace(/[^a-zA-Z0-9._\-]/g, '-');

  // Remove trailing dots/spaces
  safe = safe.replace(/[\s.]+$/, '');

  // Ensure it's not empty
  if (!safe) {
    safe = `transcript-${uuid()}.txt`;
  }

  return safe;
}

/**
 * Validate file size
 */
function validateFileSize(size: number): { valid: boolean; error?: string } {
  if (size === 0) {
    return { valid: false, error: 'File is empty' };
  }

  if (size > MAX_FILE_SIZE) {
    const sizeMB = (MAX_FILE_SIZE / 1024 / 1024).toFixed(1);
    return {
      valid: false,
      error: `File exceeds size limit (${sizeMB}MB). Current: ${(size / 1024 / 1024).toFixed(1)}MB`,
    };
  }

  return { valid: true };
}

/**
 * Validate file extension
 */
function validateFileExtension(filename: string): { valid: boolean; error?: string } {
  if (!filename.toLowerCase().endsWith('.txt')) {
    return {
      valid: false,
      error: 'Only .txt files are supported. Received: ' + filename.split('.').pop(),
    };
  }

  return { valid: true };
}

export async function POST(request: NextRequest) {
  // Validate authentication
  const authResult = validateAuth(request);
  if (!authResult.authenticated) {
    return NextResponse.json(
      { error: 'Unauthorized', details: authResult.error },
      { status: 401 }
    );
  }

  const userId = authResult.userId || 'unknown';

  try {
    // Get form data
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided', details: 'Form must include "file" field' },
        { status: 400 }
      );
    }

    // Validate filename
    const filename = file.name || `transcript-${uuid()}.txt`;
    const extensionValidation = validateFileExtension(filename);
    if (!extensionValidation.valid) {
      logger.warn(`Upload rejected: invalid file type from ${userId}`, {
        filename,
      });
      return NextResponse.json(
        { error: 'Invalid file type', details: extensionValidation.error },
        { status: 400 }
      );
    }

    // Validate file size
    const sizeValidation = validateFileSize(file.size);
    if (!sizeValidation.valid) {
      logger.warn(`Upload rejected: file size from ${userId}`, {
        filename,
        size: file.size,
      });
      return NextResponse.json(
        { error: 'File too large', details: sizeValidation.error },
        { status: 400 }
      );
    }

    // Sanitize filename
    const safeFilename = sanitizeFilename(filename);

    // Ensure input directory exists
    mkdirSync(INPUT_DIR, { recursive: true });

    // Construct safe path
    const filePath = join(INPUT_DIR, safeFilename);

    // Verify path is within input directory (prevent traversal)
    const resolvedPath = require('path').resolve(filePath);
    const resolvedInputDir = require('path').resolve(INPUT_DIR);
    if (!resolvedPath.startsWith(resolvedInputDir)) {
      logger.error(`Upload rejected: path traversal attempt by ${userId}`, {
        requestedFile: filename,
        resolvedPath,
      });
      return NextResponse.json(
        { error: 'Invalid file path', details: 'Path traversal not allowed' },
        { status: 400 }
      );
    }

    // Stream file to disk
    const buffer = await file.arrayBuffer();
    const content = Buffer.from(buffer);

    // Double-check size after reading
    if (content.length > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File too large', details: 'File size exceeds limit' },
        { status: 400 }
      );
    }

    // Write file
    require('fs').writeFileSync(filePath, content, 'utf-8');

    logger.info(`Transcript uploaded by ${userId}`, {
      filename: safeFilename,
      size: content.length,
      originalName: filename,
    });

    // Get file stats
    const stats = statSync(filePath);

    return NextResponse.json(
      {
        success: true,
        file: {
          name: safeFilename,
          originalName: filename,
          size: content.length,
          path: filePath,
          uploadedAt: new Date().toISOString(),
        },
        message: 'File uploaded successfully. Ready for analysis with /api/analyze',
        nextSteps: [
          'Use POST /api/analyze to start analysis',
          'Poll GET /api/analyze/status?jobId=<id> to monitor progress',
        ],
      },
      { status: 201 }  // 201 Created
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    logger.error(`File upload failed for ${userId}`, { error: message });

    return NextResponse.json(
      {
        error: 'Upload failed',
        details: message,
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint to check upload endpoint status
 */
export async function GET(request: NextRequest) {
  // Validate authentication
  const authResult = validateAuth(request);
  if (!authResult.authenticated) {
    return NextResponse.json(
      { error: 'Unauthorized', details: authResult.error },
      { status: 401 }
    );
  }

  return NextResponse.json({
    status: 'ready',
    endpoint: '/api/upload/transcript',
    method: 'POST',
    contentType: 'multipart/form-data',
    requirements: {
      authentication: 'Required (Bearer JWT token)',
      fileField: 'file (form field name)',
      fileType: '.txt only',
      maxSize: `${(MAX_FILE_SIZE / 1024 / 1024).toFixed(1)}MB`,
    },
    example: {
      curl: `curl -X POST http://localhost:3000/api/upload/transcript \\
  -H "Authorization: Bearer <token>" \\
  -F "file=@transcript.txt"`,
      javascript: `const formData = new FormData();
formData.append('file', file);
fetch('/api/upload/transcript', {
  method: 'POST',
  headers: { 'Authorization': \`Bearer \${token}\` },
  body: formData
});`,
    },
  });
}
