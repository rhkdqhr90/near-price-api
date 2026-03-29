import { StoreReview } from '../entities/store-review.entity';

export class StoreReviewResponseDto {
  id: string;
  rating: number;
  comment: string | null;
  user: { id: string; nickname: string };
  createdAt: Date;

  static from(review: StoreReview): StoreReviewResponseDto {
    const dto = new StoreReviewResponseDto();
    dto.id = review.id;
    dto.rating = review.rating;
    dto.comment = review.comment ?? null;
    dto.user = {
      id: review.user.id,
      nickname: review.user.nickname,
    };
    dto.createdAt = review.createdAt;
    return dto;
  }
}
