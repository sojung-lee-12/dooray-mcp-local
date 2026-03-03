/**
 * Dooray Board API
 * 게시판 목록, 게시글 목록/상세/작성
 * 주의: api.dooray.com이 아닌 조직 전용 도메인(tenantUrl) 사용
 */

import axios, { AxiosInstance } from 'axios';
import { getClient } from './client.js';
import { Board, BoardArticle, BoardListParams, BoardArticleListParams, CreateBoardArticleParams } from '../types/dooray-api.js';
import { logger } from '../utils/logger.js';

const BOARD_BASE = '/v2/wapi/board';

/**
 * Board API용 axios 인스턴스 생성
 * tenantUrl이 없으면 에러
 */
function getBoardAxios(): AxiosInstance {
  const tenantUrl = process.env.DOORAY_TENANT_URL;
  const apiToken = process.env.DOORAY_API_TOKEN;

  if (!tenantUrl) {
    throw new Error('DOORAY_TENANT_URL 환경변수가 필요합니다. (예: https://ligaccuver.dooray.com)');
  }
  if (!apiToken) {
    throw new Error('DOORAY_API_TOKEN 환경변수가 필요합니다.');
  }

  return axios.create({
    baseURL: tenantUrl,
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `dooray-api ${apiToken}`,
    },
  });
}

/**
 * 현재 사용자의 조직 ID 조회
 */
async function getOrgId(): Promise<string> {
  const client = getClient();
  const me = await client.get<{ defaultOrganization: { id: string } }>('/common/v1/members/me');
  return me.defaultOrganization.id;
}

/**
 * 게시판 목록 조회
 * boardPermission='canwrite'이면 글쓰기 가능한 게시판만 반환
 */
export async function getBoardList(params?: BoardListParams): Promise<Board[]> {
  const instance = getBoardAxios();
  const orgId = await getOrgId();

  const queryParams: Record<string, string> = {};
  if (params?.boardPermission) {
    queryParams.boardPermission = params.boardPermission;
  }

  logger.debug(`Board list: GET ${BOARD_BASE}/organizations/${orgId}/boards`);
  const response = await instance.get(`${BOARD_BASE}/organizations/${orgId}/boards`, {
    params: queryParams,
  });

  return response.data?.result ?? response.data ?? [];
}

/**
 * 특정 게시판의 게시글 목록 조회
 */
export async function getBoardArticleList(params: BoardArticleListParams): Promise<{ totalCount: number; result: BoardArticle[] }> {
  const instance = getBoardAxios();
  const orgId = await getOrgId();

  logger.debug(`Article list: GET ${BOARD_BASE}/organizations/${orgId}/boards/${params.boardId}/articles`);
  const response = await instance.get(
    `${BOARD_BASE}/organizations/${orgId}/boards/${params.boardId}/articles`,
    {
      params: {
        page: params.page ?? 0,
        size: params.size ?? 20,
        sort: params.sort ?? '-createdAt',
      },
    }
  );

  return {
    totalCount: response.data?.totalCount ?? 0,
    result: response.data?.result ?? response.data ?? [],
  };
}

/**
 * 특정 게시글 상세 조회
 */
export async function getBoardArticle(boardId: string, articleId: string): Promise<BoardArticle> {
  const instance = getBoardAxios();
  const orgId = await getOrgId();

  logger.debug(`Article detail: GET ${BOARD_BASE}/organizations/${orgId}/boards/${boardId}/articles/${articleId}`);
  const response = await instance.get(
    `${BOARD_BASE}/organizations/${orgId}/boards/${boardId}/articles/${articleId}`
  );

  return response.data?.result ?? response.data;
}

/**
 * 새 게시글 작성
 */
export async function createBoardArticle(params: CreateBoardArticleParams): Promise<BoardArticle> {
  const instance = getBoardAxios();
  const orgId = await getOrgId();

  const body: Record<string, unknown> = {
    subject: params.subject,
  };
  if (params.body) {
    body.body = params.body;
  }

  logger.debug(`Create article: POST ${BOARD_BASE}/organizations/${orgId}/boards/${params.boardId}/articles`);
  const response = await instance.post(
    `${BOARD_BASE}/organizations/${orgId}/boards/${params.boardId}/articles`,
    body
  );

  return response.data?.result ?? response.data;
}
