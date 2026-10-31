import { Redirect } from "expo-router";
import { useAccountStatus } from "@/hooks/use-account";

/** Where a signed-in user belongs: the app if approved, otherwise the waiting screen. */
export function SignedInRedirect() {
  const { data, isPending } = useAccountStatus();
  if (isPending) return null; // the root layout keeps the splash up until this is known
  return <Redirect href={data?.status === "approved" ? "/biblioteca" : "/aguardando"} />;
}
