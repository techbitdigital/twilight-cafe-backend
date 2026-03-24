import { IsOptional, IsString, IsIn } from "class-validator";

export class GetUsersQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(["customer", "admin"])
  role?: "customer" | "admin";

  @IsOptional()
  @IsIn(["oldest", "newest"])
  sort?: "oldest" | "newest";
}
