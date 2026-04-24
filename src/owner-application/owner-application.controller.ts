import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { AuthUser } from '../auth/types/auth-user.type';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AdminGuard } from '../common/guards/admin.guard';
import { CreateOwnerApplicationDto } from './dto/create-owner-application.dto';
import {
  OwnerApplicationAdminDetailDto,
  OwnerApplicationAdminListItemDto,
  OwnerApplicationResponseDto,
} from './dto/owner-application-response.dto';
import { RejectOwnerApplicationDto } from './dto/reject-owner-application.dto';
import { UpdateOwnerApplicationDto } from './dto/update-owner-application.dto';
import { OwnerApplicationService } from './owner-application.service';

@Controller('owner')
export class OwnerApplicationController {
  constructor(
    private readonly ownerApplicationService: OwnerApplicationService,
  ) {}

  @Post('me')
  @UseGuards(JwtAuthGuard)
  @Throttle({ write: { limit: 5, ttl: 60000 } })
  async createMyApplication(
    @CurrentUser() requestUser: AuthUser,
    @Body() dto: CreateOwnerApplicationDto,
  ): Promise<OwnerApplicationResponseDto> {
    return await this.ownerApplicationService.createMyApplication(
      requestUser.userId,
      dto,
    );
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async findMyApplication(
    @CurrentUser() requestUser: AuthUser,
  ): Promise<OwnerApplicationResponseDto> {
    return await this.ownerApplicationService.findMyApplication(
      requestUser.userId,
    );
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  @Throttle({ write: { limit: 5, ttl: 60000 } })
  async updateMyApplication(
    @CurrentUser() requestUser: AuthUser,
    @Body() dto: UpdateOwnerApplicationDto,
  ): Promise<OwnerApplicationResponseDto> {
    return await this.ownerApplicationService.updateMyApplication(
      requestUser.userId,
      dto,
    );
  }

  @Delete('me')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  @Throttle({ write: { limit: 3, ttl: 60000 } })
  async removeMyApplication(
    @CurrentUser() requestUser: AuthUser,
  ): Promise<void> {
    await this.ownerApplicationService.removeMyApplication(requestUser.userId);
  }

  @Get('admin')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async findAllForAdmin(): Promise<OwnerApplicationAdminListItemDto[]> {
    return await this.ownerApplicationService.findAllForAdmin();
  }

  @Get('admin/:id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async findOneForAdmin(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<OwnerApplicationAdminDetailDto> {
    return await this.ownerApplicationService.findOneForAdmin(id);
  }

  @Patch('admin/:id/approve')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Throttle({ write: { limit: 20, ttl: 60000 } })
  async approve(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() requestUser: AuthUser,
  ): Promise<OwnerApplicationAdminListItemDto> {
    return await this.ownerApplicationService.approve(id, requestUser.userId);
  }

  @Patch('admin/:id/reject')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Throttle({ write: { limit: 20, ttl: 60000 } })
  async reject(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() requestUser: AuthUser,
    @Body() dto: RejectOwnerApplicationDto,
  ): Promise<OwnerApplicationAdminListItemDto> {
    return await this.ownerApplicationService.reject(
      id,
      requestUser.userId,
      dto,
    );
  }
}
