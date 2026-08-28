import { useState } from "react";
import { Button, ButtonSize, Textarea } from "@docspace/ui-kit";
import { usePluginActions } from "@onlyoffice/docspace-plugin-sdk/react";
import { ToastType } from "@onlyoffice/docspace-plugin-sdk";

import { t } from "./locales";

/** Notes by room id. In memory on purpose - the fixture is not about persistence. */
export const notes = new Map<string, string>();

let targetRoom = "";

/** The context menu click knows the room; the modal does not, so it is handed over here. */
export const setTargetRoom = (id: string): void => {
  targetRoom = id;
};

export const NoteModal = () => {
  const { showToast, closeModal } = usePluginActions();
  const [draft, setDraft] = useState(notes.get(targetRoom) ?? "");

  const save = () => {
    notes.set(targetRoom, draft);
    showToast({ type: ToastType.success, title: t("note.saved") });
    closeModal();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Textarea
        value={draft}
        placeholder={t("note.placeholder")}
        heightTextArea={120}
        onChange={(e) => setDraft(e.target.value)}
      />
      <div style={{ display: "flex", gap: 8 }}>
        <Button label={t("note.save")} size={ButtonSize.normal} primary scale onClick={save} />
        <Button label={t("note.cancel")} size={ButtonSize.normal} scale onClick={closeModal} />
      </div>
    </div>
  );
};
