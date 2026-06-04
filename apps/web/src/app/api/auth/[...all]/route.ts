import { getAuth } from "@/features/auth/server";

function handleAuthRequest(request: Request) {
  return getAuth().handler(request);
}

export {
  handleAuthRequest as DELETE,
  handleAuthRequest as GET,
  handleAuthRequest as PATCH,
  handleAuthRequest as POST,
  handleAuthRequest as PUT,
};
