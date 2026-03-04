/**
 * Update Drive File Tool
 * Upload a new version of an existing file (307 redirect handling)
 */

import { z } from 'zod';
import axios from 'axios';
import path from 'path';
import fs from 'fs';
import { formatError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';

export const updateDriveFileSchema = z.object({
  driveId: z.string().describe('Drive ID'),
  fileId: z.string().describe('File ID to update'),
  filePath: z.string().describe('Absolute path to the new version of the file'),
});

export type UpdateDriveFileInput = z.infer<typeof updateDriveFileSchema>;

export async function updateDriveFileHandler(args: UpdateDriveFileInput) {
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
    const apiUrl = `${baseUrl}/drive/v1/drives/${args.driveId}/files/${args.fileId}?media=raw`;

    const buildFormData = () => {
      const form = new FormData();
      form.append('file', new Blob([fs.readFileSync(args.filePath)]), fileName);
      return form;
    };

    // Step 1: Initial PUT request to detect 307 redirect
    logger.debug(`Drive update step 1: PUT ${apiUrl}`);

    const step1Response = await axios.put(apiUrl, buildFormData(), {
      headers: { 'Authorization': `dooray-api ${apiToken}` },
      maxRedirects: 0,
      validateStatus: (status: number) => (status >= 200 && status < 300) || status === 307,
    });

    logger.debug(`Step 1 response: HTTP ${step1Response.status}`);

    let response: { header?: { isSuccessful: boolean; resultMessage?: string }; result: { id: string; version?: number } };

    if (step1Response.status === 307) {
      const redirectUrl = step1Response.headers['location'];
      logger.debug(`Drive update step 2: PUT ${redirectUrl}`);

      const step2Response = await axios.put(redirectUrl, buildFormData(), {
        headers: { 'Authorization': `dooray-api ${apiToken}` },
      });
      response = step2Response.data;
    } else {
      response = step1Response.data;
    }

    if (!response.header?.isSuccessful) {
      throw new Error(response.header?.resultMessage || 'Update failed');
    }

    const result = response.result;

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          fileId: result.id,
          version: result.version,
          fileName: fileName,
          message: `File "${fileName}" updated successfully (new version uploaded).`,
        }, null, 2),
      }],
    };
  } catch (error) {
    return { content: [{ type: 'text', text: `Error: ${formatError(error)}` }], isError: true };
  }
}

export const updateDriveFileTool = {
  name: 'update-drive-file',
  description: `Upload a new version of an existing file in a Dooray drive.

**Required:**
- driveId: The drive ID
- fileId: The file ID to update
- filePath: Absolute path to the new version of the file

**Example:**
{ "driveId": "123", "fileId": "456", "filePath": "/Users/name/updated-document.pdf" }

Returns: File ID and new version number.

**Note:** This replaces the file content with a new version. The file must exist at the specified path.`,
  inputSchema: {
    type: 'object',
    properties: {
      driveId: { type: 'string', description: 'Drive ID' },
      fileId: { type: 'string', description: 'File ID to update' },
      filePath: { type: 'string', description: 'Absolute path to the new file version' },
    },
    required: ['driveId', 'fileId', 'filePath'],
  },
};
