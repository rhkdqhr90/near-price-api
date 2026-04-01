import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InquiryService } from './inquiry.service';
import { Inquiry, InquiryStatus } from './entities/inquiry.entity';
import { CreateInquiryDto } from './dto/create-inquiry.dto';
import { InquiryResponseDto } from './dto/inquiry-response.dto';
import { User, UserRole } from '../user/entities/user.entity';

const USER_UUID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const INQUIRY_UUID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const INVALID_UUID = 'ffffffff-ffff-ffff-ffff-ffffffffffff';

function buildUser(overrides: Partial<User> = {}): User {
  const user = new User();
  user.id = USER_UUID;
  user.email = 'test@example.com';
  user.nickname = '테스터';
  user.latitude = null;
  user.longitude = null;
  user.role = UserRole.USER;
  user.profileImageUrl = null;
  user.fcmToken = null;
  user.notifPriceChange = true;
  user.notifPromotion = false;
  user.nicknameChangedAt = null;
  user.trustScore = 0;
  user.oauths = [];
  user.prices = [];
  user.wishlists = [];
  user.createdAt = new Date('2025-01-01');
  user.updatedAt = new Date('2025-01-01');
  return Object.assign(user, overrides);
}

function buildInquiry(
  user: User | null,
  overrides: Partial<Inquiry> = {},
): Inquiry {
  const inquiry = new Inquiry();
  inquiry.id = INQUIRY_UUID;
  inquiry.user = user;
  inquiry.title = '문의 제목';
  inquiry.content = '문의 내용입니다.';
  inquiry.email = 'test@example.com';
  inquiry.status = InquiryStatus.PENDING;
  inquiry.adminReply = null;
  inquiry.createdAt = new Date('2025-01-01');
  inquiry.updatedAt = new Date('2025-01-01');
  return Object.assign(inquiry, overrides);
}

describe('InquiryService', () => {
  let service: InquiryService;
  let inquiryRepo: jest.Mocked<Repository<Inquiry>>;
  let userRepo: jest.Mocked<Repository<User>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InquiryService,
        {
          provide: getRepositoryToken(Inquiry),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOneBy: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<InquiryService>(InquiryService);
    inquiryRepo = module.get(getRepositoryToken(Inquiry));
    userRepo = module.get(getRepositoryToken(User));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create()', () => {
    const dto: CreateInquiryDto = {
      title: '문의 제목',
      content: '문의 내용입니다.',
      email: 'test@example.com',
    };

    it('user가 존재하면 Inquiry를 생성하고 InquiryResponseDto를 반환한다', async () => {
      const user = buildUser();
      const inquiryEntity = buildInquiry(user);

      userRepo.findOneBy.mockResolvedValue(user);
      inquiryRepo.create.mockReturnValue(inquiryEntity);
      inquiryRepo.save.mockResolvedValue(inquiryEntity);

      const result = await service.create(dto, USER_UUID);

      expect(userRepo.findOneBy).toHaveBeenCalledWith({ id: USER_UUID });
      expect(inquiryRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ ...dto, user }),
      );
      expect(inquiryRepo.save).toHaveBeenCalledWith(inquiryEntity);
      expect(result).toBeInstanceOf(InquiryResponseDto);
      expect(result.id).toBe(INQUIRY_UUID);
      expect(result.title).toBe('문의 제목');
      expect(result.status).toBe(InquiryStatus.PENDING);
    });

    it('user가 존재하지 않으면 NotFoundException을 던진다', async () => {
      userRepo.findOneBy.mockResolvedValue(null);

      await expect(service.create(dto, INVALID_UUID)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.create(dto, INVALID_UUID)).rejects.toThrow(
        '사용자를 찾을 수 없습니다',
      );
      expect(inquiryRepo.create).not.toHaveBeenCalled();
      expect(inquiryRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('findByUser()', () => {
    it('userId에 해당하는 Inquiry 목록을 InquiryResponseDto 배열로 반환한다', async () => {
      const user = buildUser();
      const inquiries = [
        buildInquiry(user, { id: INQUIRY_UUID }),
        buildInquiry(user, {
          id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
          title: '두 번째 문의',
        }),
      ];

      inquiryRepo.find.mockResolvedValue(inquiries);

      const result = await service.findByUser(USER_UUID);

      expect(inquiryRepo.find).toHaveBeenCalledWith({
        where: { user: { id: USER_UUID } },
        order: { createdAt: 'DESC' },
      });
      expect(result).toHaveLength(2);
      expect(result[0]).toBeInstanceOf(InquiryResponseDto);
      expect(result[0].id).toBe(INQUIRY_UUID);
    });

    it('해당 user의 Inquiry가 없으면 빈 배열을 반환한다', async () => {
      inquiryRepo.find.mockResolvedValue([]);

      const result = await service.findByUser(INVALID_UUID);

      expect(result).toEqual([]);
    });
  });
});
