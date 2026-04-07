export function parsePagination(query: Record<string, unknown>) {
  const page = Number(query.page ?? 1);
  const limit = Number(query.limit ?? 20);

  const safePage = Number.isNaN(page) || page < 1 ? 1 : page;
  const safeLimit = Number.isNaN(limit) || limit < 1 || limit > 100 ? 20 : limit;
  const offset = (safePage - 1) * safeLimit;

  return { page: safePage, limit: safeLimit, offset };
}
