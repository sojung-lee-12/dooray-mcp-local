/**
 * Upload Wiki Page File Tool
 * Upload a file to an existing wiki page (307 redirect handling)
 */

import { z } from 'zod';
import axios from 'axios';
import path from 'path';
import fs from 'fs';
import { formatError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';

export const uploadWikiPageFileSchema = z.object({
  wikiId: z.string().describe('Wiki ID'),
  pageId: z.string().describe('Wiki page ID'),
  filePath: z.string().describe('Absolute path to the file to upload'),
});

export type UploadWikiPageFileInput = z.infer<typeof uploadWikiPageFileSchema>;

export async function uploadWikiPageFileHandler(args: UploadWikiPageFileInput) {
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
    const apiUrl = `${baseUrl}/wiki/v1/wikis/${args.wikiId}/pages/${args.pageId}/files`;

    const buildFormData = () => {
      const form = new FormData();
      form.append('type', 'general');
      form.append('file', new Blob([fs.readFileSync(args.filePath)]), fileName);
      return form;
    };

    // Step 1: Make initial request to detect 307 redirect
    logger.debug(`Wiki page file upload step 1: POST ${apiUrl}`);

    const step1Response = await axios.post(apiUrl, buildFormData(), {
      headers: { 'Authorization': `dooray-api ${apiToken}` },
      maxRedirects: 0,
      validateStatus: (status: number) => (status >= 200 && status < 300) || status === 307,
    });

    logger.debug(`Step 1 response: HTTP ${step1Response.status}`);

    let response: { header?: { isSuccessful: boolean; resultMessage?: string }; result: { id: string; attachFileId: string; name: string; mimeType: string; type: string; size: number; createdAt: string } };

    if (step1Response.status === 307) {
      const redirectUrl = step1Response.headers['location'];
      logger.debug(`Wiki page file upload step 2: POST ${redirectUrl}`);

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
            message: `File "${result.name || fileName}" successfully uploaded to wiki page.`,
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

export const uploadWikiPageFileTool = {
  name: 'upload-wiki-page-file',
  description: `Upload a file to an existing Dooray wiki page.

**Required Parameters:**
- wikiId: The wiki ID
- pageId: The wiki page ID to attach the file to
- filePath: Absolute path to the file to upload (e.g., "/Users/name/document.pdf")

**Example:**
{
  "wikiId": "123456",
  "pageId": "789012",
  "filePath": "/Users/nhn/Downloads/report.pdf"
}

**Returns:** File ID and attach file ID of the uploaded file.

**Note:** The file must exist at the specified path. The type is set to "general" automatically.`,
  inputSchema: {
    type: 'object',
    properties: {
      wikiId: {
        type: 'string',
        description: 'Wiki ID',
      },
      pageId: {
        type: 'string',
        description: 'Wiki page ID to attach the file to',
      },
      filePath: {
        type: 'string',
        description: 'Absolute path to the file to upload',
      },
    },
    required: ['wikiId', 'pageId', 'filePath'],
  },
};
