import { ScreenHeader } from "@/components/ScreenHeader";
import { useAuth } from "@/contexts/AuthContext";
import { UserRow } from "@/utils/sqliteHelper";
import { useState } from "react";
import {
    ScrollView
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// ─── Component ────────────────────────────────────────────────────────────────

export default function CompareScreen() {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [localUser, setLocalUser] = useState<UserRow | null>(null);
  const [displayName, setDisplayName] = useState("");

  // ── Load ──────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["bottom"]}>
      <ScreenHeader title="Compare" />
      <ScrollView contentContainerClassName="px-5 py-6 gap-6"></ScrollView>
    </SafeAreaView>
  );
}
