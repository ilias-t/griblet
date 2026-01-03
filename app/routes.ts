import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("catalog", "routes/catalog.tsx"),
  route("viewer", "routes/viewer.tsx"),
  route("viewer/:id", "routes/viewer.$id.tsx"),
] satisfies RouteConfig;
