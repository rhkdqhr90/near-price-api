import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../auth/types/auth-user.type';
import { WishlistService } from './wishlist.service';
import { CreateWishlistDto } from './dto/create-wishlist.dto';
import { WishlistResponseDto } from './dto/wishlist-response.dto';

@Controller('wishlists')
@UseGuards(JwtAuthGuard)
export class WishlistController {
  constructor(private readonly wishlistService: WishlistService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async add(
    @CurrentUser() user: AuthUser,
    @Body() createWishlistDto: CreateWishlistDto,
  ): Promise<void> {
    return await this.wishlistService.add(user.userId, createWishlistDto);
  }

  @Delete(':productId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() user: AuthUser,
    @Param('productId', ParseUUIDPipe) productId: string,
  ): Promise<void> {
    return await this.wishlistService.remove(user.userId, productId);
  }

  @Get('me')
  async findByUser(
    @CurrentUser() user: AuthUser,
  ): Promise<WishlistResponseDto> {
    return await this.wishlistService.findByUser(user.userId);
  }
}
