# Version history, comparison and restore

Read this whenever the request includes version history, comparison or restore. The official pages are [Methods](https://api.onlyoffice.com/docs/docs-api/usage-api/methods.md) (`refreshHistory`, `setHistoryData`) and [Events](https://api.onlyoffice.com/docs/docs-api/usage-api/config/events.md) (`onRequestHistory`, `onRequestHistoryData`, `onRequestRestore`); this page is what they don't say as consequences. There is no static config `history` field.

## Persist every revision

Persist each revision with an incremented number, actor, snapshot, and a **content hash** of the saved bytes, computed on the callback's final save (status `2`). Download and persist the callback's `changesurl` yourself rather than re-serving Document Server's own transient cache link.

**Force-save (status `6`) is not a history version.** Store its bytes as the current file (with their hash), but don't add a revision: [Saving file](https://api.onlyoffice.com/docs/docs-api/get-started/how-it-works/saving-file.md#force-saving) states that versions created by forcesave don't appear in the document history, and that change highlighting covers the whole editing session, not each version. Status `6` also leaves `document.key` unchanged, since the session is still open. The consequences for the status `2` revision that closes the session:

- its `changesurl` covers the whole session, from the moment it opened - not just what changed since the last force-save;
- so its `previous` in `setHistoryData` is the revision the session **opened from**, which is not "N-1" whenever force-saves happened in between. Record that revision on the session when the editor opens (or store it on the new revision as `previousVersion`) instead of computing it from the version number.

Test it: open, force-save, edit, close, then assert the history has one new revision (not two) and that its `previous.key` is the opening revision's key.

Keep every past revision's bytes independently fetchable by its own key, not just the current one. **On disk, that means each revision's own snapshot path, never the live document's path**, which the next save overwrites. A schema field named `storage_path`/`snapshot` on the revision record is not proof of this if every revision's value actually points at the same current file path. Verify it directly: after N+1 saves, revision N's own bytes must still differ from the live file whenever the edits did.

## Wire both event pairs

- `onRequestHistory` -> `refreshHistory` populates the list.
- `onRequestHistoryData` -> `setHistoryData` opens one version's diff. It is a distinct event from `onRequestRestore`, which reverts content.

Wiring only the first leaves every entry in a populated list silently unable to open - the "history doesn't work" symptom with no server-side error to chase.

## The full `setHistoryData` object

`setHistoryData`'s parameter object is **not** just `{key, url, version}`. Assemble the full documented shape:

- `fileType`, `key`, `url`, `version`;
- `changesUrl` and a `previous{fileType, key, url}` block whenever this isn't the first revision;
- a `token` signed with the root/browser vector - the whole object handed to the method, assembled and signed server side exactly like the root config token, never client-side.

A partial object makes Document Server's own client bundle throw deep inside its history UI (`Cannot read properties of undefined (reading 'canUseHistory')` in `onSetHistoryData`) with nothing resembling a server side error to chase - the same "looks wired, silently does nothing (or worse, throws)" failure mode as wiring only one event of the pair. The fix is completing the object, not catching the exception.