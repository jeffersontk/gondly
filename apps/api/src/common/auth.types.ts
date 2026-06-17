import type { Request } from "express";

export type JwtUser = {
  id: string;
  email: string;
  name: string;
};

export type RequestWithUser = Request & {
  user: JwtUser;
};
