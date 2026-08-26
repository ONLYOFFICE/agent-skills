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
 * note. The modal is a React component (NoteModal.tsx); the note lives in
 * memory - there is no backend, and the eval is not about persistence.
 */

import {
  Actions,
  FilesType,
  IContextMenuItem,
  IContextMenuPlugin,
  IMessage,
  IPlugin,
  ModalDisplayType,
  PluginLocale,
  PluginStatus,
  UsersType,
} from "@onlyoffice/docspace-plugin-sdk";

import { currentLocale, setLocale, t } from "./locales";
import { NoteModal, setTargetRoom } from "./NoteModal";

const editNoteItem = (): IContextMenuItem => ({
  key: "room-notes-edit",
  label: t("note.edit"),
  icon: "icon-16.svg",
  fileType: [FilesType.room],
  usersTypes: [UsersType.owner, UsersType.docSpaceAdmin, UsersType.roomAdmin],
  onItemClick: (id: string | number): IMessage => {
    // The modal gets no current file from a menu click, so the id is handed over here.
    setTargetRoom(String(id));

    return {
      actions: [Actions.showModal],
      modalDialogProps: {
        displayType: ModalDisplayType.modal,
        dialogHeader: t("note.title"),
        dialogBodyComponent: NoteModal,
        autoMaxHeight: true,
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

export default plugin;
