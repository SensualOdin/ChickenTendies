// Express 5 typings (@types/express-serve-static-core ^5) widened
// `req.params[x]` to `string | string[]`. None of our routes use array
// notation, so we override the `params` property on Request to always
// be a plain string map. This keeps `req.params.x` callable as a string
// without per-site casts.
import "express-serve-static-core";

declare module "express-serve-static-core" {
  interface Request {
    params: { [key: string]: string };
  }
}
