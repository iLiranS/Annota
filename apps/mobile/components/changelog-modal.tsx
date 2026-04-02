import { useChangelog } from "@annota/core";
import React from "react";
import { Modal } from "react-native";
import ChangelogModalContent from "./changelog-modal-content";

export default function ChangelogModal() {
  const { isOpen, markAsSeen } = useChangelog("mobile");

  return (
    <Modal
      visible={isOpen}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => markAsSeen()}
    >
      <ChangelogModalContent />
    </Modal>
  );
}
