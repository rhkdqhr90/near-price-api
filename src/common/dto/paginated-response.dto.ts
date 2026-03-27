export class PaginatedResponseDto<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;

  static of<T>(
    data: T[],
    total: number,
    page: number,
    limit: number,
  ): PaginatedResponseDto<T> {
    const dto = new PaginatedResponseDto<T>();
    dto.data = data;
    dto.total = total;
    dto.page = page;
    dto.limit = limit;
    return dto;
  }
}
