import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/jwt-verifier.js';
import {
  parseCreateMeter,
  parseUpdateMeter,
  parseUuidParam,
  type CreateMeterDto,
  type UpdateMeterDto,
} from './meter.dto.js';
import { toMeterDto, type MeterDto } from './meter.mapper.js';
import { MeterService } from './meter.service.js';
import type { Meter } from './meter.model.js';

/**
 * Meter API (contract: contracts/openapi/services/meter-service/openapi.yaml).
 *
 * The caller identity comes from the verified access token; ownership of the
 * referenced household is enforced in the service layer (5.4), using the
 * caller's token so household-service scopes the check to them.
 */
@Controller('api/v1/meters')
export class MeterController {
  constructor(private readonly meterService: MeterService) {}

  @Post()
  async create(
    @Body() body: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MeterDto> {
    const dto: CreateMeterDto = parseCreateMeter(body);
    const meter: Meter = {
      id: crypto.randomUUID(),
      householdId: dto.householdId,
      type: dto.type,
      name: dto.name,
      serialNumber: dto.serialNumber,
      unit: dto.unit,
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    return toMeterDto(await this.meterService.create(meter, user.accessToken));
  }

  @Get()
  async list(
    @Query('householdId') householdId: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MeterDto[]> {
    const householdIdParam = parseUuidParam(householdId ?? '', 'householdId');
    const meters = await this.meterService.listByHousehold(
      householdIdParam,
      user.accessToken,
    );
    return meters.map(toMeterDto);
  }

  @Get(':meterId')
  async get(
    @Param('meterId') meterId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MeterDto> {
    const id = parseUuidParam(meterId, 'meterId');
    return toMeterDto(await this.meterService.getById(id, user.accessToken));
  }

  @Patch(':meterId')
  @HttpCode(HttpStatus.OK)
  async update(
    @Param('meterId') meterId: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MeterDto> {
    const id = parseUuidParam(meterId, 'meterId');
    const changes: UpdateMeterDto = parseUpdateMeter(body);
    return toMeterDto(await this.meterService.update(id, changes, user.accessToken));
  }
}
