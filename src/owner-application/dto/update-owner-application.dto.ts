import { PartialType } from '@nestjs/mapped-types';
import { CreateOwnerApplicationDto } from './create-owner-application.dto';

export class UpdateOwnerApplicationDto extends PartialType(
  CreateOwnerApplicationDto,
) {}
