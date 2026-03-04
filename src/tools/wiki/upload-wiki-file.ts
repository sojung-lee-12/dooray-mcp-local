/**
 * Upload Wiki File Tool
 * Upload a file to a wiki (not page-specific, 307 redirect handling)
 * Useful for pre-uploading files before creating a wiki page with attachFileIds
 */

import { z } from 'zod';
import axios from 'axios';
import path from 'path';
import fs from 'fs';
import { formatError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';

export const uploadWikiFileSchema = z.object({
  wikiId: z.string().describe('Wiki ID'),
  filePath: z.string().describe('Absolute path to the file to upload'),
});

export type UploadWikiFileInput = z.infer<typeof uploadWikiFileSchema>;

export async function uploadWikiFileHandler(args: UploadWikiFileInput) {
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
    const apiUrl = `${baseUrl}/wiki/v1/wikis/${args.wikiId}/files`;

    const buildFormData = () => {
      const form = new FormData();
      form.append('type', 'general');
      form.append('file', new Blob([fs.readFileSync(args.filePath)]), fileName);
      return form;
    };

    // Step 1: Make initial request to detect 307 redirect
    logger.debug(`Wiki file upload step 1: POST ${apiUrl}`);

    const step1Response = await axios.post(apiUrl, buildFormData(), {
      headers: { 'Authorization': `dooray-api ${apiToken}` },
      maxRedirects: 0,
      validateStatus: (status: number) => (status >= 200 && status < 300) || status === 307,
    });

    logger.debug(`Step 1 response: HTTP ${step1Response.status}`);

    let response: { header?: { isSuccessful: boolean; resultMessage?: string }; result: { id: string; attachFileId: string; name: string; mimeType: string; type: string; size: number; createdAt: string } };

    if (step1Response.status === 307) {
      const redirectUrl = step1Response.headers['location'];
      logger.debug(`Wiki file upload step 2: POST ${redirectUrl}`);

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
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            fileId: result.id,
            attachFileId: result.attachFileId,
            fileName: result.name || fileName,
            mimeType: result.mimeType,
            size: result.size,
            message: `File "${result.name || fileName}" successfully uploaded to wiki. Use attachFileId when creating a wiki page with attachments.`,
          }, null, 2),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${formatError(error)}`,
        },
      ],
      isError: true,
    };
  }
}

export const uploadWikiFileTool = {
  name: 'upload-wiki-file',
  description: `Upload a file to a Dooray wiki (not page-specific).

This is useful for pre-uploading files before creating a wiki page. The returned attachFileId can be used in create-wiki-page's attachFileIds parameter.

**Required Parameters:**
- wikiId: The wiki ID
- filePath: Absolute path to the file to upload (e.g., "/Users/name/document.pdf")

**Example:**
{
  "wikiId": "123456",
  "filePath": "/Users/nhn/Downloads/report.pdf"
}

**Workflow:**
1. Upload file with this tool -> get attachFileId
2. Create wiki page with create-wiki-page using attachFileIds: [attachFileId]

**Returns:** File ID and attach file ID of the uploaded file.`,
  inputSchema: {
    type: 'object',
    properties: {
      wikiId: {
        type: 'string',
        description: 'Wiki ID',
      },
      filePath: {
        type: 'string',
        description: 'Absolute path to the file to upload',
      },
    },
    required: ['wikiId', 'filePath'],
  },
};
