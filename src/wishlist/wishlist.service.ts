import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { Wishlist } from './entities/wishlist.entity';
import { User } from '../user/entities/user.entity';
import { Product } from '../product/entities/product.entity';
import { CreateWishlistDto } from './dto/create-wishlist.dto';
import { WishlistResponseDto } from './dto/wishlist-response.dto';
import { DB_ERROR_CODES } from '../common/constants/db-error-codes';

@Injectable()
export class WishlistService {
  constructor(
    @InjectRepository(Wishlist)
    private readonly wishlistRepository: Repository<Wishlist>,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
  ) {}

  async add(
    userId: string,
    createWishlistDto: CreateWishlistDto,
  ): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException('존재하지 않는 사용자입니다.');
    }

    const product = await this.productRepository.findOne({
      where: { id: createWishlistDto.productId },
    });
    if (!product) {
      throw new NotFoundException('존재하지 않는 상품입니다.');
    }

    try {
      const wishlist = this.wishlistRepository.create({ user, product });
      await this.wishlistRepository.save(wishlist);
    } catch (e) {
      if (
        e instanceof QueryFailedError &&
        (e as QueryFailedError & { code: string }).code ===
          DB_ERROR_CODES.UNIQUE_VIOLATION
      ) {
        throw new ConflictException('이미 찜한 상품입니다.');
      }
      throw e;
    }
  }

  async remove(userId: string, productId: string): Promise<void> {
    const wishlist = await this.wishlistRepository.findOne({
      where: { user: { id: userId }, product: { id: productId } },
    });
    if (!wishlist) {
      throw new NotFoundException('찜 목록에 없는 상품입니다.');
    }
    await this.wishlistRepository.remove(wishlist);
  }

  async findByUser(userId: string): Promise<WishlistResponseDto> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException('존재하지 않는 사용자입니다.');
    }

    const wishlists = await this.wishlistRepository
      .createQueryBuilder('w')
      .innerJoin('w.user', 'user')
      .leftJoinAndSelect('w.product', 'product')
      .leftJoinAndSelect(
        'product.prices',
        'price',
        'price."isActive" = :isActive',
        { isActive: true },
      )
      .leftJoinAndSelect('price.store', 'store')
      .where('user.id = :userId', { userId })
      .orderBy('w.createdAt', 'DESC')
      .addOrderBy('price.price', 'ASC')
      .getMany();

    return WishlistResponseDto.from(wishlists);
  }
}
