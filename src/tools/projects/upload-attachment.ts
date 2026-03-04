/**
 * Upload Attachment Tool
 * Upload a file attachment to a task
 */

import { z } from 'zod';
import axios from 'axios';
import path from 'path';
import fs from 'fs';
import { formatError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';

export const uploadAttachmentSchema = z.object({
  projectId: z.string().describe('Project ID'),
  taskId: z.string().describe('Task ID (post ID)'),
  filePath: z.string().describe('Absolute path to the file to upload'),
});

export type UploadAttachmentInput = z.infer<typeof uploadAttachmentSchema>;

export async function uploadAttachmentHandler(args: UploadAttachmentInput) {
  try {
    const apiToken = process.env.DOORAY_API_TOKEN;
    if (!apiToken) {
      throw new Error('DOORAY_API_TOKEN environment variable is required');
    }

    // Verify file exists
    if (!fs.existsSync(args.filePath)) {
      throw new Error(`File not found: ${args.filePath}`);
    }

    const fileName = path.basename(args.filePath);
    const baseUrl = process.env.DOORAY_API_BASE_URL || 'https://api.dooray.com';
    const apiUrl = `${baseUrl}/project/v1/projects/${args.projectId}/posts/${args.taskId}/files`;

    const buildFormData = () => {
      const form = new FormData();
      form.append('file', new Blob([fs.readFileSync(args.filePath)]), fileName);
      return form;
    };

    // Step 1: Make initial request to detect 307 redirect
    logger.debug(`Upload step 1: POST ${apiUrl}`);

    const step1Response = await axios.post(apiUrl, buildFormData(), {
      headers: { 'Authorization': `dooray-api ${apiToken}` },
      maxRedirects: 0,
      validateStatus: (status: number) => (status >= 200 && status < 300) || status === 307,
    });

    logger.debug(`Step 1 response: HTTP ${step1Response.status}`);

    let response: { header?: { isSuccessful: boolean; resultMessage?: string }; result: { id: string } };

    if (step1Response.status === 307) {
      const redirectUrl = step1Response.headers['location'];
      logger.debug(`Upload step 2: POST ${redirectUrl}`);

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
            fileName: fileName,
            message: `File "${fileName}" successfully uploaded to task.`,
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

export const uploadAttachmentTool = {
  name: 'upload-attachment',
  description: `Upload a file attachment to a Dooray task.

**Required Parameters:**
- projectId: The project ID
- taskId: The task ID (post ID) to attach the file to
- filePath: Absolute path to the file to upload (e.g., "/Users/name/document.pdf")

**Example:**
{
  "projectId": "123456",
  "taskId": "789012",
  "filePath": "/Users/nhn/Downloads/report.pdf"
}

**Returns:** File ID of the uploaded attachment.

**Note:** The file must exist at the specified path. Maximum file size depends on Dooray's server limits.`,
  inputSchema: {
    type: 'object',
    properties: {
      projectId: {
        type: 'string',
        description: 'Project ID',
      },
      taskId: {
        type: 'string',
        description: 'Task ID (post ID) to attach the file to',
      },
      filePath: {
        type: 'string',
        description: 'Absolute path to the file to upload',
      },
    },
    required: ['projectId', 'taskId', 'filePath'],
  },
};
