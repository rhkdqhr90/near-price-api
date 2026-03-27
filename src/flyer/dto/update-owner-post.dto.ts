import { PartialType } from '@nestjs/mapped-types';
import { CreateOwnerPostDto } from './create-owner-post.dto';

export class UpdateOwnerPostDto extends PartialType(CreateOwnerPostDto) {}
