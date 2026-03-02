/**
 * Search Members Tool
 * 이름 또는 userCode로 Dooray 조직 멤버를 검색
 */

import { z } from 'zod';
import * as commonApi from '../../api/common.js';
import { formatError } from '../../utils/errors.js';

// name 또는 userCode 중 하나는 반드시 필요
export const searchMembersSchema = z.object({
  name: z.string().optional().describe('검색할 멤버 이름 (부분 일치)'),
  userCode: z.string().optional().describe('검색할 userCode (예: geonhee.ye)'),
  size: z.number().optional().describe('결과 수 (기본값: 20)'),
}).refine(data => data.name || data.userCode, {
  message: 'name 또는 userCode 중 하나는 필수입니다',
});

export type SearchMembersInput = z.infer<typeof searchMembersSchema>;

export async function searchMembersHandler(args: SearchMembersInput) {
  try {
    const result = await commonApi.searchMembers({
      name: args.name,
      userCode: args.userCode,
      size: args.size,
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
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

export const searchMembersTool = {
  name: 'search-members',
  description: `이름 또는 userCode로 Dooray 조직 멤버를 검색합니다.

DM을 보내기 전 상대방의 memberId(organizationMemberId)를 찾을 때 사용합니다.

**파라미터** (name 또는 userCode 중 하나 필수):
- name: 이름으로 검색
- userCode: userCode로 검색 (예: geonhee.ye)
- size: 결과 수 (기본값: 20)

Returns: 검색된 멤버 목록 (id, name, userCode, externalEmailAddress 포함)

**워크플로우**:
1. search-members로 상대방 id 조회
2. send-messenger-direct-message로 DM 전송`,
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: '검색할 멤버 이름' },
      userCode: { type: 'string', description: '검색할 userCode (예: geonhee.ye)' },
      size: { type: 'number', description: '결과 수 (기본값: 20)' },
    },
  },
};
