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
 * The caller identity comes from the verified access token; 5.4 adds
 * household-ownership verification on top of these endpoints. Creation
 * timestamps are generated here, never trusted from the client.
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
    void user; // ownership of dto.householdId is verified in 5.4
    return toMeterDto(await this.meterService.create(meter));
  }

  @Get()
  async list(
    @Query('householdId') householdId: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MeterDto[]> {
    const householdIdParam = parseUuidParam(householdId ?? '', 'householdId');
    void user; // ownership of householdIdParam is verified in 5.4
    const meters = await this.meterService.listByHousehold(householdIdParam);
    return meters.map(toMeterDto);
  }

  @Get(':meterId')
  async get(
    @Param('meterId') meterId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MeterDto> {
    const id = parseUuidParam(meterId, 'meterId');
    void user; // household ownership of the meter is verified in 5.4
    return toMeterDto(await this.meterService.getById(id));
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
    void user; // household ownership of the meter is verified in 5.4
    return toMeterDto(await this.meterService.update(id, changes));
  }
}
