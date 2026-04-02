import ChangelogModalContent from "@/components/changelog-modal-content";
import { useRouter } from "expo-router";

export default function ChangelogScreen() {
    const router = useRouter();
    return (
        <ChangelogModalContent isScreen onClose={() => router.back()} />
    );
}
