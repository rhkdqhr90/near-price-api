import { VerificationResult } from '../entities/price-verification.entity';

export class VerifierProfileDto {
  id: string;
  nickname: string;
  trustScore: number;
  representativeBadge?: {
    type: string;
    name: string;
    icon: string;
  } | null;
  profileImageUrl?: string | null;
}

export class VerificationResponseDto {
  id: string;
  priceId: string;
  result: VerificationResult;
  actualPrice: number | null;
  newPriceId: string | null;
  createdAt: Date;
}

export class VerificationDetailDto {
  id: string;
  result: VerificationResult;
  actualPrice: number | null;
  verifier: VerifierProfileDto;
  createdAt: Date;
}

export class VerificationListResponseDto {
  data: VerificationDetailDto[];
  meta: {
    total: number;
    confirmedCount: number;
    disputedCount: number;
  };
}
