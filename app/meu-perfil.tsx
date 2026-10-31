import { ProfileView } from "@/components/ProfileView";
import { useProfile } from "@/hooks/use-profile";

/** My own profile. Uses the current nickname, so it stays valid after the nickname is changed. */
export default function MyProfileScreen() {
  const { data } = useProfile();
  return <ProfileView nickname={data?.nickname ?? ""} />;
}
