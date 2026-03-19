export class AdminReportDto {
  id: string;
  reason: string;
  reporter: {
    id: string;
    nickname: string;
    email: string;
  };
  price: {
    id: string;
    amount: number;
    isActive: boolean;
    product: { name: string };
    store: { name: string };
  };
  createdAt: Date;
}
