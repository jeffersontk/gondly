import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { ReverseGeocodeQueryDto } from "./dto";
import { GeocodingService } from "./geocoding.service";

@ApiTags("Geocoding")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("geocoding")
export class GeocodingController {
  constructor(private readonly geocodingService: GeocodingService) {}

  @Get("reverse")
  reverse(@Query() query: ReverseGeocodeQueryDto) {
    return this.geocodingService.reverseGeocode(query.latitude, query.longitude);
  }
}
