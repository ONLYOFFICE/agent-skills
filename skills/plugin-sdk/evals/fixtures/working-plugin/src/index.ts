/*
 * Eval fixture: a small plugin that already works.
 *
 * Nothing here is broken. It exists so an eval can ask for a *feature to be
 * added* rather than for a project to be created, which is the harder half of
 * the job: the plugin is a live contract, so its name, its keys and its
 * conventions have to survive the edit, and a new scope has to be declared and
 * implemented in the same breath or it does nothing at all.
 *
 * It registers one context menu item on rooms, which opens a modal holding a
 * note. The note lives in memory - there is no backend, and the eval is not
 * about persistence.
 */

import {
  Actions,
  ButtonSize,
  Components,
  FilesType,
  IBox,
  IContextMenuItem,
  IContextMenuPlugin,
  IPlugin,
  IMessage,
  ModalDisplayType,
  PluginLocale,
  PluginStatus,
  ToastType,
  UsersType,
} from "@onlyoffice/docspace-plugin-sdk";

import { currentLocale, setLocale, t } from "./locales";

const notes = new Map<string, string>();

let draft = "";

const noteBody = (roomId: string): IBox => ({
  displayProp: "flex",
  flexDirection: "column",
  paddingProp: "16px",
  children: [
    {
      component: Components.textArea,
      props: {
        value: notes.get(roomId) ?? "",
        placeholder: t("note.placeholder"),
        onChange: (value: string) => {
          draft = value;
        },
      },
    },
    {
      component: Components.button,
      props: {
        label: t("note.save"),
        size: ButtonSize.normal,
        primary: true,
        scale: true,
        onClick: (): IMessage => {
          notes.set(roomId, draft);

          return {
            actions: [Actions.showToast, Actions.closeModal],
            toastProps: [{ type: ToastType.success, title: t("note.saved") }],
          };
        },
      },
    },
  ],
});

const editNoteItem = (): IContextMenuItem => ({
  key: "room-notes-edit",
  label: t("note.edit"),
  icon: "icon-16.svg",
  fileType: [FilesType.room],
  usersTypes: [UsersType.owner, UsersType.docSpaceAdmin, UsersType.roomAdmin],
  onItemClick: async (id: string | number): Promise<IMessage> => {
    const roomId = String(id);
    draft = notes.get(roomId) ?? "";

    return {
      actions: [Actions.showModal],
      modalDialogProps: {
        displayType: ModalDisplayType.modal,
        dialogHeader: t("note.title"),
        dialogBody: noteBody(roomId),
        onClose: () => ({ actions: [Actions.closeModal] }),
        onLoad: async () => ({ newDialogBody: noteBody(roomId) }),
      },
    };
  },
});

class RoomNotes implements IPlugin, IContextMenuPlugin {
  status: PluginStatus = PluginStatus.active;

  contextMenuItems: Map<string, IContextMenuItem> = new Map();

  onLoadCallback = async (): Promise<void> => {
    this.addContextMenuItem(editNoteItem());
  };

  updateStatus = (status: PluginStatus): void => {
    this.status = status;
  };

  getStatus = (): PluginStatus => this.status;

  setOnLoadCallback = (callback: () => Promise<void>): void => {
    this.onLoadCallback = callback;
  };

  setLanguage = (language: PluginLocale): void => {
    setLocale(language);
    this.updateContextMenuItem(editNoteItem());
  };

  getLanguage = (): PluginLocale => currentLocale();

  addContextMenuItem = (item: IContextMenuItem): void => {
    this.contextMenuItems.set(item.key, item);
  };

  getContextMenuItems = (): Map<string, IContextMenuItem> => this.contextMenuItems;

  getContextMenuItemsKeys = (): string[] => Array.from(this.contextMenuItems.keys());

  updateContextMenuItem = (item: IContextMenuItem): void => {
    this.contextMenuItems.set(item.key, item);
  };
}

const plugin = new RoomNotes();

declare global {
  interface Window {
    Plugins: Record<string, unknown>;
  }
}

window.Plugins.RoomNotes = plugin || {};

export default plugin;
