/**
 * 금칙어 목록
 * - 욕설, 부적절한 언어
 * - 사칭 방지 단어 (관리자, 운영자 등)
 */
export const BANNED_WORDS = [
  // 한국어 욕설 (주요 단어들)
  '개새끼',
  '병신',
  '씨발',
  '지랄',
  '미친',
  '빡대',
  '개X',
  '썅',
  '좆',

  // 사칭 방지 단어
  '관리자',
  'admin',
  'administrator',
  '운영자',
  'operator',
  '개발자',
  'developer',
  '시스템',
  'system',
  '모더레이터',
  'moderator',
  '슈퍼유저',
  'superuser',
  '루트',
  'root',
  'ceo',
  'cto',
];

/**
 * 닉네임에서 금칙어 포함 여부 확인
 */
export function containsBannedWords(nickname: string): boolean {
  const lowerNickname = nickname.toLowerCase();
  return BANNED_WORDS.some(word => lowerNickname.includes(word.toLowerCase()));
}
