export const defaultPageSize = 25;
export const maxPageSize = 100;

export type PageRequest = {
  page?: number;
  pageSize?: number;
};

export function normalizePageRequest(request: PageRequest = {}) {
  const page = Math.max(1, Math.floor(request.page ?? 1));
  const pageSize = Math.min(
    maxPageSize,
    Math.max(1, Math.floor(request.pageSize ?? defaultPageSize)),
  );

  return {
    limit: pageSize,
    offset: (page - 1) * pageSize,
    page,
    pageSize,
  };
}
