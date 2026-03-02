/**
 * Dooray Common API
 * Handles common/shared operations like member info
 */

import { getClient } from './client.js';
import { MyMemberInfo, MemberDetails, SearchMembersParams, MemberSearchResult, PaginatedResponse } from '../types/dooray-api.js';

const COMMON_BASE = '/common/v1';

/**
 * Get information about the authenticated user
 */
export async function getMyMemberInfo(): Promise<MyMemberInfo> {
  const client = getClient();
  return client.get(`${COMMON_BASE}/members/me`);
}

/**
 * Get detailed information about a specific member
 */
export async function getMemberDetails(memberId: string): Promise<MemberDetails> {
  const client = getClient();
  return client.get(`${COMMON_BASE}/members/${memberId}`);
}

/**
 * 이름 또는 userCode로 조직 멤버 검색
 */
export async function searchMembers(params: SearchMembersParams): Promise<PaginatedResponse<MemberSearchResult>> {
  const client = getClient();
  const queryParams: Record<string, unknown> = {
    page: params.page ?? 0,
    size: params.size ?? 20,
  };
  if (params.name) queryParams.name = params.name;
  if (params.userCode) queryParams.userCode = params.userCode;
  return client.getPaginated<MemberSearchResult>(`${COMMON_BASE}/members`, queryParams);
}
