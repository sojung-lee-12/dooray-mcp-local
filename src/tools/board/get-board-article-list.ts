/**
 * Get Board Article List Tool
 * 특정 게시판의 게시글 목록 조회
 */

import { z } from 'zod';
import * as boardApi from '../../api/board.js';
import { formatError } from '../../utils/errors.js';

export const getBoardArticleListSchema = z.object({
  boardId: z.string().describe('게시판 ID (get-board-list로 확인)'),
  page: z.number().optional().describe('페이지 번호 (0부터 시작, 기본값: 0)'),
  size: z.number().optional().describe('페이지 크기 (기본값: 20)'),
  sort: z.string().optional().describe('정렬 기준 (기본값: -createdAt, 최신순)'),
});

export type GetBoardArticleListInput = z.infer<typeof getBoardArticleListSchema>;

export async function getBoardArticleListHandler(args: GetBoardArticleListInput) {
  try {
    const result = await boardApi.getBoardArticleList({
      boardId: args.boardId,
      page: args.page,
      size: args.size,
      sort: args.sort,
    });
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  } catch (error) {
    return { content: [{ type: 'text', text: `Error: ${formatError(error)}` }], isError: true };
  }
}

export const getBoardArticleListTool = {
  name: 'get-board-article-list',
  description: `특정 게시판의 게시글 목록을 조회합니다.

**필수**: boardId (get-board-list로 먼저 게시판 ID 확인)
**필수 환경변수**: DOORAY_TENANT_URL

**정렬(sort)**:
- -createdAt: 최신순 (기본값)
- createdAt: 오래된순

Returns: 게시글 ID, 제목, 작성자, 작성일, totalCount`,
  inputSchema: {
    type: 'object',
    properties: {
      boardId: {
        type: 'string',
        description: '게시판 ID (get-board-list 도구로 확인)',
      },
      page: {
        type: 'number',
        description: '페이지 번호 (0부터 시작, 기본값: 0)',
      },
      size: {
        type: 'number',
        description: '페이지 크기 (기본값: 20, 최대 100)',
      },
      sort: {
        type: 'string',
        description: '정렬: -createdAt(최신순), createdAt(오래된순)',
      },
    },
    required: ['boardId'],
  },
};
