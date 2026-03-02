/**
 * Transcript File Upload API
 *
 * Enables agents and users to upload .txt transcript files via REST API.
 * Files are validated and stored in the input/ directory for processing.
 */

import { NextRequest, NextResponse } from 'next/server';
import { mkdirSync, writeFileSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { validateAuth } from '@/lib/auth';
import { getLogger } from '@/src/utils/logging';
import { SafeFileContext } from '@/src/utils/paths';
import {
  validateFileSize,
  validateFileExtension,
  sanitizeFilename,
  constructSafePath,
  getUploadConfig,
} from '@/lib/upload-helpers';

const logger = getLogger();
const uploadConfig = getUploadConfig();

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
    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided', details: 'Form must include "file" field' },
        { status: 400 }
      );
    }

    // Get filename (fallback to generated name)
    const filename = file.name || 'transcript.txt';

    // Validate file extension
    const extValidation = validateFileExtension(filename, uploadConfig.allowedExtensions);
    if (!extValidation.valid) {
      logger.warn(`Upload rejected: invalid file type from ${userId}`, { filename });
      return NextResponse.json(
        { error: 'Invalid file type', details: extValidation.error },
        { status: 400 }
      );
    }

    // Validate file size
    const sizeValidation = validateFileSize(file.size, uploadConfig.maxFileSize);
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

    // Sanitize filename and construct safe path
    const safeFilename = sanitizeFilename(filename);
    const pathResult = constructSafePath(safeFilename, uploadConfig.uploadDir);

    if (!pathResult.safe) {
      logger.error(`Upload rejected: path traversal attempt by ${userId}`, {
        requestedFile: filename,
        error: pathResult.error,
      });
      return NextResponse.json(
        { error: 'Invalid file path', details: pathResult.error },
        { status: 400 }
      );
    }

    // Ensure upload directory exists
    mkdirSync(uploadConfig.uploadDir, { recursive: true });

    // Use SafeFileContext for final validation
    const fileContext = new SafeFileContext(resolve(uploadConfig.uploadDir));
    const safePath = fileContext.resolve(safeFilename);

    // Read file content
    const buffer = await file.arrayBuffer();
    const content = Buffer.from(buffer);

    // Write file
    writeFileSync(safePath, content, 'utf-8');

    logger.info(`Transcript uploaded by ${userId}`, {
      filename: safeFilename,
      size: content.length,
      originalName: filename,
    });

    // Get file stats
    const stats = statSync(safePath);

    return NextResponse.json(
      {
        success: true,
        file: {
          name: safeFilename,
          originalName: filename,
          size: stats.size,
          path: pathResult.path,
          uploadedAt: new Date().toISOString(),
        },
        message: 'File uploaded successfully. Ready for analysis with /api/analyze',
        nextSteps: [
          'Use POST /api/analyze to start analysis',
          'Poll GET /api/analyze/status?jobId=<id> to monitor progress',
        ],
      },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`File upload failed for ${userId}`, { error: message });

    return NextResponse.json(
      { error: 'Upload failed', details: message },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint to check upload endpoint status and retrieve documentation
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

  const maxSizeMB = (uploadConfig.maxFileSize / 1024 / 1024).toFixed(1);
  const supportedExtensions = uploadConfig.allowedExtensions.join(', ');

  return NextResponse.json({
    status: 'ready',
    endpoint: '/api/upload/transcript',
    method: 'POST',
    contentType: 'multipart/form-data',
    requirements: {
      authentication: 'Required (Bearer JWT token)',
      fileField: 'file (form field name)',
      fileTypes: supportedExtensions,
      maxSize: `${maxSizeMB}MB`,
    },
    validation: {
      fileExtensions: uploadConfig.allowedExtensions,
      maxFileSize: uploadConfig.maxFileSize,
      uploadDirectory: uploadConfig.uploadDir,
      pathTraversalProtection: true,
      filenameNormalization: true,
    },
    examples: {
      curl: `curl -X POST http://localhost:3000/api/upload/transcript \\
  -H "Authorization: Bearer <token>" \\
  -F "file=@transcript.txt"`,
      javascript: `const formData = new FormData();
formData.append('file', file);
const response = await fetch('/api/upload/transcript', {
  method: 'POST',
  headers: { 'Authorization': \`Bearer \${token}\` },
  body: formData
});
const result = await response.json();
console.log(result.file.name);`,
      python: `import requests
files = {'file': open('transcript.txt', 'rb')}
headers = {'Authorization': f'Bearer {token}'}
response = requests.post(
  'http://localhost:3000/api/upload/transcript',
  files=files,
  headers=headers
)`,
    },
  });
}
