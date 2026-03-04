/**
 * Upload Drive File Tool
 * Upload a file to a drive folder (307 redirect handling)
 */

import { z } from 'zod';
import axios from 'axios';
import path from 'path';
import fs from 'fs';
import { formatError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';

export const uploadDriveFileSchema = z.object({
  driveId: z.string().describe('Drive ID'),
  parentId: z.string().describe('Parent folder ID to upload into'),
  filePath: z.string().describe('Absolute path to the file to upload'),
});

export type UploadDriveFileInput = z.infer<typeof uploadDriveFileSchema>;

export async function uploadDriveFileHandler(args: UploadDriveFileInput) {
  try {
    const apiToken = process.env.DOORAY_API_TOKEN;
    if (!apiToken) {
      throw new Error('DOORAY_API_TOKEN environment variable is required');
    }

    if (!fs.existsSync(args.filePath)) {
      throw new Error(`File not found: ${args.filePath}`);
    }

    const fileName = path.basename(args.filePath);
    const baseUrl = process.env.DOORAY_API_BASE_URL || 'https://api.dooray.com';
    const apiUrl = `${baseUrl}/drive/v1/drives/${args.driveId}/files?parentId=${args.parentId}`;

    const buildFormData = () => {
      const form = new FormData();
      form.append('file', new Blob([fs.readFileSync(args.filePath)]), fileName);
      return form;
    };

    // Step 1: Initial request to detect 307 redirect
    logger.debug(`Drive upload step 1: POST ${apiUrl}`);

    const step1Response = await axios.post(apiUrl, buildFormData(), {
      headers: { 'Authorization': `dooray-api ${apiToken}` },
      maxRedirects: 0,
      validateStatus: (status: number) => (status >= 200 && status < 300) || status === 307,
    });

    logger.debug(`Step 1 response: HTTP ${step1Response.status}`);

    let response: { header?: { isSuccessful: boolean; resultMessage?: string }; result: { id: string } };

    if (step1Response.status === 307) {
      const redirectUrl = step1Response.headers['location'];
      logger.debug(`Drive upload step 2: POST ${redirectUrl}`);

      const step2Response = await axios.post(redirectUrl, buildFormData(), {
        headers: { 'Authorization': `dooray-api ${apiToken}` },
      });
      response = step2Response.data;
    } else {
      response = step1Response.data;
    }

    if (!response.header?.isSuccessful) {
      throw new Error(response.header?.resultMessage || 'Upload failed');
    }

    const result = response.result;

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          fileId: result.id,
          fileName: fileName,
          message: `File "${fileName}" uploaded successfully to drive.`,
        }, null, 2),
      }],
    };
  } catch (error) {
    return { content: [{ type: 'text', text: `Error: ${formatError(error)}` }], isError: true };
  }
}

export const uploadDriveFileTool = {
  name: 'upload-drive-file',
  description: `Upload a file to a Dooray drive folder.

**Required:**
- driveId: The drive ID
- parentId: Parent folder ID to upload the file into
- filePath: Absolute path to the file to upload

**Example:**
{ "driveId": "123", "parentId": "456", "filePath": "/Users/name/document.pdf" }

Returns: File ID of the uploaded file.

**Note:** The file must exist at the specified path.`,
  inputSchema: {
    type: 'object',
    properties: {
      driveId: { type: 'string', description: 'Drive ID' },
      parentId: { type: 'string', description: 'Parent folder ID' },
      filePath: { type: 'string', description: 'Absolute path to the file to upload' },
    },
    required: ['driveId', 'parentId', 'filePath'],
  },
};
