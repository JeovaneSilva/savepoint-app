import { useLocalSearchParams } from "expo-router";
import { ProfileView } from "@/components/ProfileView";

/** Anyone's profile, opened from the ranking. */
export default function PublicProfileScreen() {
  const { nickname } = useLocalSearchParams<{ nickname: string }>();
  return <ProfileView nickname={nickname ?? ""} />;
}
