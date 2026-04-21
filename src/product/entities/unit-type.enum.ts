// UnitType: 가격 등록 시 단위 선택값.
// 과거에는 Product 엔티티에 속했으나 "같은 상품의 단위별 분리" 문제로
// Price 엔티티로 이관됨. enum 정의 자체는 순환참조 회피 위해 별도 모듈로 분리.
export enum UnitType {
  GRAM = 'g',
  KILOGRAM = 'kg',
  MILLILITER = 'ml',
  LITER = 'l',
  COUNT = 'count', // 개
  BUNCH = 'bunch', // 묶음
  PACK = 'pack', // 팩
  BAG = 'bag', // 망
  OTHER = 'other', // 기타 (사진으로 판단)
}
