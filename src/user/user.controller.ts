import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../auth/types/auth-user.type';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateNicknameDto } from './dto/update-nickname.dto';
import { CheckNicknameDto } from './dto/check-nickname.dto';
import { UpdateNotificationSettingsDto } from './dto/update-notification-settings.dto';
import { PaginationDto } from '../common/dto/pagination.dto';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  @UseGuards(JwtAuthGuard, AdminGuard)
  async create(@Body() createUserDto: CreateUserDto) {
    return await this.userService.create(createUserDto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, AdminGuard)
  async findAll(@Query() pagination: PaginationDto) {
    return await this.userService.findAll(pagination);
  }

  @Get('check-nickname')
  @Throttle({ default: { limit: 20, ttl: 60000 } }) // 1분에 20회로 제한 (사용자 열거 공격 방지)
  async checkNickname(
    @Query('nickname') nickname: string,
  ): Promise<CheckNicknameDto> {
    const available = await this.userService.checkNicknameAvailable(nickname);
    return { available };
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return await this.userService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateUserDto: UpdateUserDto,
    @CurrentUser() requestUser: AuthUser,
  ) {
    return await this.userService.update(id, updateUserDto, requestUser);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return await this.userService.remove(id);
  }

  @Patch(':id/nickname')
  @UseGuards(JwtAuthGuard, ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 600000 } }) // 10분에 10번
  async updateNickname(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateNicknameDto: UpdateNicknameDto,
    @CurrentUser() requestUser: AuthUser,
  ) {
    return await this.userService.updateNickname(
      id,
      updateNicknameDto.nickname,
      requestUser,
    );
  }

  @Patch(':id/fcm-token')
  @UseGuards(JwtAuthGuard)
  async updateFcmToken(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { fcmToken: string },
    @CurrentUser() requestUser: AuthUser,
  ) {
    return await this.userService.updateFcmToken(
      id,
      body.fcmToken,
      requestUser,
    );
  }

  @Patch(':id/notification-settings')
  @UseGuards(JwtAuthGuard)
  async updateNotificationSettings(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateNotificationSettingsDto,
    @CurrentUser() requestUser: AuthUser,
  ) {
    return await this.userService.updateNotificationSettings(
      id,
      dto,
      requestUser,
    );
  }

  @Delete('me')
  @UseGuards(JwtAuthGuard)
  async deleteAccount(@CurrentUser() requestUser: AuthUser) {
    await this.userService.deleteAccount(requestUser.userId, requestUser);
    return { success: true };
  }
}
