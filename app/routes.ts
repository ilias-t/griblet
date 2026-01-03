import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("viewer", "routes/viewer.tsx"),
  route("api/parse", "routes/api.parse.tsx"),
] satisfies RouteConfig;
